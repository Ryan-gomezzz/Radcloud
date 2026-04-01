"""Mapping Agent — deterministic GCP → AWS resource mapping + LLM enrichment.

Reads ``context["gcp_inventory"]`` (list of normalised GCP resources),
maps each to its AWS equivalent using the Batch 1 reference tables,
then optionally enriches gap entries via Claude (Bedrock).

Writes two context keys:

- ``aws_mapping``      — per-resource mapping rows with aws_config,
                         terraform_hints, observability_hooks, etc.
- ``aws_architecture`` — aggregate summary built from actual mapping data.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from llm import call_llm_async
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
# LLM enrichment prompt
# ---------------------------------------------------------------------------

_ENRICHMENT_SYSTEM_PROMPT = """\
You are an AWS Solutions Architect reviewing a preliminary GCP-to-AWS \
migration mapping. You will receive a JSON array of mapping entries. \
Each entry already has a deterministic mapping, but some have \
``gap_flag: true`` indicating the mapping is partial or uncertain.

For each entry with ``gap_flag: true``, review and improve:

1. **gap_notes** — Write a concise, actionable migration note explaining \
what the gap is and how to address it (1-2 sentences).
2. **aws_config** — Add or correct any fields in the ``aws_config`` dict \
that the deterministic mapper may have missed. Do NOT remove existing fields.

For entries with ``gap_flag: false``, you may optionally add a brief \
``gap_notes`` with a helpful migration tip, but do NOT change ``aws_config``.

Return a JSON array of objects, one per input entry, with exactly these keys:
```
{
  "gcp_resource_id": "<same as input>",
  "gap_notes": "<improved or new migration note, or null>",
  "aws_config_additions": { <any new key-value pairs to merge into aws_config> }
}
```

Rules:
- Return ONLY the JSON array. No markdown, no code fences, no explanation.
- Keep the same order as the input.
- For entries you don't want to change, return an empty ``aws_config_additions`` dict and the existing ``gap_notes``.
"""

_NARRATIVE_SYSTEM_PROMPT = """\
You are an AWS Solutions Architect writing a migration architecture summary. \
You will receive a JSON object with two keys:

- ``services_used`` — list of AWS services in the target architecture
- ``mapping_summary`` — aggregated counts and key resource mappings

Write a concise architecture narrative (2–3 paragraphs, ~150–250 words) that:

1. Describes the target AWS architecture at a high level — VPC layout, \
compute tier, data tier, serverless components.
2. Highlights key migration decisions (e.g. Cloud Run → Fargate, \
Cloud SQL → Multi-AZ RDS, Pub/Sub → SNS+SQS).
3. Notes any gaps or areas needing manual review.

Write in a professional, technical tone suitable for a migration proposal. \
Do NOT use markdown headings, bullet lists, or code blocks — write flowing \
prose paragraphs only. Return ONLY the narrative text, no JSON wrapping.
"""


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

    # --- LLM enrichment pass (optional, fails gracefully) ---
    rows = await _enrich_with_llm(rows, context)
    context["aws_mapping"] = rows

    # --- LLM architecture narrative (optional, fails gracefully) ---
    narrative = await _generate_narrative(rows, context)
    if narrative:
        context["aws_architecture"]["summary"] = narrative

    # --- Final schema validation (Task 4.3) ---
    context["aws_mapping"] = _validate_mapping_output(rows)
    context["aws_architecture"] = _validate_architecture(context["aws_architecture"])

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


# ---------------------------------------------------------------------------
# LLM enrichment (Task 4.1)
# ---------------------------------------------------------------------------

async def _enrich_with_llm(
    rows: list[dict[str, Any]],
    context: dict,
) -> list[dict[str, Any]]:
    """Call Claude to review and enrich the preliminary mapping.

    Sends gap-flagged entries to the LLM for improved ``gap_notes`` and
    additional ``aws_config`` fields.  If the LLM call fails for any
    reason, returns *rows* unchanged (deterministic-only output).
    """
    # Only send entries that have gaps — reduces token usage.
    gap_entries = [
        {
            "gcp_resource_id": m["gcp_resource_id"],
            "gcp_type": m["gcp_type"],
            "gcp_service": m["gcp_service"],
            "aws_service": m["aws_service"],
            "aws_type": m["aws_type"],
            "aws_config": m["aws_config"],
            "mapping_confidence": m["mapping_confidence"],
            "gap_flag": m["gap_flag"],
            "gap_notes": m["gap_notes"],
        }
        for m in rows
    ]

    if not gap_entries:
        return rows

    try:
        raw_text = await call_llm_async(
            system=_ENRICHMENT_SYSTEM_PROMPT,
            messages=[{
                "role": "user",
                "content": (
                    "Review and enrich these GCP-to-AWS mapping entries:\n\n"
                    + json.dumps(gap_entries, indent=2, default=str)
                ),
            }],
            max_tokens=4096,
            temperature=0.0,
        )
    except Exception as exc:
        logger.warning("Mapping agent: LLM enrichment failed: %s", exc)
        context.setdefault("errors", []).append({
            "agent": "mapping",
            "error": f"LLM enrichment skipped (using deterministic only): {exc}",
        })
        return rows

    # Parse the LLM response.
    enrichments = _parse_enrichment_response(raw_text)
    if enrichments is None:
        logger.warning("Mapping agent: could not parse LLM enrichment response")
        context.setdefault("errors", []).append({
            "agent": "mapping",
            "error": "LLM enrichment parse failed (using deterministic only)",
        })
        return rows

    # Merge enrichments back into the rows.
    return _merge_enrichments(rows, enrichments)


def _parse_enrichment_response(raw_text: str) -> list[dict[str, Any]] | None:
    """Parse the LLM enrichment response into a list of enrichment dicts."""
    if not raw_text:
        return None

    text = raw_text.strip()

    # Strip markdown fences.
    if text.startswith("```"):
        first_nl = text.find("\n")
        if first_nl != -1:
            text = text[first_nl + 1:]
        last_fence = text.rfind("```")
        if last_fence != -1:
            text = text[:last_fence].rstrip()

    text = text.strip()

    # Strip trailing commas.
    text = re.sub(r",\s*([}\]])", r"\1", text)

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        logger.error("Mapping agent: enrichment JSON decode failed")
        return None

    if isinstance(parsed, dict):
        for key in ("enrichments", "mappings", "data", "results"):
            if key in parsed and isinstance(parsed[key], list):
                return parsed[key]
        return None

    if isinstance(parsed, list):
        return parsed

    return None


def _merge_enrichments(
    rows: list[dict[str, Any]],
    enrichments: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Merge LLM enrichments back into the mapping rows.

    Matches by ``gcp_resource_id``.  Only updates ``gap_notes`` and
    adds new keys to ``aws_config`` — never removes existing keys.
    """
    # Build a lookup by resource ID.
    enrich_by_id: dict[str, dict] = {}
    for e in enrichments:
        rid = e.get("gcp_resource_id")
        if rid:
            enrich_by_id[rid] = e

    merged_count = 0
    for row in rows:
        rid = row["gcp_resource_id"]
        if rid not in enrich_by_id:
            continue

        e = enrich_by_id[rid]

        # Update gap_notes if the LLM provided a non-empty one.
        new_notes = e.get("gap_notes")
        if new_notes and isinstance(new_notes, str) and new_notes.strip():
            row["gap_notes"] = new_notes.strip()

        # Merge additional aws_config fields (additive only).
        additions = e.get("aws_config_additions")
        if isinstance(additions, dict) and additions:
            row["aws_config"].update(additions)
            merged_count += 1

    if merged_count > 0:
        logger.info(
            "Mapping agent: merged LLM enrichments into %d/%d rows",
            merged_count, len(rows),
        )

    return rows


# ---------------------------------------------------------------------------
# Architecture narrative generation (Task 4.2)
# ---------------------------------------------------------------------------

async def _generate_narrative(
    rows: list[dict[str, Any]],
    context: dict,
) -> str | None:
    """Call Claude to generate a custom architecture narrative.

    Returns the narrative string, or ``None`` if the LLM call fails
    (in which case ``_ARCH_SUMMARY`` remains in the architecture dict).
    """
    arch = context.get("aws_architecture", {})

    # Build a compact summary for the prompt.
    type_counts: dict[str, int] = {}
    for m in rows:
        svc = m["aws_service"]
        type_counts[svc] = type_counts.get(svc, 0) + 1

    key_mappings = []
    for m in rows:
        if m["gap_flag"] or m["gcp_type"] in ("compute_instance", "cloud_sql", "cloud_run", "memorystore_redis"):
            key_mappings.append({
                "gcp": f"{m['gcp_service']} ({m['gcp_type']})",
                "aws": f"{m['aws_service']} ({m['aws_type']})",
                "confidence": m["mapping_confidence"],
                "gap_notes": m.get("gap_notes"),
            })

    prompt_data = {
        "services_used": arch.get("services_used", []),
        "mapping_summary": {
            "total_resources": arch.get("total_resources", len(rows)),
            "direct_mappings": arch.get("direct_mappings", 0),
            "partial_mappings": arch.get("partial_mappings", 0),
            "no_equivalent": arch.get("no_equivalent", 0),
            "service_counts": type_counts,
            "key_mappings": key_mappings[:15],  # cap to avoid token bloat
        },
    }

    try:
        raw_text = await call_llm_async(
            system=_NARRATIVE_SYSTEM_PROMPT,
            messages=[{
                "role": "user",
                "content": (
                    "Generate an architecture narrative for this "
                    "GCP-to-AWS migration:\n\n"
                    + json.dumps(prompt_data, indent=2, default=str)
                ),
            }],
            max_tokens=1024,
            temperature=0.3,
        )
    except Exception as exc:
        logger.warning("Mapping agent: narrative generation failed: %s", exc)
        context.setdefault("errors", []).append({
            "agent": "mapping",
            "error": f"Architecture narrative skipped (using default): {exc}",
        })
        return None

    if not raw_text or not raw_text.strip():
        return None

    # Clean up: strip any accidental markdown/fences.
    text = raw_text.strip()
    if text.startswith("```"):
        first_nl = text.find("\n")
        if first_nl != -1:
            text = text[first_nl + 1:]
        last_fence = text.rfind("```")
        if last_fence != -1:
            text = text[:last_fence].rstrip()
        text = text.strip()

    # Validate: must be at least 50 chars of prose.
    if len(text) < 50:
        logger.warning("Mapping agent: narrative too short (%d chars)", len(text))
        return None

    return text


# ---------------------------------------------------------------------------
# Final schema validation (Task 4.3)
# ---------------------------------------------------------------------------

_MAPPING_REQUIRED_FIELDS: dict[str, type] = {
    "gcp_resource_id": str,
    "gcp_service": str,
    "gcp_type": str,
    "gcp_config_summary": str,
    "aws_service": str,
    "aws_type": str,
    "aws_config": dict,
    "mapping_confidence": str,
    "gap_flag": bool,
    # gap_notes can be str or None
    "terraform_hints": dict,
    "observability_hooks": dict,
    "watchdog_priority": str,
    "target_runtime": str,
}

_ARCH_REQUIRED_KEYS = (
    "summary", "services_used", "networking",
    "total_resources", "direct_mappings", "partial_mappings", "no_equivalent",
)


def _validate_mapping_row(row: dict, idx: int) -> dict[str, Any]:
    """Validate and repair a single mapping row.

    Ensures all required fields exist with correct types.  Missing fields
    are filled with safe defaults; wrong types are coerced where possible.
    Returns the (possibly repaired) row.
    """
    for field, expected_type in _MAPPING_REQUIRED_FIELDS.items():
        if field not in row:
            # Fill missing field with a safe default.
            if expected_type is str:
                row[field] = ""
            elif expected_type is dict:
                row[field] = {}
            elif expected_type is bool:
                row[field] = False
            logger.warning(
                "Mapping agent: row %d missing '%s', filled default", idx, field
            )
        elif not isinstance(row[field], expected_type):
            # Try to coerce.
            try:
                row[field] = expected_type(row[field])
            except (TypeError, ValueError):
                if expected_type is str:
                    row[field] = str(row[field])
                elif expected_type is dict:
                    row[field] = {}
                elif expected_type is bool:
                    row[field] = bool(row[field])
                logger.warning(
                    "Mapping agent: row %d field '%s' had wrong type, coerced",
                    idx, field,
                )

    # gap_notes: must be str or None.
    gn = row.get("gap_notes")
    if gn is not None and not isinstance(gn, str):
        row["gap_notes"] = str(gn)

    # Ensure aws_config is never None.
    if row.get("aws_config") is None:
        row["aws_config"] = {}

    # Ensure mapping_confidence is a valid value.
    if row["mapping_confidence"] not in ("direct", "partial", "none"):
        row["mapping_confidence"] = "partial"
        row["gap_flag"] = True

    # Ensure watchdog_priority is valid.
    if row["watchdog_priority"] not in ("low", "medium", "high", "critical"):
        row["watchdog_priority"] = "medium"

    return row


def _validate_mapping_output(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Validate all mapping rows and log a summary.

    Runs ``_validate_mapping_row`` on each row.  This is the final gate
    before the mapping output is written to context — it guarantees
    downstream agents always receive well-formed data.
    """
    repaired = 0
    for idx, row in enumerate(rows):
        before_keys = set(row.keys())
        _validate_mapping_row(row, idx)
        if set(row.keys()) != before_keys:
            repaired += 1

    if repaired > 0:
        logger.info(
            "Mapping agent: repaired %d/%d rows during final validation",
            repaired, len(rows),
        )

    return rows


def _validate_architecture(arch: dict[str, Any]) -> dict[str, Any]:
    """Ensure the architecture dict has all required keys.

    Fills missing keys with safe defaults so the frontend never crashes.
    """
    defaults = {
        "summary": _ARCH_SUMMARY,
        "services_used": [],
        "networking": {
            "vpc_count": 1,
            "subnet_strategy": "public + private per AZ",
            "security_groups": [],
        },
        "total_resources": 0,
        "direct_mappings": 0,
        "partial_mappings": 0,
        "no_equivalent": 0,
    }

    for key in _ARCH_REQUIRED_KEYS:
        if key not in arch:
            arch[key] = defaults[key]
            logger.warning(
                "Mapping agent: architecture missing '%s', filled default", key
            )

    # Validate summary is a non-empty string.
    if not isinstance(arch["summary"], str) or len(arch["summary"]) < 10:
        arch["summary"] = _ARCH_SUMMARY
        logger.warning("Mapping agent: architecture summary invalid, using fallback")

    # Validate services_used is a list.
    if not isinstance(arch["services_used"], list):
        arch["services_used"] = []

    # Validate numeric fields.
    for nfield in ("total_resources", "direct_mappings", "partial_mappings", "no_equivalent"):
        if not isinstance(arch.get(nfield), (int, float)):
            arch[nfield] = 0

    return arch
