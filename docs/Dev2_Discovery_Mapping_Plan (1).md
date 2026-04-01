# Dev 2 — Discovery + Mapping Agents: Master Implementation Plan

**Project:** RADCloud  
**Role:** Discovery Agent + Mapping Agent  
**Time Budget:** 24 hours  
**Stack:** Python, Claude API (claude-sonnet-4-20250514), JSON mapping tables  
**Dependencies:** None inbound. Dev 1 (Orchestrator), Dev 3 (FinOps), and Dev 4 (Risk + Runbook) all depend on your output.

---

## Your Responsibility in One Line

You turn raw GCP infrastructure config into a structured inventory and then translate it into a complete AWS architecture. Every other agent downstream depends on your output being correct and well-structured.

---

## What You Produce

| Agent | Input | Output (context key) | Who consumes it |
|-------|-------|---------------------|-----------------|
| Discovery | `gcp_config_raw` (Terraform/YAML string) | `gcp_inventory` | Mapping Agent, Risk Agent, Runbook Agent |
| Mapping | `gcp_inventory` | `aws_mapping` + `aws_architecture` | Risk Agent, FinOps Agent, Runbook Agent, Frontend |

You are the first two agents in the pipeline. If your output schema is wrong or incomplete, every downstream agent breaks. Get the schema right in hour 0–1 and don't change it after hour 4.

---

## Hour-by-Hour Execution Plan

### Hour 0–1: Kickoff + Schema Alignment

This is shared time with the full team. Your priority in this hour:

- Lock down the `gcp_inventory` schema with the team. Every downstream dev needs to know exactly what fields they'll get. Proposed schema:

```json
{
  "gcp_inventory": [
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
        "os": "ubuntu-2204-lts",
        "network": "default",
        "public_ip": true,
        "labels": {"env": "production", "team": "backend"}
      }
    }
  ]
}
```

- Lock down the `aws_mapping` schema:

```json
{
  "aws_mapping": [
    {
      "gcp_resource_id": "web-server-1",
      "gcp_service": "Compute Engine",
      "gcp_type": "compute_instance",
      "gcp_config_summary": "n1-standard-4, us-central1, 100GB SSD",
      "aws_service": "EC2",
      "aws_type": "instance",
      "aws_config": {
        "instance_type": "m5.xlarge",
        "region": "us-east-1",
        "ebs_size_gb": 100,
        "ebs_type": "gp3",
        "ami": "ubuntu-22.04",
        "vpc": "main-vpc",
        "public_ip": true
      },
      "mapping_confidence": "direct",
      "gap_flag": false,
      "gap_notes": null
    }
  ],
  "aws_architecture": {
    "summary": "Narrative description of the target AWS architecture...",
    "services_used": ["EC2", "RDS", "S3", "Lambda", "SQS"],
    "networking": {
      "vpc_count": 1,
      "subnet_strategy": "public + private per AZ",
      "security_groups": ["web-sg", "db-sg", "lambda-sg"]
    },
    "total_resources": 15,
    "direct_mappings": 12,
    "partial_mappings": 2,
    "no_equivalent": 1
  }
}
```

- Confirm with Dev 3 (FinOps) that `aws_mapping` contains enough info for cost estimation — they need `aws_config.instance_type`, `aws_config.region`, etc.
- Confirm with Dev 4 (Risk) that `mapping_confidence` and `gap_flag` fields are present — they build their risk scoring on these.

### Hours 1–4: Build the Discovery Agent

**This is a Claude-powered parser.** You're not writing a full Terraform parser — you're using Claude to extract structured data from messy infrastructure config.

**Step 1 — The GCP service registry (hardcoded reference)**

Create a JSON file listing all GCP services you support, so Claude knows what to look for:

```python
# agents/gcp_services.py

GCP_SERVICES = {
    "compute_instance": {
        "service": "Compute Engine",
        "terraform_type": "google_compute_instance",
        "key_config_fields": ["machine_type", "zone", "boot_disk", "network_interface", "labels"]
    },
    "cloud_sql": {
        "service": "Cloud SQL",
        "terraform_type": "google_sql_database_instance",
        "key_config_fields": ["database_version", "tier", "region", "disk_size", "disk_type", "availability_type"]
    },
    "gcs_bucket": {
        "service": "Cloud Storage",
        "terraform_type": "google_storage_bucket",
        "key_config_fields": ["location", "storage_class", "versioning", "lifecycle_rule"]
    },
    "cloud_run": {
        "service": "Cloud Run",
        "terraform_type": "google_cloud_run_service",
        "key_config_fields": ["location", "template.spec.containers", "traffic"]
    },
    "cloud_function": {
        "service": "Cloud Functions",
        "terraform_type": "google_cloudfunctions_function",
        "key_config_fields": ["runtime", "entry_point", "trigger_http", "available_memory_mb", "region"]
    },
    "pubsub_topic": {
        "service": "Pub/Sub",
        "terraform_type": "google_pubsub_topic",
        "key_config_fields": ["name", "message_retention_duration"]
    },
    "pubsub_subscription": {
        "service": "Pub/Sub",
        "terraform_type": "google_pubsub_subscription",
        "key_config_fields": ["topic", "ack_deadline_seconds", "push_config"]
    },
    "bigquery_dataset": {
        "service": "BigQuery",
        "terraform_type": "google_bigquery_dataset",
        "key_config_fields": ["location", "default_table_expiration_ms"]
    },
    "bigquery_table": {
        "service": "BigQuery",
        "terraform_type": "google_bigquery_table",
        "key_config_fields": ["dataset_id", "schema", "time_partitioning", "clustering"]
    },
    "vpc_network": {
        "service": "VPC",
        "terraform_type": "google_compute_network",
        "key_config_fields": ["auto_create_subnetworks", "routing_mode"]
    },
    "vpc_subnet": {
        "service": "VPC",
        "terraform_type": "google_compute_subnetwork",
        "key_config_fields": ["ip_cidr_range", "region", "network", "private_ip_google_access"]
    },
    "firewall_rule": {
        "service": "VPC Firewall",
        "terraform_type": "google_compute_firewall",
        "key_config_fields": ["network", "direction", "allow", "deny", "source_ranges", "target_tags"]
    },
    "cloud_dns_zone": {
        "service": "Cloud DNS",
        "terraform_type": "google_dns_managed_zone",
        "key_config_fields": ["dns_name", "visibility"]
    },
    "memorystore_redis": {
        "service": "Memorystore",
        "terraform_type": "google_redis_instance",
        "key_config_fields": ["tier", "memory_size_gb", "region", "redis_version"]
    },
    "iam_binding": {
        "service": "IAM",
        "terraform_type": "google_project_iam_binding",
        "key_config_fields": ["role", "members"]
    },
    "service_account": {
        "service": "IAM",
        "terraform_type": "google_service_account",
        "key_config_fields": ["account_id", "display_name"]
    },
    "spanner_instance": {
        "service": "Cloud Spanner",
        "terraform_type": "google_spanner_instance",
        "key_config_fields": ["config", "num_nodes", "display_name"]
    },
    "dataflow_job": {
        "service": "Dataflow",
        "terraform_type": "google_dataflow_job",
        "key_config_fields": ["template_gcs_path", "parameters", "region", "machine_type"]
    },
}
```

**Step 2 — The Discovery Agent with Claude**

```python
# agents/discovery.py
import json

DISCOVERY_SYSTEM_PROMPT = """You are a GCP infrastructure analyst. You will receive raw infrastructure configuration (Terraform HCL, YAML, or gcloud CLI output). Your job is to extract every GCP resource into a structured inventory.

For each resource, extract:
- resource_id: unique identifier from the config
- resource_type: one of the known types (compute_instance, cloud_sql, gcs_bucket, cloud_run, cloud_function, pubsub_topic, pubsub_subscription, bigquery_dataset, bigquery_table, vpc_network, vpc_subnet, firewall_rule, cloud_dns_zone, memorystore_redis, iam_binding, service_account, spanner_instance, dataflow_job)
- service: the GCP service name
- name: human-readable name
- config: dict of configuration details relevant to migration (machine type, region, disk size, etc.)

If you encounter a resource type not in the known list, still include it with resource_type set to "other" and capture what you can.

Respond ONLY with a JSON array. No markdown, no explanation, no backticks."""

async def run(context: dict, claude_client) -> dict:
    gcp_config = context.get("gcp_config_raw", "")

    if not gcp_config.strip():
        context["gcp_inventory"] = []
        context["errors"] = context.get("errors", []) + [{
            "agent": "discovery",
            "error": "No GCP config provided"
        }]
        return context

    response = claude_client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        temperature=0,
        system=DISCOVERY_SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": f"Extract all GCP resources from this infrastructure config:\n\n{gcp_config}"
        }]
    )

    raw_text = response.content[0].text.strip()
    # Clean potential markdown fencing
    if raw_text.startswith("```"):
        raw_text = raw_text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    try:
        inventory = json.loads(raw_text)
    except json.JSONDecodeError:
        context["gcp_inventory"] = []
        context["errors"] = context.get("errors", []) + [{
            "agent": "discovery",
            "error": "Failed to parse Claude response as JSON"
        }]
        return context

    context["gcp_inventory"] = inventory
    return context
```

**Step 3 — Test with sample Terraform**

Don't wait for Dev 4's sample data. Write a minimal test Terraform file yourself:

```hcl
resource "google_compute_instance" "web_server" {
  name         = "web-server-1"
  machine_type = "n1-standard-4"
  zone         = "us-central1-a"
  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2204-lts"
      size  = 100
      type  = "pd-ssd"
    }
  }
  network_interface {
    network    = google_compute_network.main.id
    access_config {}
  }
}

resource "google_sql_database_instance" "main_db" {
  name             = "main-db"
  database_version = "POSTGRES_14"
  region           = "us-central1"
  settings {
    tier            = "db-n1-standard-2"
    disk_size       = 50
    disk_type       = "PD_SSD"
    availability_type = "REGIONAL"
  }
}

resource "google_storage_bucket" "assets" {
  name          = "app-assets-bucket"
  location      = "US"
  storage_class = "STANDARD"
  versioning { enabled = true }
}

resource "google_cloud_run_service" "api" {
  name     = "api-service"
  location = "us-central1"
  template {
    spec {
      containers {
        image = "gcr.io/my-project/api:latest"
        resources {
          limits = { memory = "512Mi", cpu = "1" }
        }
      }
    }
  }
}

resource "google_compute_network" "main" {
  name                    = "main-vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "private" {
  name          = "private-subnet"
  ip_cidr_range = "10.0.1.0/24"
  region        = "us-central1"
  network       = google_compute_network.main.id
}

resource "google_compute_firewall" "allow_http" {
  name    = "allow-http"
  network = google_compute_network.main.name
  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }
  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["web"]
}
```

Run the Discovery Agent against this. Verify the JSON output has all 7 resources with correct types and configs. Fix the prompt until it works reliably.

**Deliverable by hour 4:** Discovery Agent that takes any Terraform/YAML string and returns a structured `gcp_inventory` JSON array.

### Hours 4–8: Build the Mapping Agent

**This is the hardest part of your workstream.** The mapping agent needs two things: a hardcoded mapping table for deterministic service translations, and Claude for intelligent config translation and architecture narrative generation.

**Step 1 — The GCP-to-AWS mapping table**

```python
# agents/aws_mapping_table.py

SERVICE_MAP = {
    "compute_instance": {
        "aws_service": "EC2",
        "aws_type": "instance",
        "confidence": "direct",
        "notes": "Direct equivalent. Map machine types to instance types."
    },
    "cloud_sql": {
        "aws_service": "RDS",
        "aws_type": "db_instance",
        "confidence": "direct",
        "notes": "Direct equivalent. Supports same engines (PostgreSQL, MySQL)."
    },
    "gcs_bucket": {
        "aws_service": "S3",
        "aws_type": "bucket",
        "confidence": "direct",
        "notes": "Direct equivalent. Map storage classes."
    },
    "cloud_run": {
        "aws_service": "ECS Fargate",
        "aws_type": "service",
        "confidence": "direct",
        "notes": "Closest equivalent for serverless containers. Alternative: App Runner."
    },
    "cloud_function": {
        "aws_service": "Lambda",
        "aws_type": "function",
        "confidence": "direct",
        "notes": "Direct equivalent. Check runtime compatibility."
    },
    "pubsub_topic": {
        "aws_service": "SNS",
        "aws_type": "topic",
        "confidence": "direct",
        "notes": "SNS for fan-out. If queue semantics needed, pair with SQS."
    },
    "pubsub_subscription": {
        "aws_service": "SQS",
        "aws_type": "queue",
        "confidence": "direct",
        "notes": "SQS for pull-based subscriptions. SNS+SQS for push."
    },
    "bigquery_dataset": {
        "aws_service": "Redshift Serverless / Athena",
        "aws_type": "namespace / database",
        "confidence": "partial",
        "notes": "No single direct equivalent. Athena for ad-hoc queries, Redshift for data warehouse. Evaluate workload."
    },
    "bigquery_table": {
        "aws_service": "Redshift Serverless / Athena",
        "aws_type": "table",
        "confidence": "partial",
        "notes": "Partitioning and clustering translate differently."
    },
    "vpc_network": {
        "aws_service": "VPC",
        "aws_type": "vpc",
        "confidence": "direct",
        "notes": "Direct equivalent. GCP auto-mode subnets have no AWS equivalent — must define subnets explicitly."
    },
    "vpc_subnet": {
        "aws_service": "VPC",
        "aws_type": "subnet",
        "confidence": "direct",
        "notes": "Direct equivalent. Map CIDR ranges."
    },
    "firewall_rule": {
        "aws_service": "VPC Security Groups + NACLs",
        "aws_type": "security_group_rule",
        "confidence": "partial",
        "notes": "GCP firewall rules are network-level with tags. AWS uses security groups (instance-level) + NACLs (subnet-level). Requires rethinking."
    },
    "cloud_dns_zone": {
        "aws_service": "Route 53",
        "aws_type": "hosted_zone",
        "confidence": "direct",
        "notes": "Direct equivalent."
    },
    "memorystore_redis": {
        "aws_service": "ElastiCache",
        "aws_type": "redis_cluster",
        "confidence": "direct",
        "notes": "Direct equivalent. Map tier and node type."
    },
    "iam_binding": {
        "aws_service": "IAM",
        "aws_type": "policy_attachment",
        "confidence": "partial",
        "notes": "GCP uses project-level role bindings. AWS uses policy-based IAM with users/roles/groups. Requires IAM redesign."
    },
    "service_account": {
        "aws_service": "IAM",
        "aws_type": "role",
        "confidence": "partial",
        "notes": "GCP service accounts map to AWS IAM roles with trust policies. Not a 1:1 mapping."
    },
    "spanner_instance": {
        "aws_service": "Aurora Global Database",
        "aws_type": "cluster",
        "confidence": "partial",
        "notes": "No direct equivalent. Aurora Global is closest for multi-region relational. DynamoDB Global Tables for NoSQL use cases. Significant rearchitecting required."
    },
    "dataflow_job": {
        "aws_service": "AWS Glue / EMR / Kinesis Data Analytics",
        "aws_type": "job",
        "confidence": "partial",
        "notes": "Depends on whether batch or streaming. Glue for batch ETL, Kinesis for streaming. May require code rewrite from Apache Beam."
    },
}
```

**Step 2 — GCP machine type to AWS instance type mapping**

```python
# agents/instance_mapping.py

MACHINE_TYPE_MAP = {
    # General purpose
    "n1-standard-1":  "m5.large",
    "n1-standard-2":  "m5.large",
    "n1-standard-4":  "m5.xlarge",
    "n1-standard-8":  "m5.2xlarge",
    "n1-standard-16": "m5.4xlarge",
    "n1-standard-32": "m5.8xlarge",
    "n1-standard-64": "m5.16xlarge",
    "n2-standard-2":  "m6i.large",
    "n2-standard-4":  "m6i.xlarge",
    "n2-standard-8":  "m6i.2xlarge",
    "n2-standard-16": "m6i.4xlarge",
    "n2-standard-32": "m6i.8xlarge",
    "e2-micro":       "t3.micro",
    "e2-small":       "t3.small",
    "e2-medium":      "t3.medium",
    "e2-standard-2":  "t3.large",
    "e2-standard-4":  "t3.xlarge",
    "e2-standard-8":  "t3.2xlarge",
    # High memory
    "n1-highmem-2":   "r5.large",
    "n1-highmem-4":   "r5.xlarge",
    "n1-highmem-8":   "r5.2xlarge",
    "n1-highmem-16":  "r5.4xlarge",
    "n2-highmem-2":   "r6i.large",
    "n2-highmem-4":   "r6i.xlarge",
    # High CPU
    "n1-highcpu-2":   "c5.large",
    "n1-highcpu-4":   "c5.xlarge",
    "n1-highcpu-8":   "c5.2xlarge",
    "n2-highcpu-2":   "c6i.large",
    "n2-highcpu-4":   "c6i.xlarge",
    # Cloud SQL tiers
    "db-f1-micro":    "db.t3.micro",
    "db-g1-small":    "db.t3.small",
    "db-n1-standard-1": "db.m5.large",
    "db-n1-standard-2": "db.m5.xlarge",
    "db-n1-standard-4": "db.m5.2xlarge",
    "db-n1-standard-8": "db.m5.4xlarge",
    "db-n1-highmem-2":  "db.r5.large",
    "db-n1-highmem-4":  "db.r5.xlarge",
}

REGION_MAP = {
    "us-central1":    "us-east-1",
    "us-east1":       "us-east-1",
    "us-east4":       "us-east-2",
    "us-west1":       "us-west-2",
    "us-west2":       "us-west-1",
    "europe-west1":   "eu-west-1",
    "europe-west2":   "eu-west-2",
    "europe-west3":   "eu-central-1",
    "asia-east1":     "ap-northeast-1",
    "asia-southeast1":"ap-southeast-1",
    "asia-south1":    "ap-south-1",
    "australia-southeast1": "ap-southeast-2",
}

STORAGE_CLASS_MAP = {
    "STANDARD":       "STANDARD",
    "NEARLINE":       "STANDARD_IA",
    "COLDLINE":       "GLACIER_IR",
    "ARCHIVE":        "GLACIER_DEEP_ARCHIVE",
}

DISK_TYPE_MAP = {
    "pd-standard":    "gp2",
    "pd-ssd":         "gp3",
    "pd-balanced":    "gp3",
    "pd-extreme":     "io2",
}
```

**Step 3 — The Mapping Agent**

Two-phase approach: first do deterministic mapping from your tables, then use Claude to fill in gaps and generate the architecture narrative.

```python
# agents/mapping.py
import json
from agents.aws_mapping_table import SERVICE_MAP
from agents.instance_mapping import MACHINE_TYPE_MAP, REGION_MAP, STORAGE_CLASS_MAP, DISK_TYPE_MAP

MAPPING_SYSTEM_PROMPT = """You are an AWS solutions architect. You will receive:
1. A GCP resource inventory (JSON)
2. A preliminary GCP-to-AWS mapping (JSON) with some config fields already translated

Your job:
1. Review each mapping. Fill in any missing aws_config fields using your knowledge of AWS best practices.
2. For resources with confidence "partial" or "none", suggest the best AWS alternative and explain trade-offs in gap_notes.
3. Generate an aws_architecture object that describes the overall AWS target architecture as a coherent design — not just a list of services, but how they connect (VPC topology, security groups, IAM structure, data flow).

Respond ONLY with a JSON object containing two keys:
- "mappings": the updated mapping array
- "architecture": an object with "summary" (string, 2-3 paragraphs), "services_used" (array of AWS service names), "networking" (object with vpc_count, subnet_strategy, security_groups), "total_resources" (int), "direct_mappings" (int), "partial_mappings" (int), "no_equivalent" (int)

No markdown, no backticks, no explanation outside the JSON."""

async def run(context: dict, claude_client) -> dict:
    inventory = context.get("gcp_inventory", [])
    if not inventory:
        context["aws_mapping"] = []
        context["aws_architecture"] = {"summary": "No GCP resources found to map.", "services_used": [], "total_resources": 0, "direct_mappings": 0, "partial_mappings": 0, "no_equivalent": 0}
        return context

    # Phase 1: Deterministic mapping
    preliminary_mappings = []
    for resource in inventory:
        rtype = resource.get("resource_type", "other")
        config = resource.get("config", {})
        smap = SERVICE_MAP.get(rtype, {
            "aws_service": "Unknown",
            "aws_type": "unknown",
            "confidence": "none",
            "notes": "No known AWS equivalent in mapping table."
        })

        aws_config = {}

        # Translate known config fields
        if machine_type := config.get("machine_type") or config.get("tier"):
            aws_config["instance_type"] = MACHINE_TYPE_MAP.get(machine_type, f"UNMAPPED:{machine_type}")
        if region := config.get("region") or config.get("zone", "")[:config.get("zone", "").rfind("-")] if config.get("zone") else config.get("location"):
            if isinstance(region, str):
                # Extract region from zone (e.g., "us-central1-a" -> "us-central1")
                if len(region.split("-")) > 2 and region[-1].isalpha() and len(region.split("-")[-1]) == 1:
                    region = region.rsplit("-", 1)[0]
                aws_config["region"] = REGION_MAP.get(region, "us-east-1")
        if storage_class := config.get("storage_class"):
            aws_config["storage_class"] = STORAGE_CLASS_MAP.get(storage_class, storage_class)
        if disk_type := config.get("disk_type"):
            aws_config["ebs_type"] = DISK_TYPE_MAP.get(disk_type, "gp3")
        if disk_size := config.get("disk_size_gb") or config.get("disk_size"):
            aws_config["ebs_size_gb"] = disk_size

        preliminary_mappings.append({
            "gcp_resource_id": resource.get("resource_id", resource.get("name", "unknown")),
            "gcp_service": resource.get("service", rtype),
            "gcp_type": rtype,
            "gcp_config_summary": json.dumps(config)[:200],
            "aws_service": smap["aws_service"],
            "aws_type": smap["aws_type"],
            "aws_config": aws_config,
            "mapping_confidence": smap["confidence"],
            "gap_flag": smap["confidence"] != "direct",
            "gap_notes": smap["notes"] if smap["confidence"] != "direct" else None,
        })

    # Phase 2: Claude enrichment
    response = claude_client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        temperature=0,
        system=MAPPING_SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": f"GCP Inventory:\n{json.dumps(inventory, indent=2)}\n\nPreliminary Mapping:\n{json.dumps(preliminary_mappings, indent=2)}"
        }]
    )

    raw_text = response.content[0].text.strip()
    if raw_text.startswith("```"):
        raw_text = raw_text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    try:
        result = json.loads(raw_text)
        context["aws_mapping"] = result.get("mappings", preliminary_mappings)
        context["aws_architecture"] = result.get("architecture", {})
    except json.JSONDecodeError:
        # Fall back to preliminary mappings if Claude response can't be parsed
        context["aws_mapping"] = preliminary_mappings
        context["aws_architecture"] = {
            "summary": "Architecture narrative generation failed. See individual mappings for details.",
            "services_used": list(set(m["aws_service"] for m in preliminary_mappings)),
            "total_resources": len(preliminary_mappings),
            "direct_mappings": sum(1 for m in preliminary_mappings if m["mapping_confidence"] == "direct"),
            "partial_mappings": sum(1 for m in preliminary_mappings if m["mapping_confidence"] == "partial"),
            "no_equivalent": sum(1 for m in preliminary_mappings if m["mapping_confidence"] == "none"),
        }

    return context
```

**Step 4 — Test end-to-end**

Run Discovery → Mapping on your test Terraform. Verify:
- Every GCP resource has a mapping entry.
- `mapping_confidence` is correct (direct, partial, or none).
- `gap_flag` is True for anything non-direct.
- `aws_architecture.summary` reads like a real architecture description, not a list of services.
- Instance types, regions, and storage classes are correctly translated.

**Deliverable by hour 8:** Both agents working end-to-end. Given a Terraform file, you produce a structured GCP inventory and a complete AWS mapping with architecture narrative.

### Hours 8–12: Integration with Orchestrator

- Push your agent files to the repo: `agents/discovery.py`, `agents/mapping.py`, `agents/aws_mapping_table.py`, `agents/instance_mapping.py`, `agents/gcp_services.py`.
- Work with Dev 1 to wire your agents into the orchestrator pipeline replacing their stubs.
- Test with the frontend: paste Terraform → click Analyze → see Asset Map tab and Architecture tab populated.
- Debug issues:
  - Claude returning malformed JSON → tighten the prompt, add retry logic.
  - Missing fields in output → add defaults in the agent or the frontend.
  - Region mapping gaps → add more entries to REGION_MAP.
- Run the full pipeline with Dev 4's sample data (the realistic 10–15 resource Terraform). Fix any resource types you missed.

**Common integration bugs to watch for:**
- Your agent reads `context["gcp_config_raw"]` but Dev 1 sends it as `context["terraform_config"]` → align key names.
- Your agent returns a modified context but accidentally drops keys written by previous agents → always use `context["key"] = value`, never `context = {"key": value}`.
- Claude response includes markdown code fences despite the prompt saying not to → the cleanup code in Step 3 handles this, but verify it works.

### Hours 12–16: Robustness + Edge Cases

Now make it handle real-world messiness:

**YAML config support:**
- Claude can already parse YAML. Test with a YAML equivalent of your Terraform sample. The Discovery prompt handles both formats — verify it works.

**Partial/incomplete configs:**
- What if the Terraform has a resource with no region specified? Default to us-central1 → us-east-1.
- What if a machine type isn't in your mapping table? Use Claude to suggest the closest match and set confidence to "partial".

**Large configs:**
- If the Terraform is very long (>50 resources), Claude's response might get truncated. Handle this by chunking: split the input into groups of 15–20 resources, run Discovery on each chunk, merge results.

**Retry logic:**
- Add a simple retry wrapper for Claude API calls: retry up to 2 times with 2-second delay on failure.

```python
import asyncio

async def call_claude_with_retry(claude_client, messages, system, max_retries=2):
    for attempt in range(max_retries + 1):
        try:
            response = claude_client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=4096,
                temperature=0,
                system=system,
                messages=messages,
            )
            return response
        except Exception as e:
            if attempt == max_retries:
                raise
            await asyncio.sleep(2)
```

### Hours 16–20: Polish + Demo Support

- Review the Architecture tab output with Dev 1. Is the narrative readable? Does it make sense for the demo? Tweak the Claude prompt to produce better prose if needed.
- Make sure the mapping table in the frontend looks clean: GCP service → AWS service, with color-coded confidence badges (green/yellow/red).
- Help Dev 1 build the "Try Sample Data" cached response by running a clean end-to-end pass with the demo data and saving the output.
- Review the demo script. Your output appears in two tabs (Asset Map and Architecture) — make sure you can explain what judges are seeing.

### Hours 20–24: Buffer

- Fix any bugs found during demo rehearsal.
- Do NOT add new service mappings or features.
- Be available to help other devs if their agents produce output that doesn't play well with your mapping schema.

---

## Files You Own

| File | Purpose |
|------|---------|
| `agents/discovery.py` | Discovery Agent — GCP config → structured inventory |
| `agents/mapping.py` | Mapping Agent — GCP inventory → AWS architecture |
| `agents/gcp_services.py` | Registry of supported GCP service types |
| `agents/aws_mapping_table.py` | GCP service → AWS service mapping with confidence levels |
| `agents/instance_mapping.py` | Machine types, regions, storage classes, disk types |

---

## Gotchas and Failure Modes

**Claude returns different JSON structures on different runs.**
Fix: Be very explicit in the system prompt about the exact JSON schema. Add a JSON schema example in the prompt. Set temperature to 0.

**A GCP resource type you haven't seen appears in the Terraform.**
Fix: The Discovery prompt already handles this with the "other" fallback. The Mapping table has a default "Unknown" entry. Claude will attempt a best-guess mapping. This is good enough for a hackathon.

**The Terraform file uses modules or remote state references.**
Fix: Don't try to resolve modules. Tell Claude in the prompt: "If the config uses Terraform modules, extract the module source and any visible parameters, but do not attempt to resolve the module contents. List it as resource_type 'terraform_module'."

**Mapping table says "direct" but the config translation is wrong.**
Fix: The deterministic mapping handles the service-level mapping. Claude handles the config-level translation in Phase 2. If Claude gets a config detail wrong, it's still a reasonable demo. Don't over-optimize config accuracy — the service-level mapping is what judges care about.

---

## What to Cut If Behind

1. **Cut YAML support** — only support Terraform. Mention YAML support as a "coming soon" in the demo.
2. **Cut the architecture narrative** — just return the mapping table. The Architecture tab can show the table without the prose summary.
3. **Cut the less common services** (Spanner, Dataflow) — focus on the 10 most common: Compute, Cloud SQL, GCS, Cloud Run, Functions, Pub/Sub, BigQuery, VPC, Firewall, IAM.
4. **Never cut the mapping table** — this is your core deliverable. Without it, Dev 3 and Dev 4 have nothing to work with.
5. **Never cut the gap flags** — judges want to see that the tool identifies what doesn't translate cleanly. That's what makes it credible.
