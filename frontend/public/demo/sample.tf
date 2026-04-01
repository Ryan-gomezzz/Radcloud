# Sample GCP-style Terraform snippet for RADCloud demo
resource "google_compute_instance" "web" {
  name         = "web-server-1"
  machine_type = "n1-standard-4"
  zone         = "us-central1-a"
}

resource "google_sql_database_instance" "main" {
  name             = "main-db"
  database_version = "POSTGRES_15"
  region           = "us-central1"
  settings {
    tier = "db-n1-standard-2"
  }
}

resource "google_storage_bucket" "assets" {
  name     = "app-assets-demo"
  location = "US"
}
