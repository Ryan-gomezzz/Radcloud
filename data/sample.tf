# NovaPay — sample GCP Terraform (demo) ~30 resources
terraform {
  required_version = ">= 1.5"
}

provider "google" {
  project = "novapay-prod-demo"
  region  = "us-central1"
}

resource "google_compute_network" "novapay_vpc" {
  name                    = "novapay-vpc"
  auto_create_subnetworks = false
  routing_mode            = "REGIONAL"
}

resource "google_compute_subnetwork" "private_app" {
  name                     = "private-app-subnet"
  ip_cidr_range            = "10.0.1.0/24"
  region                   = "us-central1"
  network                  = google_compute_network.novapay_vpc.id
  private_ip_google_access = true
}

resource "google_compute_subnetwork" "private_db" {
  name                     = "private-db-subnet"
  ip_cidr_range            = "10.0.2.0/24"
  region                   = "us-central1"
  network                  = google_compute_network.novapay_vpc.id
  private_ip_google_access = true
}

resource "google_compute_firewall" "allow_internal" {
  name    = "fw-allow-internal"
  network = google_compute_network.novapay_vpc.name
  allow {
    protocol = "tcp"
    ports    = ["0-65535"]
  }
  source_ranges = ["10.0.0.0/16"]
}

resource "google_compute_firewall" "allow_https" {
  name    = "fw-allow-https"
  network = google_compute_network.novapay_vpc.name
  allow {
    protocol = "tcp"
    ports    = ["443", "80"]
  }
  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["web"]
}

resource "google_compute_firewall" "deny_db_egress" {
  name     = "fw-restrict-egress-db"
  network  = google_compute_network.novapay_vpc.name
  priority = 1000
  deny {
    protocol = "all"
  }
  direction          = "EGRESS"
  destination_ranges = ["0.0.0.0/0"]
  target_tags        = ["db"]
}

resource "google_compute_instance" "web_1" {
  name         = "web-server-1"
  machine_type = "n1-standard-4"
  zone         = "us-central1-a"
  tags         = ["web"]
  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2204-lts"
      size  = 100
      type  = "pd-ssd"
    }
  }
  network_interface {
    subnetwork = google_compute_subnetwork.private_app.id
  }
}

resource "google_compute_instance" "web_2" {
  name         = "web-server-2"
  machine_type = "n1-standard-4"
  zone         = "us-central1-b"
  tags         = ["web"]
  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2204-lts"
      size  = 100
      type  = "pd-ssd"
    }
  }
  network_interface {
    subnetwork = google_compute_subnetwork.private_app.id
  }
}

resource "google_compute_instance" "worker" {
  name         = "payment-worker-1"
  machine_type = "n1-highcpu-8"
  zone         = "us-central1-a"
  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2204-lts"
      size  = 200
      type  = "pd-ssd"
    }
  }
  network_interface {
    subnetwork = google_compute_subnetwork.private_app.id
  }
}

resource "google_sql_database_instance" "primary" {
  name             = "novapay-primary-db"
  database_version = "POSTGRES_14"
  region           = "us-central1"
  settings {
    tier              = "db-n1-standard-4"
    disk_size         = 500
    disk_type         = "PD_SSD"
    availability_type = "REGIONAL"
  }
}

resource "google_sql_database_instance" "replica" {
  name                 = "novapay-replica-db"
  database_version     = "POSTGRES_14"
  region               = "us-central1"
  master_instance_name = google_sql_database_instance.primary.name
  replica_configuration {
    failover_target = false
  }
  settings {
    tier      = "db-n1-standard-2"
    disk_size = 500
    disk_type = "PD_SSD"
  }
}

resource "google_redis_instance" "cache" {
  name           = "novapay-redis"
  tier           = "STANDARD_HA"
  memory_size_gb = 5
  region         = "us-central1"
  redis_version  = "REDIS_6_X"
}

resource "google_storage_bucket" "assets" {
  name          = "novapay-assets-prod-demo"
  location      = "US"
  storage_class = "STANDARD"
  versioning {
    enabled = true
  }
}

resource "google_storage_bucket" "logs" {
  name          = "novapay-logs-archive-demo"
  location      = "US"
  storage_class = "NEARLINE"
}

resource "google_storage_bucket" "backups" {
  name          = "novapay-db-backups-demo"
  location      = "US"
  storage_class = "COLDLINE"
  versioning {
    enabled = true
  }
}

resource "google_cloud_run_service" "api" {
  name     = "novapay-api"
  location = "us-central1"
  template {
    spec {
      containers {
        image = "gcr.io/novapay-prod-demo/api:latest"
        resources {
          limits = {
            memory = "2Gi"
            cpu    = "2"
          }
        }
      }
    }
  }
}

resource "google_cloudfunctions_function" "webhook" {
  name    = "webhook-ingest-fn"
  runtime = "python311"
  region  = "us-central1"
}

resource "google_cloudfunctions_function" "settlement" {
  name    = "settlement-cron-fn"
  runtime = "python311"
  region  = "us-central1"
}

resource "google_pubsub_topic" "payment_events" {
  name = "payment-events"
}

resource "google_pubsub_subscription" "payment_sub" {
  name  = "payment-events-sub"
  topic = google_pubsub_topic.payment_events.name
}

resource "google_bigquery_dataset" "analytics" {
  dataset_id                 = "novapay_analytics"
  location                   = "US"
  default_table_expiration_ms = null
}

resource "google_bigquery_table" "transactions" {
  dataset_id = google_bigquery_dataset.analytics.dataset_id
  table_id   = "transactions_curated"
}

resource "google_service_account" "api_runtime" {
  account_id   = "novapay-api-runtime"
  display_name = "NovaPay API Runtime"
}

resource "google_service_account" "batch_worker" {
  account_id   = "novapay-batch"
  display_name = "NovaPay Batch Worker"
}

resource "google_project_iam_binding" "cloudsql_client" {
  project = "novapay-prod-demo"
  role    = "roles/cloudsql.client"
  members = [
    "serviceAccount:${google_service_account.api_runtime.email}",
  ]
}

resource "google_compute_disk" "worker_scratch" {
  name = "payment-worker-scratch"
  type = "pd-ssd"
  zone = "us-central1-a"
  size = 500
}

resource "google_compute_disk" "web_shared" {
  name = "web-shared-data"
  type = "pd-balanced"
  zone = "us-central1-a"
  size = 200
}

resource "google_project_service" "apis_run" {
  service = "run.googleapis.com"
}

resource "google_project_service" "apis_functions" {
  service = "cloudfunctions.googleapis.com"
}

resource "google_project_service" "apis_pubsub" {
  service = "pubsub.googleapis.com"
}

resource "google_secret_manager_secret" "api_hmac" {
  secret_id = "novapay-webhook-hmac"
  replication {
    auto {}
  }
}
