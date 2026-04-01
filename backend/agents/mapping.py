"""Mapping Agent — deterministic GCP → AWS resource mapping.

Reads ``context["gcp_inventory"]`` (list of normalised GCP resources),
maps each to its AWS equivalent using the Batch 1 reference tables,
and writes two context keys:

- ``aws_mapping``      — per-resource mapping rows with aws_config,
                         terraform_hints, observability_hooks, etc.
- ``aws_architecture`` — aggregate summary built from actual mapping data.
"""

from __future__ import annotations

import logging
from typing import Any

from agents.aws_mapping_table import SERVICE_MAP, DEFAULT_SERVICE_MAP_ENTRY
from agents.instance_mapping import (
    resolve_machine_type,
    resolve_region,
    resolve_storage_class,
    resolve_disk_type,
)
from agents.iac_hints import get_iac_hint
from agents.observability_mapping import get_observability

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Architecture summary prose (used as fallback / enrichment)
# ---------------------------------------------------------------------------

_ARCH_SUMMARY = (
    "NovaPay's target AWS architecture lands in a single production VPC in us-east-1 with three "
    "isolated tiers: public edge (ALB only), private application subnets for EC2 web and ECS Fargate "
    "API workloads, and private database subnets for Multi-AZ RDS PostgreSQL. ElastiCache Redis "
    "replaces Memorystore for session and rate-limit data. GCS maps to versioned S3 buckets with "
    "lifecycle policies mirroring Nearline/Coldline economics. Cloud Run becomes an ECS Fargate "
    "service behind an internal ALB; Cloud Functions become Lambda with EventBridge and SQS "
    "triggers. Pub/Sub maps to SNS topics fanning into SQS queues; BigQuery analytics land on "
    "Athena + S3 curated data lake with optional Redshift Serverless for heavy aggregation. "
    "Firewall tag semantics are rebuilt as security groups and NACLs with explicit least-privilege "
    "paths between web, API, and data tiers."
)

# Map AWS service → deployment runtime for downstream agents.
_TARGET_RUNTIME: dict[str, str] = {
    "EC2": "ec2",
    "RDS": "rds",
    "ElastiCache": "elasticache",
    "S3": "s3",
    "ECS Fargate": "fargate",
    "Lambda": "lambda",
    "SNS": "sns",
    "SQS": "sqs",
    "Athena": "athena",
    "Glue Data Catalog": "glue",
    "VPC": "networking",
    "IAM": "iam",
}


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

async def run(context: dict) -> dict:
    """Run the Mapping Agent.

    Iterates over ``gcp_inventory``, maps each resource to its AWS
    equivalent using the reference tables, and builds an aggregate
    architecture summary from the actual mapping results.
    """
    inv = context.get("gcp_inventory") or []
    rows: list[dict[str, Any]] = []

    for r in inv:
        rid = r.get("resource_id", r.get("name", "unknown"))
        rtype = r.get("resource_type", "other")
        svc = r.get("service", "")
        cfg = r.get("config") or {}

        # --- Lookup in SERVICE_MAP ---
        svc_entry = SERVICE_MAP.get(rtype, DEFAULT_SERVICE_MAP_ENTRY)
        aws_service = svc_entry["aws_service"]
        aws_type = svc_entry["aws_type"]
        confidence = svc_entry["confidence"]
        gap_flag = confidence != "direct"
        gap_notes = svc_entry.get("migration_notes")

        # --- Build aws_config per resource type ---
        aws_config = _build_aws_config(rtype, rid, cfg)

        # --- Attach enrichment from Batch 1 tables ---
        iac = get_iac_hint(rtype)
        obs = get_observability(rtype)
        target_runtime = _TARGET_RUNTIME.get(aws_service, "other")

        rows.append({
            "gcp_resource_id": rid,
            "gcp_service": svc,
            "gcp_type": rtype,
            "gcp_config_summary": _cfg_summary(cfg),
            "aws_service": aws_service,
            "aws_type": aws_type,
            "aws_config": aws_config,
            "mapping_confidence": confidence,
            "gap_flag": gap_flag,
            "gap_notes": gap_notes,
            "terraform_hints": {
                "resource_type": iac["terraform_resource_type"],
                "module": iac.get("module"),
                "required_inputs": iac.get("required_inputs", []),
            },
            "observability_hooks": {
                "metrics": obs.get("cloudwatch_metrics", []),
                "log_group": obs.get("log_group_pattern"),
                "alarms": obs.get("recommended_alarms", []),
            },
            "watchdog_priority": obs.get("watchdog_priority", "low"),
            "target_runtime": target_runtime,
        })

    # --- Build architecture summary from actual data ---
    context["aws_mapping"] = rows
    context["aws_architecture"] = _build_architecture(rows)

    return context


# ---------------------------------------------------------------------------
# AWS config builders — per resource type
# ---------------------------------------------------------------------------

def _build_aws_config(rtype: str, rid: str, cfg: dict) -> dict[str, Any]:
    """Build the ``aws_config`` dict for a GCP resource.

    Uses the Batch 1 instance/region/storage/disk mapping helpers for
    deterministic translation.
    """
    region = resolve_region(cfg.get("region", cfg.get("zone", "")))

    if rtype == "compute_instance":
        return {
            "instance_type": resolve_machine_type(cfg.get("machine_type", "")),
            "region": region,
            "ebs_size_gb": cfg.get("disk_size_gb", 100),
            "ebs_type": resolve_disk_type(cfg.get("disk_type", "pd-balanced")),
        }

    if rtype == "cloud_sql":
        # Map Cloud SQL tier to RDS instance type.
        tier = cfg.get("tier", "db-n1-standard-4")
        # Tiers like "db-n1-standard-4" → strip "db-" prefix to lookup
        machine_key = tier.replace("db-", "") if tier.startswith("db-") else tier
        instance_type = resolve_machine_type(machine_key)
        # Prefix with "db." for RDS naming
        if not instance_type.startswith("db."):
            instance_type = f"db.{instance_type}"
        return {
            "instance_type": instance_type,
            "region": region,
            "engine": _sql_engine(cfg.get("database_version", "")),
            "engine_version": _sql_engine_version(cfg.get("database_version", "")),
            "multi_az": cfg.get("availability_type") == "REGIONAL",
            "allocated_storage_gb": cfg.get("disk_size_gb", 100),
            "replica_of": cfg.get("replica_of"),
        }

    if rtype == "memorystore_redis":
        return {
            "node_type": "cache.r6g.large",
            "region": region,
            "num_nodes": 2 if cfg.get("tier") == "STANDARD_HA" else 1,
            "engine_version": _redis_version(cfg.get("redis_version", "")),
        }

    if rtype == "gcs_bucket":
        return {
            "storage_class": resolve_storage_class(
                cfg.get("storage_class", "STANDARD")
            ),
            "region": region or "us-east-1",
            "versioning": cfg.get("versioning", False),
        }

    if rtype == "cloud_run":
        return {
            "cpu": cfg.get("cpu", "1024"),
            "memory": cfg.get("memory", "2048"),
            "region": region,
            "min_instances": cfg.get("min_instances", 0),
            "max_instances": cfg.get("max_instances", 10),
        }

    if rtype == "cloud_function":
        return {
            "memory_mb": cfg.get("memory_mb", 512),
            "region": region,
            "runtime": cfg.get("runtime", "python3.11"),
            "trigger": cfg.get("trigger", "http"),
        }

    if rtype == "pubsub_topic":
        return {"region": region}

    if rtype == "pubsub_subscription":
        return {
            "region": region,
            "topic": cfg.get("topic"),
        }

    if rtype == "bigquery_dataset":
        return {
            "region": region,
            "output_location": f"s3://{rid}-athena-results/",
        }

    if rtype == "bigquery_table":
        return {
            "format": "parquet",
            "partitioning": cfg.get("partitioning", "DAY"),
            "dataset_id": cfg.get("dataset_id"),
        }

    if rtype == "vpc_network":
        return {
            "cidr": "10.0.0.0/16",
            "region": region,
            "enable_dns": True,
        }

    if rtype == "vpc_subnet":
        return {
            "cidr": cfg.get("ip_cidr_range", "10.0.0.0/24"),
            "region": region,
            "map_public_ip": False,
        }

    if rtype == "firewall_rule":
        return {
            "region": region,
            "direction": cfg.get("direction", "INGRESS"),
            "ports": cfg.get("ports", []),
            "source_ranges": cfg.get("source_ranges", []),
        }

    if rtype == "service_account":
        return {
            "region": region,
            "account_id": cfg.get("account_id"),
        }

    if rtype == "iam_binding":
        return {
            "region": region,
            "role": cfg.get("role"),
            "members": cfg.get("members", []),
        }

    # Fallthrough for unknown types
    return {"region": region}


# ---------------------------------------------------------------------------
# Architecture summary builder (Task 3.2)
# ---------------------------------------------------------------------------

def _build_architecture(rows: list[dict]) -> dict[str, Any]:
    """Build ``aws_architecture`` from the actual mapping results.

    Computes real counts instead of hardcoding; uses ``_ARCH_SUMMARY``
    prose, and derives networking + services_used from the rows.
    """
    direct = sum(1 for m in rows if m["mapping_confidence"] == "direct")
    partial = sum(1 for m in rows if m["mapping_confidence"] == "partial")
    noneq = sum(1 for m in rows if m["mapping_confidence"] == "none")
    total = len(rows)

    # Unique AWS services actually used.
    services_used = sorted({m["aws_service"] for m in rows if m["aws_service"] != "Unknown"})

    # Networking details from actual VPC/subnet/SG rows.
    vpc_count = sum(1 for m in rows if m["aws_type"] == "vpc")
    subnets = [m for m in rows if m["aws_type"] == "subnet"]
    sg_rules = [m for m in rows if m["aws_type"] == "security_group_rule"]

    # Derive security group names from firewall rule names.
    sg_names = []
    for m in sg_rules:
        name = m["gcp_resource_id"]
        # Convert GCP firewall name to AWS SG name style
        sg_name = name.replace("fw-", "").replace("-", "_") + "-sg"
        sg_names.append(sg_name)

    return {
        "summary": _ARCH_SUMMARY,
        "services_used": services_used,
        "networking": {
            "vpc_count": max(1, vpc_count),
            "subnet_count": len(subnets),
            "subnet_strategy": "public + private per AZ",
            "security_groups": sg_names or ["web-sg", "api-sg", "db-sg"],
        },
        "total_resources": total,
        "direct_mappings": direct,
        "partial_mappings": partial,
        "no_equivalent": noneq,
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _cfg_summary(cfg: dict) -> str:
    """Build a compact one-line config summary for display."""
    parts = [f"{k}={v}" for k, v in list(cfg.items())[:6]]
    return ", ".join(parts)[:120]


def _sql_engine(db_version: str) -> str:
    """Extract the engine name from a Cloud SQL database_version string."""
    v = db_version.upper()
    if "POSTGRES" in v:
        return "postgres"
    if "MYSQL" in v:
        return "mysql"
    if "SQLSERVER" in v:
        return "sqlserver-ee"
    return "postgres"  # default


def _sql_engine_version(db_version: str) -> str:
    """Extract the engine version number from a Cloud SQL database_version."""
    # e.g. "POSTGRES_14" → "14", "MYSQL_8_0" → "8.0"
    parts = db_version.split("_")
    nums = [p for p in parts if p.isdigit()]
    return ".".join(nums) if nums else "14"


def _redis_version(version_str: str) -> str:
    """Normalise a Memorystore Redis version for ElastiCache."""
    # e.g. "REDIS_6_X" → "6.x"
    return version_str.lower().replace("redis_", "").replace("_", ".")
