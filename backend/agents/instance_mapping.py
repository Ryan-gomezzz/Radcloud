"""Deterministic translation tables for GCP → AWS resource configuration.

Contains four mapping dicts:
  MACHINE_TYPE_MAP  — GCP machine types / Cloud SQL tiers → EC2 / RDS instance types
  REGION_MAP        — GCP regions → AWS regions
  STORAGE_CLASS_MAP — GCS storage classes → S3 storage classes
  DISK_TYPE_MAP     — GCP persistent disk types → EBS volume types
"""

# ---------------------------------------------------------------------------
# Machine type  →  EC2 / RDS instance type
# ---------------------------------------------------------------------------

MACHINE_TYPE_MAP: dict[str, str] = {
    # ---- General purpose (N1) ----
    "n1-standard-1":  "m5.large",
    "n1-standard-2":  "m5.large",
    "n1-standard-4":  "m5.xlarge",
    "n1-standard-8":  "m5.2xlarge",
    "n1-standard-16": "m5.4xlarge",
    "n1-standard-32": "m5.8xlarge",
    "n1-standard-64": "m5.16xlarge",
    # ---- General purpose (N2) ----
    "n2-standard-2":  "m6i.large",
    "n2-standard-4":  "m6i.xlarge",
    "n2-standard-8":  "m6i.2xlarge",
    "n2-standard-16": "m6i.4xlarge",
    "n2-standard-32": "m6i.8xlarge",
    # ---- Economy (E2) ----
    "e2-micro":       "t3.micro",
    "e2-small":       "t3.small",
    "e2-medium":      "t3.medium",
    "e2-standard-2":  "t3.large",
    "e2-standard-4":  "t3.xlarge",
    "e2-standard-8":  "t3.2xlarge",
    # ---- High memory (N1) ----
    "n1-highmem-2":   "r5.large",
    "n1-highmem-4":   "r5.xlarge",
    "n1-highmem-8":   "r5.2xlarge",
    "n1-highmem-16":  "r5.4xlarge",
    # ---- High memory (N2) ----
    "n2-highmem-2":   "r6i.large",
    "n2-highmem-4":   "r6i.xlarge",
    # ---- High CPU (N1) ----
    "n1-highcpu-2":   "c5.large",
    "n1-highcpu-4":   "c5.xlarge",
    "n1-highcpu-8":   "c5.2xlarge",
    # ---- High CPU (N2) ----
    "n2-highcpu-2":   "c6i.large",
    "n2-highcpu-4":   "c6i.xlarge",
    # ---- Cloud SQL tiers → RDS instance classes ----
    "db-f1-micro":        "db.t3.micro",
    "db-g1-small":        "db.t3.small",
    "db-n1-standard-1":   "db.m5.large",
    "db-n1-standard-2":   "db.m5.xlarge",
    "db-n1-standard-4":   "db.m5.2xlarge",
    "db-n1-standard-8":   "db.m5.4xlarge",
    "db-n1-highmem-2":    "db.r5.large",
    "db-n1-highmem-4":    "db.r5.xlarge",
}

# ---------------------------------------------------------------------------
# GCP region  →  AWS region
# ---------------------------------------------------------------------------

REGION_MAP: dict[str, str] = {
    "us-central1":          "us-east-1",
    "us-east1":             "us-east-1",
    "us-east4":             "us-east-2",
    "us-west1":             "us-west-2",
    "us-west2":             "us-west-1",
    "europe-west1":         "eu-west-1",
    "europe-west2":         "eu-west-2",
    "europe-west3":         "eu-central-1",
    "asia-east1":           "ap-northeast-1",
    "asia-southeast1":      "ap-southeast-1",
    "asia-south1":          "ap-south-1",
    "australia-southeast1": "ap-southeast-2",
}

# Default AWS region when GCP region is unknown or unmapped.
DEFAULT_AWS_REGION: str = "us-east-1"

# ---------------------------------------------------------------------------
# GCS storage class  →  S3 storage class
# ---------------------------------------------------------------------------

STORAGE_CLASS_MAP: dict[str, str] = {
    "STANDARD":  "STANDARD",
    "NEARLINE":  "STANDARD_IA",
    "COLDLINE":  "GLACIER_IR",
    "ARCHIVE":   "GLACIER_DEEP_ARCHIVE",
}

# ---------------------------------------------------------------------------
# GCP persistent disk type  →  EBS volume type
# ---------------------------------------------------------------------------

DISK_TYPE_MAP: dict[str, str] = {
    "pd-standard": "gp2",
    "pd-ssd":      "gp3",
    "pd-balanced": "gp3",
    "pd-extreme":  "io2",
    "PD_SSD":      "gp3",      # Terraform sometimes uses uppercase
    "PD_STANDARD": "gp2",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def resolve_machine_type(gcp_machine_type: str) -> str:
    """Return the AWS instance type for a GCP machine type, or a tagged fallback."""
    return MACHINE_TYPE_MAP.get(gcp_machine_type, f"UNMAPPED:{gcp_machine_type}")


def resolve_region(gcp_region_or_zone: str) -> str:
    """Return the AWS region for a GCP region or zone string.

    Handles zone strings like ``us-central1-a`` by stripping the trailing
    zone letter before lookup.
    """
    region = gcp_region_or_zone
    # Strip zone suffix (e.g. "us-central1-a" → "us-central1")
    parts = region.split("-")
    if len(parts) > 2 and len(parts[-1]) == 1 and parts[-1].isalpha():
        region = "-".join(parts[:-1])
    return REGION_MAP.get(region, DEFAULT_AWS_REGION)


def resolve_storage_class(gcp_class: str) -> str:
    """Return the S3 storage class for a GCS storage class."""
    return STORAGE_CLASS_MAP.get(gcp_class, "STANDARD")


def resolve_disk_type(gcp_disk: str) -> str:
    """Return the EBS volume type for a GCP disk type."""
    return DISK_TYPE_MAP.get(gcp_disk, "gp3")
