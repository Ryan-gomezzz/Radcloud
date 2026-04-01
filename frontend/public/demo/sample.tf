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
