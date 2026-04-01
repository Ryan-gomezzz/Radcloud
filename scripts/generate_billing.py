"""Generate realistic 12-month GCP billing CSV for the NovaPay demo infrastructure."""

import csv
import os
import random
from datetime import datetime

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


def main():
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

    # Write CSV
    out_path = os.path.join(os.path.dirname(__file__), "..", "data", "sample_billing.csv")
    out_path = os.path.abspath(out_path)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    with open(out_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)

    # Print monthly totals for verification
    monthly_totals = {}
    for row in rows:
        month = row["Usage start date"][:7]
        monthly_totals[month] = monthly_totals.get(month, 0) + row["Cost ($)"]

    print(f"Wrote {len(rows)} rows to {out_path}")
    print("\nMonthly GCP costs:")
    for month in sorted(monthly_totals):
        print(f"  {month}: ${monthly_totals[month]:,.2f}")
    avg = sum(monthly_totals.values()) / len(monthly_totals)
    total = sum(monthly_totals.values())
    print(f"\n  Average: ${avg:,.2f}/month")
    print(f"  Annual:  ${total:,.2f}")


if __name__ == "__main__":
    main()
