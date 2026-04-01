"""Risk agent — LLM + RAG migration risks; stub fallback."""
from __future__ import annotations

import json
import logging
import re

logger = logging.getLogger(__name__)

_STUB_RISKS: list[dict] = [
    {
        "id": "RISK-001",
        "category": "service_compatibility",
        "severity": "high",
        "title": "BigQuery Pub/Sub subscription has no direct AWS equivalent",
        "description": (
            "Direct Pub/Sub-to-BigQuery streaming ingestion does not exist as a single AWS primitive; "
            "NovaPay's payment-events analytics path needs redesign."
        ),
        "affected_resources": ["payment-events-sub", "transactions_curated"],
        "aws_alternative": "Kinesis Data Firehose → S3 → Athena",
        "migration_impact": "Requires rearchitecting the analytics pipeline and validation of SLAs.",
        "mitigation": "Build Kinesis-based ingestion with idempotent writers; replay from GCS export during cutover.",
        "estimated_effort_days": 15,
    },
    {
        "id": "RISK-002",
        "category": "data_migration",
        "severity": "high",
        "title": "Database migration requires zero-downtime cutover",
        "description": "REGIONAL Cloud SQL with active replica must cut over to Multi-AZ RDS without prolonged read-only windows.",
        "affected_resources": ["novapay-primary-db", "novapay-replica-db"],
        "aws_alternative": "RDS PostgreSQL with DMS continuous replication",
        "migration_impact": "High — core ledger availability risk during switch.",
        "mitigation": "Use DMS full load + CDC; rehearse failover twice; maintain GCP fallback DNS.",
        "estimated_effort_days": 12,
    },
    {
        "id": "RISK-003",
        "category": "security_compliance",
        "severity": "medium",
        "title": "IAM binding sprawl vs AWS least-privilege",
        "description": "Project-level IAM bindings and service accounts do not map 1:1 to AWS IAM roles and SCPs.",
        "affected_resources": ["iam-cloudsql-client", "sa-api-runtime", "sa-batch-worker"],
        "aws_alternative": "IAM roles per workload + permission boundaries",
        "migration_impact": "Audit cycle required for SOC2 evidence.",
        "mitigation": "Generate IAM policy matrix from GCP bindings; automate drift checks with IAM Access Analyzer.",
        "estimated_effort_days": 8,
    },
    {
        "id": "RISK-004",
        "category": "networking",
        "severity": "medium",
        "title": "Firewall tag model vs security groups",
        "description": "GCP firewall rules reference network tags; EC2 must use consistent SG attachments across ASGs.",
        "affected_resources": ["fw-allow-https", "fw-allow-internal", "web-server-1", "web-server-2"],
        "aws_alternative": "Layered security groups + subnet NACLs",
        "migration_impact": "Misconfiguration could expose payment APIs.",
        "mitigation": "Automate SG generation from rule matrix; penetration test before go-live.",
        "estimated_effort_days": 6,
    },
    {
        "id": "RISK-005",
        "category": "cost",
        "severity": "medium",
        "title": "Egress and inter-AZ data transfer",
        "description": "NovaPay's cross-tier chatter may spike AWS data transfer versus GCP internal routing assumptions.",
        "affected_resources": ["novapay-api", "payment-worker-1"],
        "aws_alternative": "VPC endpoints, PrivateLink, placement groups",
        "migration_impact": "Potential +5–12% run-rate if not architected.",
        "mitigation": "Model AZ affinity; use S3/Gateway endpoints; right-size NAT.",
        "estimated_effort_days": 4,
    },
    {
        "id": "RISK-006",
        "category": "operational",
        "severity": "low",
        "title": "Cloud Functions runtime parity",
        "description": "Python 3.11 on GCF vs Lambda packaging and cold start profiles differ.",
        "affected_resources": ["webhook-ingest-fn", "settlement-cron-fn"],
        "aws_alternative": "Lambda + EventBridge schedule + SQS trigger",
        "migration_impact": "Low — mostly CI/CD and observability wiring.",
        "mitigation": "Use Lambda Powertools; align structured logging to CloudWatch.",
        "estimated_effort_days": 3,
    },
    {
        "id": "RISK-007",
        "category": "resilience",
        "severity": "low",
        "title": "Redis failover semantics",
        "description": "Memorystore STANDARD_HA vs ElastiCache Multi-AZ failover timing differs.",
        "affected_resources": ["novapay-redis"],
        "aws_alternative": "ElastiCache Redis cluster mode disabled with replica",
        "migration_impact": "Brief cache stampede possible on failover.",
        "mitigation": "Tune TTLs; add circuit breakers in API tier.",
        "estimated_effort_days": 2,
    },
    {
        "id": "RISK-008",
        "category": "compliance",
        "severity": "medium",
        "title": "Object storage residency and encryption",
        "description": "Multi-region US buckets must map to explicit S3 buckets with KMS CMKs and lifecycle locks.",
        "affected_resources": ["novapay-assets", "novapay-logs", "novapay-backups"],
        "aws_alternative": "S3 + KMS + Object Lock (where required)",
        "migration_impact": "Medium — key rotation and audit trails.",
        "mitigation": "Use bucket policies mirroring GCS IAM; enable S3 Inventory and Macie.",
        "estimated_effort_days": 5,
    },
]


def _parse_json(text: str) -> dict | None:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass
    return None


def _summarize(risks: list[dict]) -> dict:
    high = sum(1 for r in risks if str(r.get("severity", "")).lower() == "high")
    med = sum(1 for r in risks if str(r.get("severity", "")).lower() == "medium")
    low = sum(1 for r in risks if str(r.get("severity", "")).lower() == "low")
    top = next((r.get("title") for r in risks if str(r.get("severity", "")).lower() == "high"), None)
    if not top and risks:
        top = risks[0].get("title", "")
    return {
        "total_risks": len(risks),
        "high": high,
        "medium": med,
        "low": low,
        "top_risk": top or "No risks identified",
        "overall_assessment": "Migration is feasible with moderate risk." if high < 3 else "Elevated risk — mitigation planning required.",
    }


def _apply_stub(context: dict) -> dict:
    context["risks"] = [dict(r) for r in _STUB_RISKS]
    context["risk_summary"] = {
        "total_risks": 8,
        "high": 2,
        "medium": 4,
        "low": 2,
        "top_risk": "Database migration requires zero-downtime cutover",
        "overall_assessment": "Migration is feasible with moderate risk.",
    }
    return context


async def run(context: dict) -> dict:
    from llm import call_llm_async
    from rag.retriever import retrieve_for_agent

    inv = context.get("gcp_inventory") or []
    mapping = context.get("aws_mapping") or []
    if not inv:
        return _apply_stub(context)

    rag_ctx = retrieve_for_agent("risk", context)

    inv_s = json.dumps(
        [{"id": r.get("resource_id"), "type": r.get("resource_type")} for r in inv[:40]],
        indent=2,
    )
    map_s = json.dumps(
        [
            {
                "gcp": m.get("gcp_resource_id"),
                "aws": m.get("aws_service"),
                "conf": m.get("mapping_confidence"),
            }
            for m in mapping[:40]
        ],
        indent=2,
    )

    system = """You are a GCP→AWS migration risk analyst. Output ONLY valid JSON (no markdown).

Shape:
{
  "risks": [
    {
      "id": "RISK-001",
      "category": "data_migration|networking|security_compliance|cost|operational|...",
      "severity": "high|medium|low",
      "title": "...",
      "description": "...",
      "affected_resources": ["id1"],
      "aws_alternative": "...",
      "migration_impact": "...",
      "mitigation": "...",
      "estimated_effort_days": 0
    }
  ]
}
Produce 6–12 distinct risks grounded in the inventory and mappings."""

    if rag_ctx:
        system += f"\n\n### Reference:\n{rag_ctx}"

    user_msg = f"""Inventory:\n{inv_s}\n\nAWS mappings:\n{map_s}"""

    try:
        raw = await call_llm_async(
            messages=[{"role": "user", "content": user_msg}],
            system=system,
            max_tokens=4096,
            temperature=0.15,
        )
        parsed = _parse_json(raw or "")
        if isinstance(parsed, dict) and isinstance(parsed.get("risks"), list) and parsed["risks"]:
            risks = parsed["risks"]
            context["risks"] = risks
            context["risk_summary"] = _summarize(risks)
            logger.info("Risk agent: LLM generated %d risks", len(risks))
            return context
        logger.warning("Risk: unexpected LLM output, using stub")
    except Exception as e:
        logger.warning("Risk LLM failed, using stub: %s", e)

    return _apply_stub(context)
