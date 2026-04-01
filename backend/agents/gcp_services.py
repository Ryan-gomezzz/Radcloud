"""GCP service type registry — maps resource types to service metadata.

Used by the Discovery Agent to validate/normalize extracted resource types
and by the Mapping Agent as a lookup reference for Terraform type names.
"""

GCP_SERVICES: dict[str, dict] = {
    "compute_instance": {
        "service": "Compute Engine",
        "terraform_type": "google_compute_instance",
        "key_config_fields": [
            "machine_type",
            "zone",
            "boot_disk",
            "network_interface",
            "labels",
        ],
    },
    "cloud_sql": {
        "service": "Cloud SQL",
        "terraform_type": "google_sql_database_instance",
        "key_config_fields": [
            "database_version",
            "tier",
            "region",
            "disk_size",
            "disk_type",
            "availability_type",
        ],
    },
    "gcs_bucket": {
        "service": "Cloud Storage",
        "terraform_type": "google_storage_bucket",
        "key_config_fields": [
            "location",
            "storage_class",
            "versioning",
            "lifecycle_rule",
        ],
    },
    "cloud_run": {
        "service": "Cloud Run",
        "terraform_type": "google_cloud_run_service",
        "key_config_fields": [
            "location",
            "template.spec.containers",
            "traffic",
        ],
    },
    "cloud_function": {
        "service": "Cloud Functions",
        "terraform_type": "google_cloudfunctions_function",
        "key_config_fields": [
            "runtime",
            "entry_point",
            "trigger_http",
            "available_memory_mb",
            "region",
        ],
    },
    "pubsub_topic": {
        "service": "Pub/Sub",
        "terraform_type": "google_pubsub_topic",
        "key_config_fields": [
            "name",
            "message_retention_duration",
        ],
    },
    "pubsub_subscription": {
        "service": "Pub/Sub",
        "terraform_type": "google_pubsub_subscription",
        "key_config_fields": [
            "topic",
            "ack_deadline_seconds",
            "push_config",
        ],
    },
    "bigquery_dataset": {
        "service": "BigQuery",
        "terraform_type": "google_bigquery_dataset",
        "key_config_fields": [
            "location",
            "default_table_expiration_ms",
        ],
    },
    "bigquery_table": {
        "service": "BigQuery",
        "terraform_type": "google_bigquery_table",
        "key_config_fields": [
            "dataset_id",
            "schema",
            "time_partitioning",
            "clustering",
        ],
    },
    "vpc_network": {
        "service": "VPC",
        "terraform_type": "google_compute_network",
        "key_config_fields": [
            "auto_create_subnetworks",
            "routing_mode",
        ],
    },
    "vpc_subnet": {
        "service": "VPC",
        "terraform_type": "google_compute_subnetwork",
        "key_config_fields": [
            "ip_cidr_range",
            "region",
            "network",
            "private_ip_google_access",
        ],
    },
    "firewall_rule": {
        "service": "VPC Firewall",
        "terraform_type": "google_compute_firewall",
        "key_config_fields": [
            "network",
            "direction",
            "allow",
            "deny",
            "source_ranges",
            "target_tags",
        ],
    },
    "cloud_dns_zone": {
        "service": "Cloud DNS",
        "terraform_type": "google_dns_managed_zone",
        "key_config_fields": [
            "dns_name",
            "visibility",
        ],
    },
    "memorystore_redis": {
        "service": "Memorystore",
        "terraform_type": "google_redis_instance",
        "key_config_fields": [
            "tier",
            "memory_size_gb",
            "region",
            "redis_version",
        ],
    },
    "iam_binding": {
        "service": "IAM",
        "terraform_type": "google_project_iam_binding",
        "key_config_fields": [
            "role",
            "members",
        ],
    },
    "service_account": {
        "service": "IAM",
        "terraform_type": "google_service_account",
        "key_config_fields": [
            "account_id",
            "display_name",
        ],
    },
    "spanner_instance": {
        "service": "Cloud Spanner",
        "terraform_type": "google_spanner_instance",
        "key_config_fields": [
            "config",
            "num_nodes",
            "display_name",
        ],
    },
    "dataflow_job": {
        "service": "Dataflow",
        "terraform_type": "google_dataflow_job",
        "key_config_fields": [
            "template_gcs_path",
            "parameters",
            "region",
            "machine_type",
        ],
    },
}

# Reverse lookup: Terraform resource type → our canonical resource type key.
# Example: "google_compute_instance" → "compute_instance"
TERRAFORM_TYPE_TO_RESOURCE: dict[str, str] = {
    entry["terraform_type"]: rtype for rtype, entry in GCP_SERVICES.items()
}

# All known resource type keys (for validation / normalization).
KNOWN_RESOURCE_TYPES: frozenset[str] = frozenset(GCP_SERVICES.keys())
