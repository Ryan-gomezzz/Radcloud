"""Mapping Agent — LLM-powered GCP → AWS resource mapping with RAG context.

Falls back to rule-based stub mapping if LLM fails.
"""
from __future__ import annotations

import json
import logging
import re

logger = logging.getLogger(__name__)

_ARCH_SUMMARY = (
    "Target AWS architecture: single production VPC in us-east-1 with three isolated tiers: "
    "public edge (ALB), private application subnets (EC2/ECS Fargate), and private database subnets "
    "(Multi-AZ RDS PostgreSQL). ElastiCache Redis for session/cache, versioned S3 buckets replacing GCS, "
    "Lambda + EventBridge for Cloud Functions, SNS+SQS replacing Pub/Sub, Athena+Glue for BigQuery workloads."
)


def _cfg_summary(cfg: dict) -> str:
    parts = [f"{k}={v}" for k, v in list(cfg.items())[:6]]
    return ", ".join(parts)[:120]


def _stub_map_resource(r: dict) -> dict:
    """Rule-based fallback mapping for a single GCP resource."""
    rid = r.get("resource_id", r.get("name", "unknown"))
    rtype = r.get("resource_type", "other")
    cfg = r.get("config") or {}

    aws_service, aws_type, confidence, gap_flag, gap_notes = "Unknown", "unknown", "none", True, None

    if rtype == "compute_instance":
        aws_service, aws_type, confidence, gap_flag = "EC2", "instance", "direct", False
        aws_config = {"instance_type": "m7i.xlarge" if "web" in rid else "c7i.2xlarge", "ebs_type": "gp3"}
    elif rtype == "cloud_sql":
        aws_service, aws_type, confidence, gap_flag = "RDS", "db_instance", "direct", False
        aws_config = {"instance_class": "db.m6i.xlarge", "engine": "postgres", "multi_az": True}
    elif rtype == "memorystore_redis":
        aws_service, aws_type, confidence, gap_flag = "ElastiCache", "redis_cluster", "direct", False
        aws_config = {"node_type": "cache.r7g.large", "num_nodes": 2}
    elif rtype == "gcs_bucket":
        aws_service, aws_type, confidence, gap_flag = "S3", "bucket", "direct", False
        aws_config = {"storage_class": "STANDARD_IA" if cfg.get("storage_class") == "NEARLINE" else "STANDARD"}
    elif rtype == "cloud_run":
        aws_service, aws_type, confidence, gap_flag = "ECS Fargate", "service", "direct", False
        aws_config = {"cpu": "1024", "memory": "2048"}
    elif rtype == "cloud_function":
        aws_service, aws_type, confidence, gap_flag = "Lambda", "function", "direct", False
        aws_config = {"memory_mb": cfg.get("memory_mb", 512), "runtime": "python3.12"}
    elif rtype == "pubsub_topic":
        aws_service, aws_type, confidence, gap_flag = "SNS", "topic", "direct", False
        aws_config = {}
    elif rtype in ("pubsub_subscription",):
        aws_service, aws_type, confidence = "SQS", "queue", "partial"
        gap_flag, gap_notes = True, "BigQuery streaming subscriptions may need Kinesis Firehose."
        aws_config = {}
    elif rtype == "bigquery_dataset":
        aws_service, aws_type, confidence = "Athena", "workgroup", "partial"
        gap_flag, gap_notes = True, "Evaluate Redshift Serverless for BI-heavy queries."
        aws_config = {"output_location": "s3://athena-results/"}
    elif rtype in ("bigquery_table",):
        aws_service, aws_type, confidence = "Glue Data Catalog", "table", "partial"
        gap_flag, gap_notes = True, "Schema conversion required."
        aws_config = {"format": "parquet"}
    elif rtype == "vpc_network":
        aws_service, aws_type, confidence, gap_flag = "VPC", "vpc", "direct", False
        aws_config = {"cidr": "10.0.0.0/16"}
    elif rtype in ("vpc_subnet",):
        aws_service, aws_type, confidence, gap_flag = "VPC", "subnet", "direct", False
        aws_config = {}
    elif rtype == "firewall_rule":
        aws_service, aws_type, confidence = "VPC", "security_group_rule", "partial"
        gap_flag, gap_notes = True, "GCP network tags → AWS Security Groups requires redesign."
        aws_config = {}
    elif rtype in ("service_account", "iam_binding"):
        aws_service, aws_type, confidence = "IAM", "role", "partial"
        gap_flag, gap_notes = True, "GCP SA → AWS IAM role; policy syntax differs."
        aws_config = {}
    elif rtype == "gke_cluster":
        aws_service, aws_type, confidence, gap_flag = "EKS", "cluster", "direct", False
        aws_config = {}
    else:
        aws_config = {}
        gap_notes = f"No deterministic mapping for resource type: {rtype}"

    return {
        "gcp_resource_id": rid,
        "gcp_service": r.get("service", rtype),
        "gcp_type": rtype,
        "gcp_config_summary": _cfg_summary(cfg),
        "aws_service": aws_service,
        "aws_type": aws_type,
        "aws_config": aws_config,
        "mapping_confidence": confidence,
        "gap_flag": gap_flag,
        "gap_notes": gap_notes,
    }


def _parse_json(text: str) -> dict | list | None:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r"```(?:json)?\s*(\[.*?\]|\{.*?\})\s*```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass
    match = re.search(r"(\[[\s\S]*\]|\{[\s\S]*\})", text)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass
    return None


async def run(context: dict) -> dict:
    from llm import call_llm_async
    from rag.retriever import retrieve_for_agent

    inv = context.get("gcp_inventory") or []
    if not inv:
        context["aws_mapping"] = []
        context["aws_architecture"] = {"summary": _ARCH_SUMMARY, "total_resources": 0}
        return context

    rag_ctx = retrieve_for_agent("mapping", context)

    resource_types = list({r.get("resource_type", "") for r in inv})
    inv_summary = json.dumps([
        {
            "name": r.get("name", r.get("resource_id", "?")),
            "type": r.get("resource_type", ""),
            "config": {k: v for k, v in (r.get("config") or {}).items() if k in
                       ("machine_type", "engine", "memory_mb", "storage_class", "availability_type", "memory_size_gb")}
        }
        for r in inv[:30]
    ], indent=2)

    system = """You are a cloud architecture expert. Map each GCP resource to its best AWS equivalent.
Output ONLY a JSON object — no explanation, no markdown.

Required output structure:
{
  "mappings": [
    {
      "gcp_resource_id": "...",
      "gcp_service": "...",
      "gcp_type": "...",
      "gcp_config_summary": "...",
      "aws_service": "EC2|RDS|ElastiCache|S3|ECS Fargate|Lambda|SNS|SQS|Athena|VPC|IAM|EKS|...",
      "aws_type": "...",
      "aws_config": {},
      "mapping_confidence": "direct|partial|none",
      "gap_flag": false,
      "gap_notes": null
    }
  ],
  "architecture_summary": "...",
  "services_used": ["EC2", "RDS", ...],
  "total_resources": 0,
  "direct_mappings": 0,
  "partial_mappings": 0,
  "no_equivalent": 0
}"""

    if rag_ctx:
        system += f"\n\n### Reference (GCP→AWS mapping guide):\n{rag_ctx}"

    user_msg = f"""Map these {len(inv)} GCP resources to AWS equivalents:

{inv_summary}

For each resource, determine:
- Best AWS service equivalent
- Mapping confidence (direct/partial/none)
- Any gaps or migration notes
- Recommended AWS configuration

Also provide an architecture_summary describing the target AWS environment."""

    try:
        raw = await call_llm_async(
            messages=[{"role": "user", "content": user_msg}],
            system=system,
            max_tokens=4096,
            temperature=0.1,
        )
        parsed = _parse_json(raw)
        if isinstance(parsed, dict) and "mappings" in parsed:
            rows = parsed["mappings"]
            context["aws_mapping"] = rows
            context["aws_architecture"] = {
                "summary": parsed.get("architecture_summary", _ARCH_SUMMARY),
                "services_used": parsed.get("services_used", []),
                "total_resources": parsed.get("total_resources", len(rows)),
                "direct_mappings": parsed.get("direct_mappings", 0),
                "partial_mappings": parsed.get("partial_mappings", 0),
                "no_equivalent": parsed.get("no_equivalent", 0),
                "networking": {"vpc_count": 1, "subnet_strategy": "public + private per AZ"},
            }
            logger.info("Mapping agent: LLM-generated %d mappings", len(rows))
            return context
        logger.warning("Mapping: unexpected LLM output structure, falling back")
    except Exception as e:
        logger.warning("Mapping LLM failed, using stub: %s", e)

    # Fallback: rule-based mapping
    rows = [_stub_map_resource(r) for r in inv]
    direct = sum(1 for m in rows if m["mapping_confidence"] == "direct")
    partial = sum(1 for m in rows if m["mapping_confidence"] == "partial")
    none_eq = sum(1 for m in rows if m["mapping_confidence"] == "none")

    context["aws_mapping"] = rows
    context["aws_architecture"] = {
        "summary": _ARCH_SUMMARY,
        "services_used": list({m["aws_service"] for m in rows}),
        "networking": {"vpc_count": 1, "subnet_strategy": "public + private per AZ",
                       "security_groups": ["web-sg", "api-sg", "db-sg"]},
        "total_resources": len(rows),
        "direct_mappings": direct,
        "partial_mappings": partial,
        "no_equivalent": none_eq,
    }
    return context
