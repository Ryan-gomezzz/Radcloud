"""Planner agent — LLM+RAG migration plan; falls back to demo-shaped stub."""
from __future__ import annotations

import json
import logging
import re
import uuid

logger = logging.getLogger(__name__)

# Matches frontend PlanReviewPage MOCK_PLAN shape for fallback / demo continuity.
_STUB_MIGRATION_PLAN: dict = {
    "plan_id": "plan-001",
    "phases": [
        {
            "id": "p1",
            "name": "Infrastructure Setup",
            "duration_days": 5,
            "resources": ["VPC", "Subnets", "Security groups"],
        },
        {
            "id": "p2",
            "name": "Compute Migration",
            "duration_days": 8,
            "resources": ["GCE", "MIG", "Load balancers"],
        },
        {
            "id": "p3",
            "name": "Database Migration",
            "duration_days": 12,
            "resources": ["Cloud SQL", "Memorystore"],
        },
        {
            "id": "p4",
            "name": "Storage + CDN",
            "duration_days": 4,
            "resources": ["GCS", "Cloud CDN"],
        },
        {
            "id": "p5",
            "name": "Verification & Cutover",
            "duration_days": 3,
            "resources": ["DNS", "Monitoring"],
        },
    ],
    "estimated_cost_delta": 312,
    "risk_count_high": 2,
    "architecture_mappings": [
        {"phase_id": "p1", "gcp": "VPC Network", "aws": "Amazon VPC", "confidence": "direct"},
        {"phase_id": "p1", "gcp": "Cloud NAT", "aws": "NAT Gateway", "confidence": "direct"},
        {"phase_id": "p2", "gcp": "Compute Engine", "aws": "EC2 + ASG", "confidence": "direct"},
        {"phase_id": "p2", "gcp": "Cloud Load Balancing", "aws": "ALB", "confidence": "partial"},
        {"phase_id": "p3", "gcp": "Cloud SQL (PostgreSQL)", "aws": "Amazon RDS", "confidence": "direct"},
        {"phase_id": "p3", "gcp": "Memorystore Redis", "aws": "ElastiCache", "confidence": "partial"},
        {"phase_id": "p4", "gcp": "Cloud Storage", "aws": "S3", "confidence": "direct"},
        {"phase_id": "p4", "gcp": "Cloud CDN", "aws": "CloudFront", "confidence": "direct"},
        {"phase_id": "p5", "gcp": "Cloud DNS", "aws": "Route 53", "confidence": "direct"},
        {"phase_id": "p2", "gcp": "Cloud Run", "aws": "ECS Fargate", "confidence": "none"},
    ],
    "cost_categories": [
        {"category": "Compute", "before": 4200, "after": 4512},
        {"category": "Database", "before": 1800, "after": 1950},
        {"category": "Storage", "before": 890, "after": 920},
        {"category": "Networking", "before": 640, "after": 710},
        {"category": "Other", "before": 310, "after": 330},
    ],
    "risks": [
        {
            "id": "r1",
            "title": "Cloud Spanner has no direct AWS equivalent",
            "description": "Requires Aurora Global Database with manual schema migration and extended cutover window.",
            "severity": "high",
        },
        {
            "id": "r2",
            "title": "Committed use discount expiry",
            "description": "GCP CUD expires in 45 days; align AWS RI purchase to avoid a cost spike.",
            "severity": "high",
        },
        {
            "id": "r3",
            "title": "Cross-region replication lag",
            "description": "Initial RDS read replica may lag under bulk load; throttle migration batches.",
            "severity": "medium",
        },
        {
            "id": "r4",
            "title": "IAM role trust chain",
            "description": "Verify external ID and role session duration for CI/CD pipelines.",
            "severity": "low",
        },
    ],
}


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


def stub_migration_plan() -> dict:
    """Deterministic demo plan (no LLM) for cached / offline responses."""
    return _stub_plan({"risks": []})


def _stub_plan(context: dict) -> dict:
    plan = json.loads(json.dumps(_STUB_MIGRATION_PLAN))
    plan["plan_id"] = f"plan-{uuid.uuid4().hex[:12]}"
    phases = plan.get("phases") or []
    plan["timeline_days"] = sum(int(p.get("duration_days") or 0) for p in phases)
    high = sum(1 for r in (context.get("risks") or []) if str(r.get("severity", "")).lower() == "high")
    if high:
        plan["risk_count_high"] = high
    return plan


async def run(context: dict) -> dict:
    from llm import call_llm_async
    from rag.retriever import retrieve_for_agent

    rag_ctx = retrieve_for_agent("planner", context)

    inv = context.get("gcp_inventory") or []
    risks = context.get("risks") or []
    mapping = context.get("aws_mapping") or []
    fin = context.get("finops") or context.get("cost_analysis") or {}

    summary_bits = [
        f"inventory_count={len(inv)}",
        f"mappings={len(mapping)}",
        f"risks={len(risks)}",
    ]
    if isinstance(fin, dict) and fin.get("aws_monthly_optimized"):
        summary_bits.append(f"aws_monthly_optimized={fin.get('aws_monthly_optimized')}")

    system = """You are a GCP→AWS migration planner. Output ONLY valid JSON (no markdown).

Required JSON shape:
{
  "plan_id": "plan-xxxxxxxx",
  "phases": [ { "id": "p1", "name": "...", "duration_days": 5, "resources": ["..."] } ],
  "estimated_cost_delta": 0,
  "risk_count_high": 0,
  "architecture_mappings": [ { "phase_id": "p1", "gcp": "...", "aws": "...", "confidence": "direct|partial|none" } ],
  "cost_categories": [ { "category": "Compute", "before": 0, "after": 0 } ],
  "risks": [ { "id": "r1", "title": "...", "description": "...", "severity": "high|medium|low" } ],
  "timeline_days": 0
}

Use realistic phase ids p1..p5. Ensure timeline_days equals sum of phase duration_days.
risk_count_high must match count of high-severity items in risks array."""

    if rag_ctx:
        system += f"\n\n### Reference:\n{rag_ctx}"

    user_msg = f"""Build a migration execution plan from this pipeline context:
{', '.join(summary_bits)}

Risk titles (sample): {json.dumps([r.get('title') for r in risks[:8]])}
AWS services in mapping (sample): {json.dumps(list({m.get('aws_service') for m in mapping[:20] if m.get('aws_service')}))}"""

    try:
        raw = await call_llm_async(
            messages=[{"role": "user", "content": user_msg}],
            system=system,
            max_tokens=4096,
            temperature=0.2,
        )
        parsed = _parse_json(raw or "")
        if isinstance(parsed, dict) and parsed.get("phases"):
            if not parsed.get("plan_id"):
                parsed["plan_id"] = f"plan-{uuid.uuid4().hex[:12]}"
            phases = parsed.get("phases") or []
            parsed["timeline_days"] = parsed.get("timeline_days") or sum(
                int(p.get("duration_days") or 0) for p in phases
            )
            context["migration_plan"] = parsed
            logger.info("Planner: LLM plan %s", parsed.get("plan_id"))
            return context
        logger.warning("Planner: unexpected LLM output, using stub")
    except Exception as e:
        logger.warning("Planner LLM failed, using stub: %s", e)

    context["migration_plan"] = _stub_plan(context)
    return context
