"""Generate realistic 12-month GCP billing CSV for RADCloud demo/testing.

Target: ~$8,500–$10,000/month GCP spend  →  $35K–$50K first-year AWS savings.

Run from the backend directory:
    python scripts/generate_test_billing.py

Outputs → data/sample_billing.csv
"""

from __future__ import annotations

import csv
import os
import random
from datetime import datetime, timedelta

random.seed(42)

# Each entry produces a single billing line per month.
# (service, sku, unit, target_monthly_cost, variance)
# We store the target monthly cost directly and back-calculate usage.
SERVICES = [
    # ======= COMPUTE ENGINE: ~$6,200/mo total =======
    # 2× n1-highmem-8 production API servers ($780/mo each)
    ("Compute Engine", "N1 HighMem-8 running in Americas",   "hour", 730, 1.068,  "low"),
    ("Compute Engine", "N1 HighMem-8 running in Americas",   "hour", 730, 1.068,  "low"),
    # 2× n1-standard-8 worker nodes ($560/mo each)
    ("Compute Engine", "N1 Standard-8 running in Americas",  "hour", 730, 0.767,  "low"),
    ("Compute Engine", "N1 Standard-8 running in Americas",  "hour", 730, 0.767,  "low"),
    # 1× n1-standard-16 ML pipeline ($1,120/mo)
    ("Compute Engine", "N1 Standard-16 running in Americas", "hour", 730, 1.534,  "low"),
    # 1× n1-standard-8 staging ($560/mo)
    ("Compute Engine", "N1 Standard-8 running in Americas",  "hour", 730, 0.767,  "low"),
    # Compute persistent disks ($160/mo)
    ("Compute Engine", "SSD backed PD capacity",  "gibibyte month", 2600, 0.060,  "low"),
    # GPU-attached instance for ML inference ($640/mo)
    ("Compute Engine", "N1 Standard-4 with GPU running",     "hour", 730, 0.877,  "low"),

    # ======= CLOUD SQL: ~$1,900/mo =======
    # Primary PostgreSQL HA ($1,060/mo)
    ("Cloud SQL", "PostgreSQL: N1 Standard 4 HA",  "hour", 730, 1.452,  "low"),
    # Read replica ($560/mo)
    ("Cloud SQL", "PostgreSQL: N1 Standard 2 Read Replica",  "hour", 730, 0.767,  "low"),
    # Cloud SQL storage ($170/mo)
    ("Cloud SQL", "Storage: SSD",  "gibibyte month", 1000, 0.170,  "low"),
    # Backups ($110/mo)
    ("Cloud SQL", "Automated Backup storage",  "gibibyte month", 800, 0.138,  "low"),

    # ======= MEMORYSTORE: ~$570/mo =======
    ("Memorystore", "Redis Standard M5 running",  "hour", 730, 0.473,  "low"),
    ("Memorystore", "Redis Standard M4 running",  "hour", 730, 0.308,  "low"),

    # ======= CLOUD STORAGE: ~$235/mo =======
    ("Cloud Storage", "Standard Storage US Multi-region",  "gibibyte month", 6500, 0.026,  "low"),
    ("Cloud Storage", "Download Egress Americas",  "gibibyte", 500, 0.120,  "low"),

    # ======= CLOUD RUN: bursty serverless, ~$300/mo avg =======
    ("Cloud Run", "CPU Allocation Time",  "vcpu-second", 8000000, 0.000024, "high"),
    ("Cloud Run", "Memory Allocation Time",  "gibibyte-second", 12000000, 0.0000025, "high"),

    # ======= CLOUD FUNCTIONS: bursty, ~$50/mo =======
    ("Cloud Functions", "CPU Time",  "GHz-second", 3500000, 0.00001, "high"),
    ("Cloud Functions", "Invocations",  "count", 50000000, 0.0000004, "high"),

    # ======= BIGQUERY: ~$650/mo =======
    ("BigQuery", "Analysis Bytes Processed",  "tebibyte", 130, 5.0, "med"),

    # ======= NETWORKING: ~$350/mo =======
    ("Networking", "Network Egress via Carrier Peering",  "gibibyte", 3200, 0.085, "med"),
    ("Networking", "Network Inter Region Egress",  "gibibyte", 6000, 0.012, "med"),

    # ======= PUB/SUB: ~$95/mo =======
    ("Cloud Pub/Sub", "Message Delivery Basic",  "mebibyte", 2375, 0.040, "med"),
]


def _jitter(base: float, vtype: str) -> float:
    if vtype == "low":
        return base * random.uniform(0.94, 1.06)
    elif vtype == "med":
        return base * random.uniform(0.75, 1.25)
    else:
        return base * random.uniform(0.25, 2.20)


def generate() -> list[dict]:
    rows: list[dict] = []
    for month_offset in range(12):
        year = 2024 + (month_offset // 12)
        month = (month_offset % 12) + 1
        month_start = datetime(year, month, 1)
        month_end = month_start + timedelta(days=29)

        for service_name, sku, unit, base_usage, unit_cost, vtype in SERVICES:
            usage = _jitter(base_usage, vtype)
            cost = round(usage * unit_cost, 2)
            rows.append({
                "Service description": service_name,
                "SKU description": sku,
                "Usage start date": month_start.strftime("%Y-%m-%d"),
                "Usage end date": month_end.strftime("%Y-%m-%d"),
                "Usage amount": round(usage, 2),
                "Usage unit": unit,
                "Cost ($)": cost,
            })
    return rows


def main() -> None:
    rows = generate()
    out_dir = os.path.join(os.path.dirname(__file__), "..", "..", "data")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "sample_billing.csv")
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    import collections
    monthly_costs: dict[str, float] = collections.defaultdict(float)
    for r in rows:
        m = r["Usage start date"][:7]
        monthly_costs[m] += r["Cost ($)"]
    avg = sum(monthly_costs.values()) / len(monthly_costs)
    print(f"Generated {len(rows)} rows -> {os.path.abspath(out_path)}")
    print(f"  Avg monthly: ${avg:,.2f}  Min: ${min(monthly_costs.values()):,.2f}  Max: ${max(monthly_costs.values()):,.2f}")


if __name__ == "__main__":
    main()
