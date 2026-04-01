"""Discovery agent — LLM parse of Terraform/YAML + RAG; NovaPay stub fallback."""
from __future__ import annotations

import json
import logging
import re

logger = logging.getLogger(__name__)

_STUB_INVENTORY: list[dict] = [
    {
        "resource_id": "web-server-1",
        "resource_type": "compute_instance",
        "service": "Compute Engine",
        "name": "web-server-1",
        "config": {
            "machine_type": "n1-standard-4",
            "region": "us-central1",
            "zone": "us-central1-a",
            "disk_size_gb": 100,
            "disk_type": "pd-ssd",
            "role": "web",
        },
    },
    {
        "resource_id": "web-server-2",
        "resource_type": "compute_instance",
        "service": "Compute Engine",
        "name": "web-server-2",
        "config": {
            "machine_type": "n1-standard-4",
            "region": "us-central1",
            "zone": "us-central1-b",
            "disk_size_gb": 100,
            "disk_type": "pd-ssd",
            "role": "web",
        },
    },
    {
        "resource_id": "payment-worker-1",
        "resource_type": "compute_instance",
        "service": "Compute Engine",
        "name": "payment-worker-1",
        "config": {
            "machine_type": "n1-highcpu-8",
            "region": "us-central1",
            "zone": "us-central1-a",
            "disk_size_gb": 200,
            "disk_type": "pd-ssd",
            "role": "batch",
        },
    },
    {
        "resource_id": "novapay-primary-db",
        "resource_type": "cloud_sql",
        "service": "Cloud SQL",
        "name": "novapay-primary-db",
        "config": {
            "database_version": "POSTGRES_14",
            "tier": "db-n1-standard-4",
            "region": "us-central1",
            "disk_size_gb": 500,
            "availability_type": "REGIONAL",
        },
    },
    {
        "resource_id": "novapay-replica-db",
        "resource_type": "cloud_sql",
        "service": "Cloud SQL",
        "name": "novapay-replica-db",
        "config": {
            "database_version": "POSTGRES_14",
            "tier": "db-n1-standard-2",
            "region": "us-central1",
            "disk_size_gb": 500,
            "availability_type": "ZONAL",
            "replica_of": "novapay-primary-db",
        },
    },
    {
        "resource_id": "novapay-redis",
        "resource_type": "memorystore_redis",
        "service": "Memorystore",
        "name": "novapay-redis",
        "config": {
            "tier": "STANDARD_HA",
            "memory_size_gb": 5,
            "region": "us-central1",
            "redis_version": "REDIS_6_X",
        },
    },
    {
        "resource_id": "novapay-assets",
        "resource_type": "gcs_bucket",
        "service": "Cloud Storage",
        "name": "novapay-assets-prod",
        "config": {
            "location": "US",
            "storage_class": "STANDARD",
            "versioning": True,
        },
    },
    {
        "resource_id": "novapay-logs",
        "resource_type": "gcs_bucket",
        "service": "Cloud Storage",
        "name": "novapay-logs-archive",
        "config": {
            "location": "US",
            "storage_class": "NEARLINE",
            "lifecycle_days": 90,
        },
    },
    {
        "resource_id": "novapay-backups",
        "resource_type": "gcs_bucket",
        "service": "Cloud Storage",
        "name": "novapay-db-backups",
        "config": {
            "location": "US",
            "storage_class": "COLDLINE",
            "versioning": True,
        },
    },
    {
        "resource_id": "novapay-api",
        "resource_type": "cloud_run",
        "service": "Cloud Run",
        "name": "novapay-api",
        "config": {
            "region": "us-central1",
            "cpu": "2",
            "memory": "2Gi",
            "min_instances": 1,
            "max_instances": 20,
        },
    },
    {
        "resource_id": "webhook-ingest-fn",
        "resource_type": "cloud_function",
        "service": "Cloud Functions",
        "name": "webhook-ingest-fn",
        "config": {
            "region": "us-central1",
            "runtime": "python311",
            "trigger": "http",
            "memory_mb": 512,
        },
    },
    {
        "resource_id": "settlement-cron-fn",
        "resource_type": "cloud_function",
        "service": "Cloud Functions",
        "name": "settlement-cron-fn",
        "config": {
            "region": "us-central1",
            "runtime": "python311",
            "trigger": "pubsub",
            "memory_mb": 1024,
        },
    },
    {
        "resource_id": "payment-events",
        "resource_type": "pubsub_topic",
        "service": "Pub/Sub",
        "name": "payment-events",
        "config": {"message_retention_duration": "604800s"},
    },
    {
        "resource_id": "payment-events-sub",
        "resource_type": "pubsub_subscription",
        "service": "Pub/Sub",
        "name": "payment-events-sub",
        "config": {
            "topic": "payment-events",
            "ack_deadline_seconds": 60,
            "push_endpoint": None,
        },
    },
    {
        "resource_id": "novapay_analytics",
        "resource_type": "bigquery_dataset",
        "service": "BigQuery",
        "name": "novapay_analytics",
        "config": {"location": "US", "default_table_expiration_ms": None},
    },
    {
        "resource_id": "transactions_curated",
        "resource_type": "bigquery_table",
        "service": "BigQuery",
        "name": "transactions_curated",
        "config": {
            "dataset_id": "novapay_analytics",
            "partitioning": "DAY",
        },
    },
    {
        "resource_id": "novapay-vpc",
        "resource_type": "vpc_network",
        "service": "VPC",
        "name": "novapay-vpc",
        "config": {"auto_create_subnetworks": False, "routing_mode": "REGIONAL"},
    },
    {
        "resource_id": "private-app-subnet",
        "resource_type": "vpc_subnet",
        "service": "VPC",
        "name": "private-app-subnet",
        "config": {
            "ip_cidr_range": "10.0.1.0/24",
            "region": "us-central1",
            "private_ip_google_access": True,
        },
    },
    {
        "resource_id": "private-db-subnet",
        "resource_type": "vpc_subnet",
        "service": "VPC",
        "name": "private-db-subnet",
        "config": {
            "ip_cidr_range": "10.0.2.0/24",
            "region": "us-central1",
            "private_ip_google_access": True,
        },
    },
    {
        "resource_id": "fw-allow-internal",
        "resource_type": "firewall_rule",
        "service": "VPC Firewall",
        "name": "fw-allow-internal",
        "config": {
            "direction": "INGRESS",
            "ports": ["tcp:0-65535"],
            "source_ranges": ["10.0.0.0/16"],
        },
    },
    {
        "resource_id": "fw-allow-https",
        "resource_type": "firewall_rule",
        "service": "VPC Firewall",
        "name": "fw-allow-https",
        "config": {
            "direction": "INGRESS",
            "ports": ["tcp:443"],
            "source_ranges": ["0.0.0.0/0"],
            "target_tags": ["web"],
        },
    },
    {
        "resource_id": "fw-deny-all-egress-default",
        "resource_type": "firewall_rule",
        "service": "VPC Firewall",
        "name": "fw-restrict-egress-db",
        "config": {
            "direction": "EGRESS",
            "deny": True,
            "target_tags": ["db"],
        },
    },
    {
        "resource_id": "sa-api-runtime",
        "resource_type": "service_account",
        "service": "IAM",
        "name": "sa-api-runtime",
        "config": {"account_id": "novapay-api-runtime", "display_name": "NovaPay API Runtime"},
    },
    {
        "resource_id": "sa-batch-worker",
        "resource_type": "service_account",
        "service": "IAM",
        "name": "sa-batch-worker",
        "config": {"account_id": "novapay-batch", "display_name": "NovaPay Batch Worker"},
    },
    {
        "resource_id": "iam-cloudsql-client",
        "resource_type": "iam_binding",
        "service": "IAM",
        "name": "project_iam_cloudsql_client",
        "config": {
            "role": "roles/cloudsql.client",
            "members": ["serviceAccount:novapay-api-runtime@*.iam.gserviceaccount.com"],
        },
    },
]


def _parse_json(text: str) -> dict | list | None:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r"```(?:json)?\s*(\[[\s\S]*?\]|\{[\s\S]*?\})\s*```", text, re.DOTALL)
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


def _normalize_inventory(rows: list) -> list[dict]:
    out: list[dict] = []
    for r in rows:
        if not isinstance(r, dict):
            continue
        rid = r.get("resource_id") or r.get("id") or r.get("name", "unknown")
        out.append(
            {
                "resource_id": str(rid),
                "resource_type": r.get("resource_type", "other"),
                "service": r.get("service", r.get("resource_type", "")),
                "name": r.get("name", str(rid)),
                "config": r.get("config") if isinstance(r.get("config"), dict) else {},
            }
        )
    return out


async def run(context: dict) -> dict:
    from llm import call_llm_async
    from rag.retriever import retrieve_for_agent

    raw_cfg = (context.get("gcp_config_raw") or "").strip()
    if not raw_cfg:
        context["gcp_inventory"] = list(_STUB_INVENTORY)
        return context

    rag_ctx = retrieve_for_agent("discovery", context)

    snippet = raw_cfg[:24_000]
    system = """You are a cloud discovery agent. Parse the user's infrastructure configuration
(Terraform HCL, YAML, or similar) and extract a structured list of GCP-like resources for migration planning.

Output ONLY valid JSON — no markdown. Use this shape:
{ "inventory": [
  {
    "resource_id": "unique-id",
    "resource_type": "compute_instance|cloud_sql|gcs_bucket|cloud_run|...",
    "service": "Human-readable GCP service name",
    "name": "display name",
    "config": { }
  }
]}

Infer resource_type from Terraform resource types (google_compute_instance -> compute_instance, etc.).
If the file is not GCP, still extract logical resources with best-effort typing."""

    if rag_ctx:
        system += f"\n\n### Reference:\n{rag_ctx}"

    user_msg = f"""Parse this configuration and return the inventory JSON:

```
{snippet}
```"""

    try:
        llm_out = await call_llm_async(
            messages=[{"role": "user", "content": user_msg}],
            system=system,
            max_tokens=8192,
            temperature=0.1,
        )
        parsed = _parse_json(llm_out or "")
        inv = None
        if isinstance(parsed, dict) and "inventory" in parsed:
            inv = parsed["inventory"]
        elif isinstance(parsed, list):
            inv = parsed
        if isinstance(inv, list) and len(inv) > 0:
            context["gcp_inventory"] = _normalize_inventory(inv)
            logger.info("Discovery: LLM extracted %d resources", len(context["gcp_inventory"]))
            return context
        logger.warning("Discovery: unexpected LLM structure, using stub inventory")
    except Exception as e:
        logger.warning("Discovery LLM failed, using stub: %s", e)

    context["gcp_inventory"] = list(_STUB_INVENTORY)
    return context
