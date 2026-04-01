# Dev 4 — Risk Agent + Watchdog / Runbook / IaC + Demo Data: Master Implementation Plan

**Project:** RADCloud  
**Role:** Risk Agent, Watchdog Agent, Runbook + IaC Generator, Demo Data Architect  
**Time Budget:** 24 hours  
**Stack:** Python, AWS Bedrock (Claude) via `backend/llm.py`  
**Dependencies inbound:** `gcp_inventory` and `aws_mapping` from Dev 2 (available after hour 8). You can build risk templates and the runbook structure independently before then.  
**Dependencies outbound:** Dev 1 (Frontend) renders your risk report, runbook, watchdog, and IaC tabs. Dev 3 (FinOps) uses your sample billing CSV. Everyone uses your sample Terraform for the demo.

> **LLM inference (platform standard):** Risk, runbook, and Watchdog LLM steps use **Claude on Amazon Bedrock** only. Implement via `backend/llm.py` (`call_llm_async`); model ID in `backend/config.py`. Agent signature: `async def run(context: dict) -> dict`. Example code using `claude_client` in this document should be translated to Bedrock calls consistent with `llm.py`.

---

## Your Responsibility in One Line

You make the migration plan credible and you own the demo data. The Risk Agent tells organizations what will go wrong. The Watchdog layer tells them what happens after migration. The Runbook and IaC outputs tell them how to execute safely. And the sample data you create is what the judges will actually see — bad sample data kills the entire demo.

---

## Product Parity Requirements

The website's fifth agent is **Watchdog**, not a generic "runbook" step. In this plan, Watchdog is the final agent that emits:

- `runbook`
- `watchdog`
- `iac_bundle`

This is how the product closes the loop from assessment to execution to post-migration optimization. If these outputs are missing, the product does not match the website story.

---

## What You Produce

| Output | Context key | Who consumes it |
|--------|------------|-----------------|
| Risk report | `risks` | Frontend Risks tab, Watchdog Agent |
| Migration runbook | `runbook` | Frontend Runbook tab |
| Watchdog dashboard payload | `watchdog` | Frontend Watchdog tab |
| Generated AWS Terraform / IaC bundle | `iac_bundle` | Frontend IaC Output tab |
| Sample Terraform file | `data/sample.tf` | Everyone (demo input) |
| Sample billing CSV | `data/sample_billing.csv` | Dev 3 FinOps Agent (demo input) |

You have a unique multi-part role: risk analysis, Watchdog outputs, and all the demo data. The demo data is arguably more important than the agents — if the sample data is bad, every agent produces bad output and the demo falls flat.

---

## Hour-by-Hour Execution Plan

### Hour 0–1: Kickoff + Schema Alignment

Shared time with the full team. Your priorities:

- Lock down the `risks` output schema:

```json
{
  "risks": [
    {
      "id": "RISK-001",
      "category": "service_compatibility",
      "severity": "high",
      "title": "Cloud Spanner has no direct AWS equivalent",
      "description": "Cloud Spanner is a globally distributed relational database with automatic horizontal scaling. AWS has no single service with identical capabilities.",
      "affected_resources": ["spanner-instance-1"],
      "aws_alternative": "Aurora Global Database (partial match) or DynamoDB Global Tables (for NoSQL use cases)",
      "migration_impact": "Requires application-level changes. Query patterns may need restructuring.",
      "mitigation": "Evaluate workload: if strong consistency + relational required, use Aurora Global. If eventual consistency acceptable, consider DynamoDB. Budget 2-3 weeks for data layer rearchitecting.",
      "estimated_effort_days": 15
    }
  ],
  "risk_summary": {
    "total_risks": 8,
    "high": 2,
    "medium": 4,
    "low": 2,
    "top_risk": "Cloud Spanner migration requires significant rearchitecting",
    "overall_assessment": "Migration is feasible with moderate risk. Two high-severity items require upfront architectural decisions before migration begins."
  }
}
```

- Lock down the `runbook` output schema:

```json
{
  "runbook": {
    "title": "GCP to AWS Migration Runbook",
    "estimated_total_duration": "8-12 weeks",
    "phases": [
      {
        "phase_number": 1,
        "name": "Pre-Migration",
        "duration": "1-2 weeks",
        "steps": [
          {
            "step_number": 1,
            "action": "Set up AWS landing zone with VPC, subnets, and security groups matching the target architecture",
            "responsible": "Cloud Infrastructure Team",
            "estimated_hours": 16,
            "dependencies": [],
            "rollback": "Delete AWS VPC and associated resources",
            "notes": "Use the networking topology from the Architecture output as the blueprint"
          }
        ]
      }
    ],
    "rollback_plan": "Full rollback strategy summary...",
    "success_criteria": ["All services responding on AWS endpoints", "Data integrity verified", "Latency within 10% of GCP baseline"]
  }
}
```

- Lock down the `watchdog` + `iac_bundle` output schema:

```json
{
  "watchdog": {
    "status": "active",
    "scan_frequency": "15m",
    "projected_monthly_aws_spend": 6830.00,
    "projected_annual_savings": 47200.00,
    "active_agents": ["risk", "finops", "watchdog"],
    "anomaly_threshold_pct": 12,
    "optimization_opportunities": [
      {
        "title": "Right-size EC2 instances",
        "impact": "high",
        "estimated_monthly_savings": 1180.00,
        "confidence": 0.97,
        "auto_fix_mode": "suggested"
      }
    ],
    "auto_remediation_pipeline": [
      {"stage": "detect", "description": "Watchdog scans spend, utilization, and drift."},
      {"stage": "evaluate", "description": "Risk rules validate blast radius and rollback safety."},
      {"stage": "apply", "description": "Recommended fix is generated or executed depending on mode."},
      {"stage": "verify", "description": "Post-change health and cost metrics are checked."}
    ]
  },
  "iac_bundle": {
    "format": "terraform",
    "mode": "generated_scaffold",
    "files": [
      {
        "path": "terraform/networking/main.tf",
        "description": "Target VPC and subnet layout"
      }
    ],
    "assumptions": ["us-east-1 target region", "module-based layout", "remote state in S3"],
    "deployment_notes": "Generated as a migration accelerator. Review before production apply."
  }
}
```

- Coordinate with Dev 3 on the billing CSV format — they need specific column names. Agree on: `Service description`, `SKU description`, `Usage start date`, `Usage end date`, `Usage amount`, `Usage unit`, `Cost ($)`.
- Coordinate with Dev 2 on what GCP services should be in the sample Terraform — they need it to test their Discovery + Mapping agents.

### Hours 1–5: Build the Demo Data (DO THIS FIRST)

**This is your highest-priority deliverable.** Every other dev needs sample data to test against. Ship this by hour 3–4 so the rest of the team can integrate.

**Step 1 — The sample Terraform file**

This must be realistic enough to impress judges but diverse enough to exercise all agents. Design a fictional mid-size SaaS company's GCP infrastructure.

```hcl
# data/sample.tf
# ============================================
# RADCloud Demo — "NovaPay" GCP Infrastructure
# A mid-size fintech SaaS platform
# ============================================

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = "novapay-production"
  region  = "us-central1"
}

# ---- NETWORKING ----

resource "google_compute_network" "main" {
  name                    = "novapay-vpc"
  auto_create_subnetworks = false
  routing_mode            = "GLOBAL"
}

resource "google_compute_subnetwork" "private_app" {
  name                     = "private-app-subnet"
  ip_cidr_range            = "10.0.1.0/24"
  region                   = "us-central1"
  network                  = google_compute_network.main.id
  private_ip_google_access = true
}

resource "google_compute_subnetwork" "private_data" {
  name                     = "private-data-subnet"
  ip_cidr_range            = "10.0.2.0/24"
  region                   = "us-central1"
  network                  = google_compute_network.main.id
  private_ip_google_access = true
}

resource "google_compute_subnetwork" "public" {
  name          = "public-subnet"
  ip_cidr_range = "10.0.0.0/24"
  region        = "us-central1"
  network       = google_compute_network.main.id
}

resource "google_compute_firewall" "allow_http" {
  name    = "allow-http-https"
  network = google_compute_network.main.name
  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }
  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["web-server"]
}

resource "google_compute_firewall" "allow_internal" {
  name    = "allow-internal"
  network = google_compute_network.main.name
  allow {
    protocol = "tcp"
    ports    = ["0-65535"]
  }
  allow {
    protocol = "udp"
    ports    = ["0-65535"]
  }
  source_ranges = ["10.0.0.0/16"]
}

# ---- COMPUTE ----

resource "google_compute_instance" "web_server_1" {
  name         = "web-server-1"
  machine_type = "n1-standard-4"
  zone         = "us-central1-a"
  tags         = ["web-server"]

  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2204-lts"
      size  = 100
      type  = "pd-ssd"
    }
  }

  network_interface {
    subnetwork = google_compute_subnetwork.public.id
    access_config {}
  }

  labels = {
    env  = "production"
    team = "platform"
    app  = "web-frontend"
  }
}

resource "google_compute_instance" "web_server_2" {
  name         = "web-server-2"
  machine_type = "n1-standard-4"
  zone         = "us-central1-b"
  tags         = ["web-server"]

  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2204-lts"
      size  = 100
      type  = "pd-ssd"
    }
  }

  network_interface {
    subnetwork = google_compute_subnetwork.public.id
    access_config {}
  }

  labels = {
    env  = "production"
    team = "platform"
    app  = "web-frontend"
  }
}

resource "google_compute_instance" "worker" {
  name         = "background-worker"
  machine_type = "n1-highmem-4"
  zone         = "us-central1-a"

  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2204-lts"
      size  = 200
      type  = "pd-standard"
    }
  }

  network_interface {
    subnetwork = google_compute_subnetwork.private_app.id
  }

  labels = {
    env  = "production"
    team = "data"
    app  = "payment-processor"
  }
}

# ---- DATABASE ----

resource "google_sql_database_instance" "primary" {
  name             = "novapay-primary-db"
  database_version = "POSTGRES_14"
  region           = "us-central1"

  settings {
    tier              = "db-n1-standard-4"
    disk_size         = 200
    disk_type         = "PD_SSD"
    availability_type = "REGIONAL"
    disk_autoresize   = true

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      start_time                     = "03:00"
    }

    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.main.id
    }

    database_flags {
      name  = "max_connections"
      value = "500"
    }
  }
}

resource "google_sql_database_instance" "read_replica" {
  name                 = "novapay-read-replica"
  database_version     = "POSTGRES_14"
  region               = "us-central1"
  master_instance_name = google_sql_database_instance.primary.name

  settings {
    tier      = "db-n1-standard-2"
    disk_size = 200
    disk_type = "PD_SSD"
  }
}

# ---- CACHE ----

resource "google_redis_instance" "session_cache" {
  name           = "session-cache"
  tier           = "STANDARD_HA"
  memory_size_gb = 4
  region         = "us-central1"

  redis_version = "REDIS_7_0"

  authorized_network = google_compute_network.main.id

  labels = {
    env = "production"
    app = "session-management"
  }
}

# ---- STORAGE ----

resource "google_storage_bucket" "app_assets" {
  name          = "novapay-app-assets"
  location      = "US"
  storage_class = "STANDARD"
  versioning {
    enabled = true
  }
  lifecycle_rule {
    action {
      type = "SetStorageClass"
      storage_class = "NEARLINE"
    }
    condition {
      age = 90
    }
  }
}

resource "google_storage_bucket" "data_archive" {
  name          = "novapay-data-archive"
  location      = "US"
  storage_class = "COLDLINE"
  lifecycle_rule {
    action {
      type = "SetStorageClass"
      storage_class = "ARCHIVE"
    }
    condition {
      age = 365
    }
  }
}

resource "google_storage_bucket" "ml_training_data" {
  name          = "novapay-ml-training"
  location      = "US"
  storage_class = "STANDARD"
}

# ---- SERVERLESS ----

resource "google_cloud_run_service" "payment_api" {
  name     = "payment-api"
  location = "us-central1"

  template {
    spec {
      containers {
        image = "gcr.io/novapay-production/payment-api:v2.4.1"
        resources {
          limits = {
            memory = "1Gi"
            cpu    = "2"
          }
        }
        env {
          name  = "DB_HOST"
          value = google_sql_database_instance.primary.private_ip_address
        }
      }
      container_concurrency = 80
    }

    metadata {
      annotations = {
        "autoscaling.knative.dev/minScale" = "2"
        "autoscaling.knative.dev/maxScale" = "20"
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }
}

resource "google_cloudfunctions_function" "fraud_detector" {
  name                  = "fraud-detection"
  runtime               = "python311"
  entry_point           = "detect_fraud"
  available_memory_mb   = 512
  timeout               = 60
  region                = "us-central1"

  event_trigger {
    event_type = "google.pubsub.topic.publish"
    resource   = google_pubsub_topic.transactions.name
  }

  environment_variables = {
    MODEL_BUCKET = google_storage_bucket.ml_training_data.name
  }
}

resource "google_cloudfunctions_function" "notification_sender" {
  name                  = "send-notifications"
  runtime               = "nodejs18"
  entry_point           = "sendNotification"
  available_memory_mb   = 256
  timeout               = 30
  region                = "us-central1"
  trigger_http          = true
}

# ---- MESSAGING ----

resource "google_pubsub_topic" "transactions" {
  name = "transaction-events"
  message_retention_duration = "86400s"
}

resource "google_pubsub_subscription" "fraud_check" {
  name  = "fraud-check-sub"
  topic = google_pubsub_topic.transactions.name

  ack_deadline_seconds = 30

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.dead_letters.id
    max_delivery_attempts = 5
  }
}

resource "google_pubsub_topic" "dead_letters" {
  name = "dead-letter-topic"
}

resource "google_pubsub_subscription" "analytics_pipeline" {
  name  = "analytics-pipeline-sub"
  topic = google_pubsub_topic.transactions.name

  ack_deadline_seconds = 60

  bigquery_config {
    table = "${google_bigquery_table.transactions.project}:${google_bigquery_dataset.analytics.dataset_id}.${google_bigquery_table.transactions.table_id}"
  }
}

# ---- ANALYTICS ----

resource "google_bigquery_dataset" "analytics" {
  dataset_id  = "novapay_analytics"
  location    = "US"
  description = "Core analytics dataset for transaction and user data"

  default_table_expiration_ms = 7776000000  # 90 days

  labels = {
    env  = "production"
    team = "data"
  }
}

resource "google_bigquery_table" "transactions" {
  dataset_id = google_bigquery_dataset.analytics.dataset_id
  table_id   = "raw_transactions"

  time_partitioning {
    type  = "DAY"
    field = "transaction_timestamp"
  }

  clustering = ["merchant_id", "payment_method"]

  schema = <<EOF
[
  {"name": "transaction_id", "type": "STRING", "mode": "REQUIRED"},
  {"name": "transaction_timestamp", "type": "TIMESTAMP", "mode": "REQUIRED"},
  {"name": "amount", "type": "NUMERIC", "mode": "REQUIRED"},
  {"name": "currency", "type": "STRING", "mode": "REQUIRED"},
  {"name": "merchant_id", "type": "STRING", "mode": "REQUIRED"},
  {"name": "payment_method", "type": "STRING", "mode": "REQUIRED"},
  {"name": "status", "type": "STRING", "mode": "REQUIRED"},
  {"name": "user_id", "type": "STRING", "mode": "REQUIRED"}
]
EOF
}

# ---- DNS ----

resource "google_dns_managed_zone" "primary" {
  name     = "novapay-zone"
  dns_name = "novapay.io."
}

# ---- IAM ----

resource "google_service_account" "app_sa" {
  account_id   = "novapay-app"
  display_name = "NovaPay Application Service Account"
}

resource "google_service_account" "data_sa" {
  account_id   = "novapay-data-pipeline"
  display_name = "NovaPay Data Pipeline Service Account"
}

resource "google_project_iam_binding" "app_storage" {
  project = "novapay-production"
  role    = "roles/storage.objectViewer"
  members = [
    "serviceAccount:${google_service_account.app_sa.email}",
  ]
}

resource "google_project_iam_binding" "data_bigquery" {
  project = "novapay-production"
  role    = "roles/bigquery.dataEditor"
  members = [
    "serviceAccount:${google_service_account.data_sa.email}",
  ]
}

resource "google_project_iam_binding" "data_storage" {
  project = "novapay-production"
  role    = "roles/storage.objectAdmin"
  members = [
    "serviceAccount:${google_service_account.data_sa.email}",
  ]
}
```

**Why this specific infrastructure:**
- **2 web servers + 1 worker** — gives Dev 3 steady-state compute for RI recommendations.
- **Primary DB + read replica** — realistic database setup, good RI candidate, triggers risk about failover.
- **Redis cache** — another RI candidate, adds variety.
- **3 storage buckets with lifecycle rules** — tests storage class mapping.
- **Cloud Run + 2 Cloud Functions** — serverless, tests bursty vs. event-driven pattern detection.
- **Pub/Sub with dead letters + BigQuery subscription** — complex messaging topology that triggers risk flags (BigQuery subscription has no direct AWS equivalent).
- **BigQuery with partitioning/clustering** — partial mapping triggers a risk.
- **IAM bindings + service accounts** — triggers the IAM model risk (GCP project-level vs. AWS policy-based).
- **Firewall rules** — triggers the security group translation risk.
- **DNS zone** — simple direct mapping, rounds out the inventory.

Total: ~30 resources. Diverse enough to exercise every agent. Realistic enough to impress judges.

**Step 2 — The sample billing CSV**

This must match the Terraform infrastructure and produce compelling FinOps numbers. Coordinate closely with Dev 3.

```python
# scripts/generate_billing.py
import csv
import random
import math
from datetime import datetime, timedelta

random.seed(42)  # reproducible data

SERVICES = [
    # (service, sku, unit, base_monthly_usage, unit_cost, pattern)
    # Compute — steady state
    ("Compute Engine", "N1 Standard 4 Instance Core running", "hour", 1440, 0.1900, "steady"),       # 2 instances × 720 hrs
    ("Compute Engine", "N1 Highmem 4 Instance Core running", "hour", 720, 0.2508, "steady"),          # 1 worker
    ("Compute Engine", "SSD backed PD Capacity", "gibibyte month", 400, 0.170, "steady"),             # disk
    ("Compute Engine", "Network Egress via Carrier Peering", "gibibyte", 250, 0.085, "steady"),       # egress

    # Cloud SQL — steady state
    ("Cloud SQL", "Cloud SQL for PostgreSQL: N1 Standard 4", "hour", 720, 0.3836, "steady"),          # primary
    ("Cloud SQL", "Cloud SQL for PostgreSQL: N1 Standard 2", "hour", 720, 0.1918, "steady"),          # replica
    ("Cloud SQL", "Cloud SQL for PostgreSQL: SSD Storage", "gibibyte month", 200, 0.170, "steady"),   # storage
    ("Cloud SQL", "Cloud SQL for PostgreSQL: HA", "hour", 720, 0.3836, "steady"),                     # HA surcharge

    # Memorystore — steady state
    ("Memorystore for Redis", "Redis Capacity Standard M4", "gibibyte hour", 2920, 0.049, "steady"),  # 4GB × 730 hrs

    # Cloud Storage — steady, grows slowly
    ("Cloud Storage", "Standard Storage US Multi-region", "gibibyte month", 500, 0.026, "growing"),
    ("Cloud Storage", "Coldline Storage US Multi-region", "gibibyte month", 2000, 0.007, "growing"),
    ("Cloud Storage", "Class A Operations", "10 thousand operations", 15, 0.05, "steady"),
    ("Cloud Storage", "Network Egress", "gibibyte", 100, 0.12, "steady"),

    # Cloud Run — bursty (business hours)
    ("Cloud Run", "CPU Allocation Time", "vcpu-second", 4500000, 0.000024, "bursty"),
    ("Cloud Run", "Memory Allocation Time", "gibibyte-second", 4500000, 0.0000025, "bursty"),

    # Cloud Functions — event-driven, bursty
    ("Cloud Functions", "CPU Time", "GHz-second", 800000, 0.0000100, "bursty"),
    ("Cloud Functions", "Memory Time", "gibibyte-second", 300000, 0.0000025, "bursty"),
    ("Cloud Functions", "Invocations", "invocation", 2000000, 0.0000004, "bursty"),

    # Pub/Sub — correlates with transactions
    ("Cloud Pub/Sub", "Message Delivery Basic", "tebibyte", 0.3, 40.00, "bursty"),

    # BigQuery — analytics, spiky on weekdays
    ("BigQuery", "Analysis Bytes Processed", "tebibyte", 2.5, 5.00, "bursty"),
    ("BigQuery", "Active Storage", "gibibyte month", 150, 0.020, "growing"),

    # DNS — trivial cost
    ("Cloud DNS", "Managed Zone", "managed zone month", 1, 0.20, "steady"),
    ("Cloud DNS", "Queries", "million queries", 5, 0.40, "steady"),
]

def apply_pattern(base_usage, pattern, month_index):
    """Apply realistic variance based on workload pattern."""
    if pattern == "steady":
        # Low variance: ±5%
        return base_usage * random.uniform(0.95, 1.05)
    elif pattern == "bursty":
        # High variance: ±40%, with occasional spikes
        base = base_usage * random.uniform(0.6, 1.4)
        # Q4 spike (Black Friday / holiday season for fintech)
        if month_index >= 9:
            base *= random.uniform(1.2, 1.6)
        return base
    elif pattern == "growing":
        # Steady growth: ~3% per month compounding
        growth = (1.03 ** month_index)
        return base_usage * growth * random.uniform(0.97, 1.03)
    return base_usage

rows = []
for month_index in range(12):
    month_start = datetime(2024, month_index + 1, 1)
    month_end = datetime(2024, month_index + 1, 28)  # simplified

    for service, sku, unit, base_usage, unit_cost, pattern in SERVICES:
        usage = apply_pattern(base_usage, pattern, month_index)
        cost = round(usage * unit_cost, 2)

        rows.append({
            "Billing account ID": "01A2B3-C4D5E6-F7G8H9",
            "Project ID": "novapay-production",
            "Project Name": "NovaPay Production",
            "Service description": service,
            "SKU description": sku,
            "Usage start date": month_start.strftime("%Y-%m-%d"),
            "Usage end date": month_end.strftime("%Y-%m-%d"),
            "Usage amount": round(usage, 2),
            "Usage unit": unit,
            "Cost ($)": cost,
            "Credits ($)": 0.00,
            "Currency": "USD",
        })

with open("data/sample_billing.csv", "w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=rows[0].keys())
    writer.writeheader()
    writer.writerows(rows)

# Print monthly totals for verification
monthly_totals = {}
for row in rows:
    month = row["Usage start date"][:7]
    monthly_totals[month] = monthly_totals.get(month, 0) + row["Cost ($)"]

print("Monthly GCP costs:")
for month in sorted(monthly_totals):
    print(f"  {month}: ${monthly_totals[month]:,.2f}")
print(f"  Average: ${sum(monthly_totals.values()) / len(monthly_totals):,.2f}/month")
print(f"  Annual:  ${sum(monthly_totals.values()):,.2f}")
```

**Run this script immediately.** Check the monthly totals. You want:
- Average monthly spend around $8,000–$12,000.
- Compute + Cloud SQL making up ~60% of total (these are the RI candidates).
- Visible Q4 spike from the bursty services.
- A clear story: steady infrastructure backbone + bursty application layer.

If the numbers don't land right, adjust the `base_monthly_usage` or `unit_cost` values. Share the CSV with Dev 3 by hour 2–3 so they can start building their pricing engine against real data.

**Deliverable by hour 3:** Sample Terraform + sample billing CSV pushed to `data/` directory. Notify the entire team.

### Hours 3–5: Build the Risk Agent Risk Framework

**Step 1 — Risk taxonomy**

Define the categories and severity criteria before writing any code:

```python
# agents/risk_taxonomy.py

RISK_CATEGORIES = {
    "service_compatibility": {
        "description": "GCP services with no direct or only partial AWS equivalent",
        "severity_rules": {
            "high": "No AWS equivalent exists, requires rearchitecting",
            "medium": "Partial equivalent exists, requires configuration changes",
            "low": "Direct equivalent exists but with minor behavioral differences",
        },
    },
    "iam_model": {
        "description": "Differences between GCP project-level IAM and AWS policy-based IAM",
        "severity_rules": {
            "high": "Complex IAM bindings with cross-project references",
            "medium": "Standard IAM bindings that need restructuring",
            "low": "Simple service account to IAM role conversion",
        },
    },
    "networking": {
        "description": "VPC topology, firewall rules, and connectivity changes",
        "severity_rules": {
            "high": "Network topology incompatibility (e.g., auto-mode VPC, shared VPC)",
            "medium": "Firewall rule to security group translation with behavioral changes",
            "low": "Simple subnet and CIDR mapping",
        },
    },
    "data_migration": {
        "description": "Risks around moving data between clouds",
        "severity_rules": {
            "high": "Large database migration with zero-downtime requirement",
            "medium": "Object storage migration with lifecycle rules",
            "low": "Small dataset transfer",
        },
    },
    "downtime": {
        "description": "Potential service interruption during migration",
        "severity_rules": {
            "high": "Stateful services requiring cutover window",
            "medium": "Services that can be migrated with brief interruption",
            "low": "Stateless services with blue-green deployment option",
        },
    },
    "cost_surprise": {
        "description": "Unexpected cost differences between GCP and AWS",
        "severity_rules": {
            "high": "Service pricing model fundamentally different",
            "medium": "Egress costs or hidden fees",
            "low": "Minor pricing differences",
        },
    },
}
```

**Step 2 — Deterministic risk detection rules**

Catch the obvious risks without needing Claude:

```python
# agents/risk_rules.py

def detect_deterministic_risks(gcp_inventory: list, aws_mapping: list) -> list:
    """Detect risks from mapping data without calling Bedrock/Claude."""
    risks = []
    risk_counter = 1

    # Rule 1: Any partial or no-equivalent mapping is a risk
    for mapping in aws_mapping:
        confidence = mapping.get("mapping_confidence", "direct")
        if confidence == "partial":
            risks.append({
                "id": f"RISK-{risk_counter:03d}",
                "category": "service_compatibility",
                "severity": "medium",
                "title": f"{mapping['gcp_service']} has only a partial AWS equivalent ({mapping['aws_service']})",
                "description": mapping.get("gap_notes", "Partial mapping — review required."),
                "affected_resources": [mapping.get("gcp_resource_id", "unknown")],
                "aws_alternative": mapping.get("aws_service", "Unknown"),
                "migration_impact": "May require configuration changes or application modifications.",
                "mitigation": f"Evaluate whether {mapping['aws_service']} meets all requirements. Plan for testing.",
                "estimated_effort_days": 5,
            })
            risk_counter += 1
        elif confidence == "none":
            risks.append({
                "id": f"RISK-{risk_counter:03d}",
                "category": "service_compatibility",
                "severity": "high",
                "title": f"{mapping['gcp_service']} has no direct AWS equivalent",
                "description": mapping.get("gap_notes", "No direct AWS equivalent. Requires rearchitecting."),
                "affected_resources": [mapping.get("gcp_resource_id", "unknown")],
                "aws_alternative": mapping.get("aws_service", "Requires evaluation"),
                "migration_impact": "Significant rearchitecting required. Application code changes likely.",
                "mitigation": "Conduct a detailed technical spike to evaluate alternatives before migration begins.",
                "estimated_effort_days": 15,
            })
            risk_counter += 1

    # Rule 2: IAM bindings always get a risk (GCP and AWS IAM are fundamentally different)
    iam_resources = [r for r in gcp_inventory if r.get("resource_type") in ("iam_binding", "service_account")]
    if iam_resources:
        risks.append({
            "id": f"RISK-{risk_counter:03d}",
            "category": "iam_model",
            "severity": "medium",
            "title": f"IAM model translation required for {len(iam_resources)} IAM resources",
            "description": "GCP uses project-level role bindings attached to members. AWS uses policy-based IAM with users, roles, and groups. This is not a 1:1 mapping and requires careful redesign.",
            "affected_resources": [r.get("name", "unknown") for r in iam_resources],
            "aws_alternative": "AWS IAM Roles + Policies",
            "migration_impact": "All service-to-service authentication must be redesigned. Application code that uses Application Default Credentials will need updates.",
            "mitigation": "Map each GCP service account to an AWS IAM role with equivalent permissions. Use IAM Access Analyzer to validate least-privilege.",
            "estimated_effort_days": 5,
        })
        risk_counter += 1

    # Rule 3: Firewall rules to security groups
    firewall_resources = [r for r in gcp_inventory if r.get("resource_type") == "firewall_rule"]
    if firewall_resources:
        risks.append({
            "id": f"RISK-{risk_counter:03d}",
            "category": "networking",
            "severity": "medium",
            "title": f"Firewall rules to Security Groups translation ({len(firewall_resources)} rules)",
            "description": "GCP firewall rules are network-level and use target tags. AWS security groups are instance-level and stateful. NACLs are subnet-level and stateless. This difference can cause unexpected connectivity issues.",
            "affected_resources": [r.get("name", "unknown") for r in firewall_resources],
            "aws_alternative": "VPC Security Groups + Network ACLs",
            "migration_impact": "Network security posture may change silently. Applications may lose connectivity if security groups are too restrictive or gain unintended access if too permissive.",
            "mitigation": "Create a firewall rule mapping document. Test each rule individually in a staging VPC before cutover.",
            "estimated_effort_days": 3,
        })
        risk_counter += 1

    # Rule 4: Database migration always gets a risk
    db_resources = [r for r in gcp_inventory if r.get("resource_type") in ("cloud_sql",)]
    if db_resources:
        risks.append({
            "id": f"RISK-{risk_counter:03d}",
            "category": "data_migration",
            "severity": "high",
            "title": "Database migration requires careful planning for data integrity and minimal downtime",
            "description": "Migrating production databases between cloud providers carries risk of data loss, extended downtime, and replication lag. Read replicas add complexity.",
            "affected_resources": [r.get("name", "unknown") for r in db_resources],
            "aws_alternative": "RDS PostgreSQL with AWS DMS for migration",
            "migration_impact": "Requires a maintenance window for final cutover. Application connection strings must be updated atomically.",
            "mitigation": "Use AWS Database Migration Service (DMS) for continuous replication. Perform dry-run migration in staging. Plan a cutover window of 1-2 hours during low-traffic period.",
            "estimated_effort_days": 10,
        })
        risk_counter += 1

    # Rule 5: Egress cost surprise
    risks.append({
        "id": f"RISK-{risk_counter:03d}",
        "category": "cost_surprise",
        "severity": "medium",
        "title": "AWS data transfer egress pricing may increase networking costs",
        "description": "AWS charges for data transfer out to the internet and between regions/AZs. GCP pricing for egress differs. Cross-AZ traffic in AWS ($0.01/GB each way) can add up for high-throughput applications.",
        "affected_resources": ["all-networking"],
        "aws_alternative": "N/A — inherent platform difference",
        "migration_impact": "Monthly networking costs may be 10-20% higher than GCP depending on traffic patterns.",
        "mitigation": "Analyze current GCP egress patterns. Use VPC endpoints for AWS service traffic. Consider single-AZ deployment for non-critical workloads to reduce cross-AZ charges.",
        "estimated_effort_days": 2,
    })
    risk_counter += 1

    return risks, risk_counter
```

**Step 3 — Claude-on-Bedrock deep risk analysis**

Use Claude via Bedrock to find the subtle risks that rules can't catch:

```python
# agents/risk.py
import json
from agents.risk_rules import detect_deterministic_risks

RISK_SYSTEM_PROMPT = """You are a cloud migration risk analyst specializing in GCP-to-AWS migrations. You will receive:
1. A GCP resource inventory
2. An AWS mapping with gap flags
3. A list of risks already detected by automated rules

Your job: identify 2-3 ADDITIONAL risks that the automated rules missed. Focus on:
- Interaction effects between services (e.g., a Pub/Sub subscription pushing directly to BigQuery has no AWS equivalent — this requires rearchitecting the pipeline)
- Operational risks (monitoring, alerting, logging differences)
- Application-level risks (SDK changes, API differences, client library updates)
- Compliance or data residency concerns

For each risk, provide:
- id: "RISK-NNN" (continue numbering from where automated rules left off)
- category: one of service_compatibility, iam_model, networking, data_migration, downtime, cost_surprise
- severity: high, medium, or low
- title: one-line summary
- description: 2-3 sentences explaining the risk
- affected_resources: list of resource names
- aws_alternative: what to use instead
- migration_impact: what happens if this risk is not addressed
- mitigation: specific steps to mitigate
- estimated_effort_days: integer

Respond ONLY with a JSON array of risk objects. No markdown, no backticks, no explanation."""

async def run(context: dict, claude_client) -> dict:
    inventory = context.get("gcp_inventory", [])
    mapping = context.get("aws_mapping", [])

    # Phase 1: Deterministic risks
    auto_risks, next_counter = detect_deterministic_risks(inventory, mapping)

    # Phase 2: Claude-on-Bedrock deep analysis
    try:
        response = claude_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2048,
            temperature=0,
            system=RISK_SYSTEM_PROMPT,
            messages=[{
                "role": "user",
                "content": (
                    f"GCP Inventory:\n{json.dumps(inventory, indent=2)}\n\n"
                    f"AWS Mapping:\n{json.dumps(mapping, indent=2)}\n\n"
                    f"Already detected risks (continue numbering from RISK-{next_counter:03d}):\n"
                    f"{json.dumps([{'id': r['id'], 'title': r['title']} for r in auto_risks], indent=2)}"
                )
            }]
        )

        raw_text = response.content[0].text.strip()
        if raw_text.startswith("```"):
            raw_text = raw_text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

        claude_risks = json.loads(raw_text)
        all_risks = auto_risks + claude_risks
    except Exception:
        all_risks = auto_risks

    # Build summary
    high_count = sum(1 for r in all_risks if r["severity"] == "high")
    med_count = sum(1 for r in all_risks if r["severity"] == "medium")
    low_count = sum(1 for r in all_risks if r["severity"] == "low")

    top_risk = next((r for r in all_risks if r["severity"] == "high"), all_risks[0] if all_risks else None)

    if high_count == 0:
        assessment = "Migration is low-risk. No critical compatibility issues detected. Standard migration procedures apply."
    elif high_count <= 2:
        assessment = f"Migration is feasible with moderate risk. {high_count} high-severity item(s) require upfront architectural decisions before migration begins."
    else:
        assessment = f"Migration carries significant risk. {high_count} high-severity items require detailed technical spikes and may extend the migration timeline."

    context["risks"] = all_risks
    context["risk_summary"] = {
        "total_risks": len(all_risks),
        "high": high_count,
        "medium": med_count,
        "low": low_count,
        "top_risk": top_risk["title"] if top_risk else "None",
        "overall_assessment": assessment,
    }

    return context
```

**Deliverable by hour 5:** Risk Agent that combines deterministic rules with Claude analysis to produce a scored, categorized risk report.

### Hours 5–8: Build the Watchdog Agent

This is the product-parity section that closes the main gap between the website and the earlier plan.

**Step 1 — Watchdog output contract**

Build the fifth agent as `watchdog.py`. It consumes `gcp_inventory`, `aws_mapping`, `risks`, and `finops`, then emits:

- `runbook`
- `watchdog`
- `iac_bundle`

The Watchdog output is not just a chart payload. It is the post-migration operating plan:

- monthly spend baseline and target savings
- top optimization opportunities
- anomaly threshold / scan frequency
- Detect → Evaluate → Apply → Verify pipeline
- whether actions are `suggested`, `simulated`, or `executable`

**Step 2 — Runbook structure template**

The runbook follows a fixed phase structure. Bedrock (Claude) fills in the specific steps based on the migration context.

```python
# agents/runbook.py
import json
from llm import call_llm_async

RUNBOOK_SYSTEM_PROMPT = """You are a cloud migration project manager creating a migration runbook for a GCP-to-AWS migration. You will receive:
1. GCP resource inventory
2. AWS target mapping
3. Risk report
4. FinOps recommendations (if available)

Generate a detailed migration runbook with these exact phases:

Phase 1 — Pre-Migration (1-2 weeks): AWS account setup, landing zone, VPC creation, IAM roles, security groups, monitoring setup.
Phase 2 — Data Migration (2-3 weeks): Database migration with DMS, storage migration with S3 Transfer, DNS preparation.
Phase 3 — Compute Migration (1-2 weeks): EC2 instances, containers (ECS/Fargate), serverless functions, messaging.
Phase 4 — Cutover (1-2 days): DNS switch, traffic routing, final data sync, go-live validation.
Phase 5 — Post-Migration (1-2 weeks): Monitoring, performance validation, decommission GCP resources, finalize FinOps (purchase Reserved Instances per Day-0 plan).

For each phase, provide 4-6 specific steps. Each step must have:
- step_number (integer, sequential within phase)
- action (specific, actionable instruction)
- responsible ("Cloud Infrastructure Team", "Application Team", "Database Team", "Security Team", or "FinOps Team")
- estimated_hours (integer)
- dependencies (list of "Phase X, Step Y" strings, or empty list)
- rollback (specific rollback instruction)
- notes (additional context)

CRITICAL: Phase 5 must include a step to execute the Day-0 FinOps plan — purchasing Reserved Instances and Savings Plans based on the pre-calculated recommendations.

Also generate:
- estimated_total_duration (string like "8-12 weeks")
- rollback_plan (2-3 sentence summary)
- success_criteria (list of 5 measurable criteria)

Respond ONLY with a JSON object matching this structure. No markdown, no backticks."""

async def run(context: dict) -> dict:
    inventory = context.get("gcp_inventory", [])
    mapping = context.get("aws_mapping", [])
    risks = context.get("risks", [])
    finops = context.get("finops", {})

    # Build a concise context summary for Bedrock (don't send raw data — too long)
    resource_summary = {}
    for r in inventory:
        rtype = r.get("resource_type", "other")
        resource_summary[rtype] = resource_summary.get(rtype, 0) + 1

    mapping_summary = []
    for m in mapping:
        mapping_summary.append({
            "from": f"{m.get('gcp_service', '?')} ({m.get('gcp_resource_id', '?')})",
            "to": m.get("aws_service", "?"),
            "confidence": m.get("mapping_confidence", "?"),
        })

    risk_titles = [{"severity": r["severity"], "title": r["title"]} for r in risks[:10]]

    ri_summary = []
    for rec in finops.get("ri_recommendations", []):
        ri_summary.append(f"{rec['quantity']}x {rec['instance_type']} {rec['aws_service']} RI — saves ${rec['annual_savings']:,.0f}/yr")

    context_for_bedrock = {
        "resource_counts": resource_summary,
        "total_resources": len(inventory),
        "mapping_summary": mapping_summary,
        "key_risks": risk_titles,
        "day0_finops_purchases": ri_summary,
        "total_first_year_savings": finops.get("total_first_year_savings", 0),
    }

    try:
        raw_text = await call_llm_async(
            system=RUNBOOK_SYSTEM_PROMPT,
            messages=[{
                "role": "user",
                "content": f"Generate the migration runbook from this context:\n{json.dumps(context_for_bedrock, indent=2)}"
            }]
        )

        raw_text = raw_text.strip()
        if raw_text.startswith("```"):
            raw_text = raw_text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

        runbook = json.loads(raw_text)
    except Exception as e:
        # Fallback: minimal runbook
        runbook = {
            "title": "GCP to AWS Migration Runbook",
            "estimated_total_duration": "8-12 weeks",
            "phases": [
                {"phase_number": 1, "name": "Pre-Migration", "duration": "1-2 weeks", "steps": [
                    {"step_number": 1, "action": "Set up AWS landing zone and VPC", "responsible": "Cloud Infrastructure Team", "estimated_hours": 16, "dependencies": [], "rollback": "Delete AWS VPC", "notes": "Use target architecture from mapping output"}
                ]},
                {"phase_number": 2, "name": "Data Migration", "duration": "2-3 weeks", "steps": [
                    {"step_number": 1, "action": "Set up AWS DMS for database replication", "responsible": "Database Team", "estimated_hours": 24, "dependencies": ["Phase 1, Step 1"], "rollback": "Stop DMS tasks", "notes": "Start with read replica, then promote"}
                ]},
                {"phase_number": 3, "name": "Compute Migration", "duration": "1-2 weeks", "steps": [
                    {"step_number": 1, "action": "Deploy application containers to ECS/Fargate", "responsible": "Application Team", "estimated_hours": 16, "dependencies": ["Phase 2, Step 1"], "rollback": "Route traffic back to GCP", "notes": "Blue-green deployment recommended"}
                ]},
                {"phase_number": 4, "name": "Cutover", "duration": "1-2 days", "steps": [
                    {"step_number": 1, "action": "Switch DNS to AWS endpoints", "responsible": "Cloud Infrastructure Team", "estimated_hours": 4, "dependencies": ["Phase 3, Step 1"], "rollback": "Revert DNS to GCP endpoints", "notes": "Use low TTL 24 hours before cutover"}
                ]},
                {"phase_number": 5, "name": "Post-Migration", "duration": "1-2 weeks", "steps": [
                    {"step_number": 1, "action": "Execute Day-0 FinOps plan: purchase Reserved Instances", "responsible": "FinOps Team", "estimated_hours": 2, "dependencies": ["Phase 4, Step 1"], "rollback": "N/A — RIs are non-refundable but can be sold on RI Marketplace", "notes": "Purchase per pre-calculated plan to start saving immediately"}
                ]},
            ],
            "rollback_plan": "Each phase has individual rollback steps. Full rollback involves reverting DNS to GCP endpoints and stopping AWS DMS replication. GCP infrastructure remains intact until post-migration validation completes.",
            "success_criteria": [
                "All services responding on AWS endpoints with <200ms latency",
                "Database replication lag < 1 second at cutover",
                "Zero data loss verified by checksum comparison",
                "All monitoring and alerting operational on AWS",
                "Day-0 Reserved Instances purchased and active"
            ],
        }

    context["runbook"] = runbook
    return context
```

**Step 3 — IaC bundle generation**

Generate a lightweight but tangible AWS Terraform scaffold. This does not need to be production-perfect, but it must be concrete enough that judges can see how RADCloud moves from recommendation to executable assets.

The `iac_bundle` should include:

- a list of generated files
- code snippets or full file contents for the highest-value modules
- assumptions and TODOs
- deployment notes and validation warnings

At minimum, generate stubs for:

- networking
- compute / containers
- database
- observability / budgets

**Deliverable by hour 8:** Watchdog agent that produces a phased migration plan, a Watchdog dashboard payload, and a generated IaC bundle with the Day-0 FinOps purchase step built in.

### Hours 8–12: Integration

- Push all your files to the repo:
  - `agents/risk.py`, `agents/risk_rules.py`, `agents/risk_taxonomy.py`
  - `agents/watchdog.py`, `agents/runbook.py`, `agents/iac_generator.py`
  - `data/sample.tf`, `data/sample_billing.csv`
  - `scripts/generate_billing.py`
- Work with Dev 1 to wire your agents into the pipeline replacing stubs.
- Test end-to-end with the sample data:
  - Upload sample.tf + sample_billing.csv → all 5 agents run → verify Risks, Runbook, Watchdog, and IaC Output tabs.
- Debug integration issues:
  - Risk agent receives mapping with different field names than expected → align with Dev 2.
  - Watchdog / runbook response is too long or gets truncated → reduce the context summary or increase max_tokens.
  - Risk severity badges in the frontend don't match your severity values → align with Dev 1.

### Hours 12–16: Polish

**Risk report polish:**
- Make sure risks are ordered by severity (high first, then medium, then low).
- Verify the risk summary numbers are correct.
- Check that `estimated_effort_days` adds up to something reasonable (not 200 days for a 12-week migration).

**Runbook polish:**
- Make sure dependencies between steps are correct (no circular dependencies, no references to nonexistent steps).
- Verify that the FinOps step in Phase 5 references the actual RI recommendations from Dev 3's output.
- Make sure `estimated_hours` per phase adds up to something reasonable.

**Watchdog / IaC polish:**
- Make sure the optimization opportunities shown in Watchdog are derived from real risk + FinOps outputs, not arbitrary filler.
- Mark every remediation action as `suggested`, `simulated`, or `executable` so the product never over-claims.
- Validate that generated Terraform file names, module boundaries, and assumptions are internally consistent.

**Demo data polish (CRITICAL):**
- Run the full pipeline 3–5 times with the sample data. Check:
  - Does the Discovery Agent find all ~30 resources?
  - Does the Mapping Agent flag BigQuery and Spanner as partial?
  - Does the FinOps Agent produce a savings number in the $35K–$50K range?
  - Does the Risk Agent catch the database migration risk and IAM risk?
  - Does the Runbook include all 5 phases?
- If any numbers look off, adjust the billing CSV (change usage amounts, tweak unit costs).
- The billing CSV is your most powerful tuning knob. Small changes to compute hours or DB costs have big effects on the FinOps output.

### Hours 16–20: Demo Prep

- Help Dev 1 build the cached demo response.
- Write talking points for your product surfaces:
  - **Risks tab:** "RADCloud identified 8 migration risks, including 2 high-severity items. The database migration requires AWS DMS with a planned cutover window. The IAM model needs redesigning — GCP's project-level bindings don't map 1:1 to AWS policies."
  - **Runbook tab:** "The migration is planned in 5 phases over 8–12 weeks. Notice Phase 5 — this is where RADCloud's Day-0 FinOps plan kicks in. Instead of waiting 3 months for a traditional FinOps tool, we purchase Reserved Instances on Day 1 based on patterns we already analyzed from GCP billing data."
  - **Watchdog tab:** "Watchdog is the fifth agent. It takes the migration plan and turns it into an operating model: anomaly detection, optimization opportunities, remediation flow, and post-cutover cost guardrails from Day 0."
  - **IaC Output tab:** "These Terraform artifacts are generated scaffolds, not blind one-click production applies. RADCloud accelerates the build-out, then engineers review and harden before deployment."
- Prepare for judge questions:
  - "How do you know these risks are real?" → "The deterministic rules catch known incompatibilities — IAM model differences, firewall-to-security-group translation, partial service mappings. Claude on Bedrock adds contextual risks like pipeline rearchitecting that rules can't detect."
  - "How detailed is the runbook?" → "Each step has an owner, time estimate, dependencies, and a specific rollback procedure. It's a starting point, not a finished project plan — but it gives migration teams a 70% head start."

### Hours 20–24: Buffer

- Fix any last bugs.
- Final check: does the sample data still produce good output? (Someone may have accidentally modified it during integration.)
- Be available for full-team rehearsal.

---

## Files You Own

| File | Purpose |
|------|---------|
| `agents/risk.py` | Risk Agent — main entry point |
| `agents/risk_rules.py` | Deterministic risk detection rules |
| `agents/risk_taxonomy.py` | Risk categories and severity criteria |
| `agents/watchdog.py` | Final agent wrapper — emits Watchdog, runbook, and IaC outputs |
| `agents/runbook.py` | Runbook Generator component |
| `agents/iac_generator.py` | AWS Terraform / IaC scaffold generator |
| `agents/watchdog_rules.py` | Remediation modes, anomaly thresholds, and post-migration policy rules |
| `data/sample.tf` | Demo Terraform file (NovaPay infrastructure) |
| `data/sample_billing.csv` | Demo billing CSV (12 months, ~$8K–$12K/month) |
| `scripts/generate_billing.py` | Billing data generator script |

---

## The Demo Data Checklist

Run through this before declaring demo data complete:

- [ ] sample.tf has 25–30 resources across compute, database, cache, storage, serverless, messaging, analytics, networking, IAM
- [ ] sample.tf uses at least one service with no direct AWS equivalent (BigQuery Pub/Sub subscription, or Spanner)
- [ ] sample.tf has IAM bindings and service accounts (triggers IAM risk)
- [ ] sample.tf has firewall rules (triggers networking risk)
- [ ] sample.tf has a database with HA and read replica (triggers data migration risk)
- [ ] sample_billing.csv has 12 months of data
- [ ] sample_billing.csv column names match Dev 3's parser expectations exactly
- [ ] Compute + Cloud SQL costs make up >60% of total (drives RI savings)
- [ ] Bursty services (Cloud Run, Functions) show visible variance month-to-month
- [ ] Monthly total is $8K–$12K (realistic, not too big, not too small)
- [ ] Q4 months show a seasonal spike (makes the data look real)
- [ ] Running the full pipeline produces `total_first_year_savings` in the $35K–$50K range
- [ ] The billing CSV includes the cost column header format Dev 3 expects: `Cost ($)`
- [ ] The sample infrastructure is rich enough to create 3–5 believable Watchdog optimization opportunities
- [ ] The generated IaC bundle contains at least networking + compute + database + observability stubs

---

## Gotchas and Failure Modes

**Claude generates duplicate risks that overlap with deterministic rules.**
Fix: Pass the already-detected risk titles to Claude in the prompt so it knows what's been covered. The prompt already does this.

**Runbook Claude response gets truncated at 4096 tokens.**
Fix: Increase max_tokens to 6000, or reduce the context summary. The runbook is the longest Claude output in the pipeline — monitor its length.

**Sample billing CSV doesn't produce good FinOps numbers.**
Fix: This is on you to tune. The most impactful lever is the Compute Engine and Cloud SQL costs — increase the `base_monthly_usage` for steady-state services to drive up RI savings. Run the full pipeline after every adjustment.

**Risk agent finds too many risks (>15) and the tab looks overwhelming.**
Fix: Cap Claude at 2–3 additional risks. The deterministic rules usually produce 4–6. Total of 7–9 risks is the sweet spot for a demo.

**Runbook steps reference AWS services that Dev 2's mapping didn't include.**
Fix: The runbook prompt receives the mapping summary, so Claude should only reference mapped services. If it hallucinates a service, the fallback runbook kicks in — it's generic but correct.

**Watchdog over-claims auto-remediation that the product cannot safely execute.**
Fix: Be explicit in the schema and UI mode labels. Default to `suggested` or `simulated`. Only mark actions `executable` if there is a real implementation path.

---

## What to Cut If Behind

1. **Cut the Claude-powered deep risk analysis** — the deterministic rules alone produce a solid 4–6 risks. Skip the Claude call entirely.
2. **Cut the runbook detail** — use the hardcoded fallback runbook (5 phases, 1 step each). It's thin but structurally correct.
3. **Cut executable remediation, not the Watchdog surface** — suggested/simulated actions are acceptable if the UI and schema remain intact.
4. **Cut risk taxonomy severity rules** — just hardcode severity in the detection rules instead of looking it up.
5. **Never cut the demo data** — this is your #1 deliverable. Without it, nobody can demo anything.
6. **Never cut the deterministic risk rules** — the IAM risk, database risk, and firewall risk are the three risks that make the tool look credible. They must appear in every run.
7. **Never cut the Day-0 FinOps step in the runbook** — this is the thread that ties the entire narrative together. Phase 5 must include "purchase Reserved Instances per Day-0 plan."
8. **Never cut the IaC bundle** — even a scaffold-level output is required to support the website's generated Terraform claim.
