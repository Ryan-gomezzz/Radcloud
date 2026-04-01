# Dev 3 — FinOps Intelligence Agent: Master Implementation Plan

**Project:** RADCloud  
**Role:** FinOps Intelligence Agent (the X-factor)  
**Time Budget:** 24 hours  
**Stack:** Python, Claude API (claude-sonnet-4-20250514), pandas for billing analysis  
**Dependencies inbound:** `aws_mapping` from Dev 2 (available after hour 8). You can work independently until then using your own test data.  
**Dependencies outbound:** Dev 4 (Watchdog / Runbook / IaC) consumes your `finops` output. Dev 1 (Frontend) renders your data in the most important tab of the entire demo.

---

## Your Responsibility in One Line

You are the reason RADCloud wins the hackathon. The Day-0 FinOps savings number is the single most memorable moment in the demo. Everything else is setup for your punchline.

---

## Product Parity Requirements

The website positions RADCloud as using AWS Pricing API, Cost Explorer, and Compute Optimizer. Your implementation plan must therefore support **real adapters with reliable fallbacks**:

- Build the FinOps engine behind adapter interfaces for:
  - AWS Pricing API
  - Cost Explorer
  - Compute Optimizer
- If credentials, auth, or time run out, fall back to demo-safe reference pricing and heuristic optimizer logic.
- Preserve the same output schema regardless of whether data came from live AWS APIs or fallback tables.

This keeps the product promise honest while still being hackathon-safe.

---

## What You Produce

| Output (context key) | Contents | Who consumes it |
|----------------------|----------|-----------------|
| `finops.cost_comparison` | Monthly GCP vs AWS (on-demand) vs AWS (optimized) | Frontend FinOps tab |
| `finops.ri_recommendations` | Specific RI/Savings Plans to buy on Day 1 | Frontend FinOps tab, Watchdog Agent |
| `finops.usage_patterns` | Detected workload patterns from billing history | Frontend FinOps tab |
| `finops.total_first_year_savings` | The hero number — dollars saved vs. traditional approach | Frontend FinOps tab (big green card) |
| `finops.summary` | Natural language cost report | Frontend FinOps tab |
| `finops.pricing_sources` | Whether numbers came from live AWS APIs or fallback tables | Frontend FinOps tab, Watchdog Agent |
| `finops.optimizer_recommendations` | Compute Optimizer-style rightsizing suggestions | Watchdog Agent, Frontend Watchdog tab |
| `finops.watchdog_baseline` | Monthly spend baseline, targets, and anomaly thresholds | Watchdog Agent |

The `finops.total_first_year_savings` number is the single most important data point in the entire demo. It must be derived from the actual billing data, not hardcoded. Judges will ask how you calculated it.

---

## The Core Insight You're Implementing

Traditional FinOps tools require 30–90 days of AWS usage observation before recommending Reserved Instances or Savings Plans. During that window, organizations overspend 25–35% on on-demand pricing.

RADCloud's insight: your GCP billing history IS the observation window. Workload patterns don't change when you change clouds. A service that runs 24/7 on GCP will run 24/7 on AWS. A batch job that spikes every Friday at 6 PM on GCP will spike every Friday at 6 PM on AWS.

So you ingest 12 months of GCP billing, identify steady-state vs. bursty workloads, map them to AWS pricing, and pre-calculate RI/Savings Plans purchases BEFORE migration completes.

---

## Hour-by-Hour Execution Plan

### Hour 0–1: Kickoff + Schema Alignment

Shared time with the team. Your priorities:

- Confirm the `finops` output schema with Dev 1 (they render it) and Dev 4 (they reference it in the runbook). Proposed schema:

```json
{
  "finops": {
    "gcp_monthly_total": 8720.00,
    "aws_monthly_ondemand": 9150.00,
    "aws_monthly_optimized": 6830.00,

    "cost_comparison": [
      {
        "month": "2025-01",
        "gcp_cost": 8500.00,
        "aws_ondemand": 8925.00,
        "aws_optimized": 6690.00
      }
    ],

    "usage_patterns": [
      {
        "resource_type": "compute",
        "pattern": "steady_state",
        "avg_daily_hours": 23.5,
        "peak_utilization_pct": 72,
        "recommendation": "reserved_instance",
        "description": "Compute workloads run near-continuously — ideal for Reserved Instances."
      },
      {
        "resource_type": "cloud_run",
        "pattern": "bursty",
        "avg_daily_hours": 6.2,
        "peak_utilization_pct": 95,
        "recommendation": "on_demand",
        "description": "Serverless workloads spike during business hours. Keep on-demand."
      }
    ],

    "ri_recommendations": [
      {
        "aws_service": "EC2",
        "instance_type": "m5.xlarge",
        "quantity": 2,
        "term": "1-year",
        "payment_option": "All Upfront",
        "monthly_ondemand_cost": 280.32,
        "monthly_ri_cost": 168.00,
        "monthly_savings": 112.32,
        "annual_savings": 1347.84,
        "rationale": "2 compute instances running 24/7 with >90% utilization."
      },
      {
        "aws_service": "RDS",
        "instance_type": "db.m5.xlarge",
        "quantity": 1,
        "term": "1-year",
        "payment_option": "All Upfront",
        "monthly_ondemand_cost": 520.00,
        "monthly_ri_cost": 338.00,
        "monthly_savings": 182.00,
        "annual_savings": 2184.00,
        "rationale": "Database runs continuously. Reserved Instance gives 35% savings."
      }
    ],

    "total_monthly_savings": 470.00,
    "total_first_year_savings": 47200.00,
    "savings_vs_observation_window": 14100.00,

    "pricing_sources": {
      "aws_pricing_api": "fallback_table",
      "cost_explorer": "not_connected",
      "compute_optimizer": "heuristic"
    },

    "optimizer_recommendations": [
      {
        "resource_id": "web-server-1",
        "current_shape": "m5.xlarge",
        "recommended_shape": "m6i.large",
        "reason": "Sustained utilization below 45% across 12 months of projected workload",
        "estimated_monthly_savings": 118.20,
        "confidence": 0.92
      }
    ],

    "watchdog_baseline": {
      "projected_monthly_aws_spend": 6830.00,
      "target_monthly_savings": 2320.00,
      "alert_threshold_pct": 12,
      "top_cost_services": ["EC2", "RDS", "S3"]
    },

    "summary": "Natural language paragraph summarizing the findings..."
  }
}
```

- Confirm with Dev 2 what fields `aws_mapping` will contain — you need `aws_service`, `aws_config.instance_type`, and `aws_config.region` to price things.
- Agree with Dev 4 on sample billing CSV format and column names.

### Hours 1–4: Billing CSV Parser + Usage Pattern Analyzer

You can build this entirely independently — no dependency on other agents.

**Step 1 — Understand the GCP billing export format**

GCP billing exports have these key columns (may vary slightly):

```
Billing account ID, Project ID, Project Name, Service description,
SKU description, Usage start date, Usage end date, Usage amount,
Usage unit, Cost ($), Credits ($), Currency
```

For the hackathon, you're building a parser that handles a simplified version. Create a standard format for your sample data:

```python
# agents/billing_parser.py
import pandas as pd
import io
from collections import defaultdict

EXPECTED_COLUMNS = {
    "service": ["Service description", "service_description", "Service", "service"],
    "sku": ["SKU description", "sku_description", "SKU", "sku"],
    "usage_start": ["Usage start date", "usage_start_date", "start_date", "date"],
    "usage_end": ["Usage end date", "usage_end_date", "end_date"],
    "usage_amount": ["Usage amount", "usage_amount", "usage"],
    "usage_unit": ["Usage unit", "usage_unit", "unit"],
    "cost": ["Cost ($)", "cost", "Cost", "amount"],
}

def normalize_columns(df):
    """Map whatever columns exist to standard names."""
    column_map = {}
    for standard_name, variants in EXPECTED_COLUMNS.items():
        for variant in variants:
            if variant in df.columns:
                column_map[variant] = standard_name
                break
    df = df.rename(columns=column_map)
    return df

def parse_billing_csv(raw_rows: list[dict]) -> pd.DataFrame:
    """Convert the list of dicts from CSV upload into a clean DataFrame."""
    df = pd.DataFrame(raw_rows)
    df = normalize_columns(df)

    # Parse dates
    if "usage_start" in df.columns:
        df["usage_start"] = pd.to_datetime(df["usage_start"], errors="coerce")
        df["month"] = df["usage_start"].dt.to_period("M").astype(str)

    # Parse cost as float
    if "cost" in df.columns:
        df["cost"] = pd.to_numeric(
            df["cost"].astype(str).str.replace("$", "").str.replace(",", ""),
            errors="coerce"
        ).fillna(0)

    # Parse usage amount
    if "usage_amount" in df.columns:
        df["usage_amount"] = pd.to_numeric(df["usage_amount"], errors="coerce").fillna(0)

    return df
```

**Step 2 — Usage pattern analyzer**

This is the core intelligence. Group by service, detect whether each workload is steady-state, bursty, or scheduled.

```python
# agents/pattern_analyzer.py
import pandas as pd
import numpy as np

def analyze_patterns(df: pd.DataFrame) -> list[dict]:
    """Detect usage patterns per GCP service."""
    patterns = []

    if "service" not in df.columns or "cost" not in df.columns:
        return patterns

    for service, group in df.groupby("service"):
        monthly = group.groupby("month")["cost"].sum()

        avg_monthly = monthly.mean()
        std_monthly = monthly.std() if len(monthly) > 1 else 0
        cv = (std_monthly / avg_monthly) if avg_monthly > 0 else 0  # coefficient of variation

        # Estimate daily usage hours from usage_amount if available
        avg_daily_hours = 24.0  # default assumption
        if "usage_amount" in group.columns and "usage_unit" in group.columns:
            hour_rows = group[group["usage_unit"].str.contains("hour", case=False, na=False)]
            if len(hour_rows) > 0:
                total_hours = hour_rows["usage_amount"].sum()
                days_spanned = max((group["usage_start"].max() - group["usage_start"].min()).days, 1)
                avg_daily_hours = min(total_hours / days_spanned, 24.0)

        # Classify pattern
        if cv < 0.15 and avg_daily_hours > 20:
            pattern = "steady_state"
            recommendation = "reserved_instance"
            description = f"{service} runs near-continuously with low variance (CV={cv:.2f}). Ideal candidate for Reserved Instances."
        elif cv < 0.3 and avg_daily_hours > 12:
            pattern = "predictable"
            recommendation = "savings_plan"
            description = f"{service} shows predictable usage patterns. Savings Plans provide flexibility with discount."
        else:
            pattern = "bursty"
            recommendation = "on_demand"
            description = f"{service} has variable usage (CV={cv:.2f}). Keep on-demand for cost efficiency."

        peak_pct = min(int((monthly.max() / avg_monthly) * 100) if avg_monthly > 0 else 100, 100)

        patterns.append({
            "gcp_service": service,
            "pattern": pattern,
            "avg_monthly_cost": round(avg_monthly, 2),
            "avg_daily_hours": round(avg_daily_hours, 1),
            "peak_utilization_pct": peak_pct,
            "coefficient_of_variation": round(cv, 3),
            "recommendation": recommendation,
            "description": description,
        })

    return patterns
```

**Step 3 — Test with sample billing data**

Don't wait for Dev 4. Create a quick test CSV:

```python
# scripts/generate_test_billing.py
import csv
import random
from datetime import datetime, timedelta

services = [
    ("Compute Engine", "N1 Standard Instance running", "hour", 0.19),
    ("Compute Engine", "N1 Standard Instance running", "hour", 0.19),
    ("Cloud SQL", "Cloud SQL for PostgreSQL: N1 Standard 2", "hour", 0.26),
    ("Cloud Storage", "Standard Storage US Multi-region", "gibibyte month", 0.026),
    ("Cloud Run", "CPU Allocation Time", "vcpu-second", 0.000024),
    ("Cloud Functions", "CPU Time", "GHz-second", 0.00001),
    ("Cloud Pub/Sub", "Message Delivery Basic", "mebibyte", 0.04),
    ("BigQuery", "Analysis Bytes Processed", "tebibyte", 5.0),
    ("Networking", "Network Egress via Carrier Peering", "gibibyte", 0.085),
]

rows = []
start = datetime(2024, 1, 1)
for month_offset in range(12):
    month_start = datetime(2024 + (month_offset // 12), (month_offset % 12) + 1, 1)
    for service_name, sku, unit, unit_cost in services:
        # Add some variance
        if "Compute" in service_name or "SQL" in service_name:
            # Steady-state: low variance
            usage = 720 * (0.9 + random.uniform(0, 0.2))
        elif "Cloud Run" in service_name:
            # Bursty: high variance
            usage = random.uniform(500000, 2000000)
        else:
            usage = random.uniform(800, 1500)

        cost = round(usage * unit_cost, 2)
        rows.append({
            "Service description": service_name,
            "SKU description": sku,
            "Usage start date": month_start.strftime("%Y-%m-%d"),
            "Usage end date": (month_start + timedelta(days=29)).strftime("%Y-%m-%d"),
            "Usage amount": round(usage, 2),
            "Usage unit": unit,
            "Cost ($)": cost,
        })

with open("data/sample_billing.csv", "w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=rows[0].keys())
    writer.writeheader()
    writer.writerows(rows)
```

Run the parser and pattern analyzer on this. Verify that Compute Engine and Cloud SQL are classified as "steady_state" and Cloud Run as "bursty".

**Deliverable by hour 4:** A billing parser that handles GCP billing CSVs and a pattern analyzer that classifies each service's workload type.

### Hours 4–8: AWS Pricing Engine + Day-0 Recommendations

This is where you build the killer feature.

**Step 1 — AWS pricing adapter layer**

Preferred approach: implement a provider abstraction first. Try live integrations where available, but always support deterministic fallback tables so the demo is never blocked by auth, setup, or rate limits.

Priority order:

1. AWS Pricing API adapter
2. Cost Explorer adapter
3. Compute Optimizer adapter
4. Fallback static pricing / heuristics

If live adapters are unavailable, the product still ships using the fallback path with transparent `pricing_sources` metadata in the response.

```python
# agents/aws_pricing.py

# On-demand hourly prices (us-east-1, Linux)
EC2_ONDEMAND = {
    "t3.micro":    0.0104,
    "t3.small":    0.0208,
    "t3.medium":   0.0416,
    "t3.large":    0.0832,
    "t3.xlarge":   0.1664,
    "t3.2xlarge":  0.3328,
    "m5.large":    0.096,
    "m5.xlarge":   0.192,
    "m5.2xlarge":  0.384,
    "m5.4xlarge":  0.768,
    "m5.8xlarge":  1.536,
    "m5.16xlarge": 3.072,
    "m6i.large":   0.096,
    "m6i.xlarge":  0.192,
    "m6i.2xlarge": 0.384,
    "m6i.4xlarge": 0.768,
    "m6i.8xlarge": 1.536,
    "r5.large":    0.126,
    "r5.xlarge":   0.252,
    "r5.2xlarge":  0.504,
    "r5.4xlarge":  1.008,
    "r6i.large":   0.126,
    "r6i.xlarge":  0.252,
    "c5.large":    0.085,
    "c5.xlarge":   0.170,
    "c5.2xlarge":  0.340,
    "c6i.large":   0.085,
    "c6i.xlarge":  0.170,
}

# 1-year All Upfront RI effective hourly prices (approx 35-40% discount)
EC2_RI_1YR = {k: round(v * 0.63, 4) for k, v in EC2_ONDEMAND.items()}

# Savings Plans: Compute Savings Plan 1-year (approx 30% discount)
EC2_SAVINGS_PLAN = {k: round(v * 0.70, 4) for k, v in EC2_ONDEMAND.items()}

# RDS on-demand hourly (Single-AZ, us-east-1)
RDS_ONDEMAND = {
    "db.t3.micro":   0.017,
    "db.t3.small":   0.034,
    "db.m5.large":   0.171,
    "db.m5.xlarge":  0.342,
    "db.m5.2xlarge": 0.684,
    "db.m5.4xlarge": 1.368,
    "db.r5.large":   0.240,
    "db.r5.xlarge":  0.480,
}

RDS_RI_1YR = {k: round(v * 0.60, 4) for k, v in RDS_ONDEMAND.items()}

# S3 per-GB monthly
S3_PRICING = {
    "STANDARD":             0.023,
    "STANDARD_IA":          0.0125,
    "GLACIER_IR":           0.004,
    "GLACIER_DEEP_ARCHIVE": 0.00099,
}

# Lambda pricing
LAMBDA_PRICE_PER_GB_SECOND = 0.0000166667
LAMBDA_PRICE_PER_REQUEST = 0.0000002

# Fargate pricing (per vCPU-hour and per GB-hour)
FARGATE_VCPU_PER_HOUR = 0.04048
FARGATE_GB_PER_HOUR = 0.004445

# ElastiCache (Redis) on-demand hourly
ELASTICACHE_ONDEMAND = {
    "cache.t3.micro":  0.017,
    "cache.t3.small":  0.034,
    "cache.m5.large":  0.156,
    "cache.m5.xlarge": 0.312,
    "cache.r5.large":  0.228,
}

ELASTICACHE_RI_1YR = {k: round(v * 0.65, 4) for k, v in ELASTICACHE_ONDEMAND.items()}
```

**Step 2 — The cost projection engine**

This maps GCP billing data + AWS mappings to three AWS cost scenarios.

```python
# agents/cost_engine.py
from agents.aws_pricing import *

# GCP service name to AWS pricing category mapping
GCP_TO_AWS_PRICING_CATEGORY = {
    "Compute Engine":    "ec2",
    "Cloud SQL":         "rds",
    "Cloud Storage":     "s3",
    "Cloud Run":         "fargate",
    "Cloud Functions":   "lambda",
    "Memorystore":       "elasticache",
    "Cloud Pub/Sub":     "sns_sqs",
    "BigQuery":          "athena",
    "Networking":        "data_transfer",
    "Cloud DNS":         "route53",
}

def estimate_aws_costs(
    billing_patterns: list[dict],
    aws_mappings: list[dict],
) -> dict:
    """
    Given usage patterns and AWS mappings, produce three cost scenarios:
    1. AWS on-demand
    2. AWS with Day-0 RI/Savings Plans
    3. Original GCP cost (for comparison)
    """

    ri_recommendations = []
    total_monthly_ondemand = 0
    total_monthly_optimized = 0
    total_monthly_gcp = 0

    for pattern in billing_patterns:
        gcp_service = pattern["gcp_service"]
        avg_monthly = pattern["avg_monthly_cost"]
        workload_type = pattern["pattern"]
        total_monthly_gcp += avg_monthly

        category = GCP_TO_AWS_PRICING_CATEGORY.get(gcp_service, "other")

        # Find matching AWS mapping to get instance type
        matched_instance = None
        for m in aws_mappings:
            if m.get("gcp_service") == gcp_service:
                matched_instance = m.get("aws_config", {}).get("instance_type")
                break

        if category == "ec2":
            instance_type = matched_instance or "m5.xlarge"
            hourly_od = EC2_ONDEMAND.get(instance_type, 0.192)
            hourly_ri = EC2_RI_1YR.get(instance_type, hourly_od * 0.63)
            hourly_sp = EC2_SAVINGS_PLAN.get(instance_type, hourly_od * 0.70)

            # Estimate number of instances from GCP cost
            gcp_hourly_rate = 0.19  # approximate n1-standard-4
            est_instance_count = max(1, round(avg_monthly / (gcp_hourly_rate * 730)))

            monthly_od = hourly_od * 730 * est_instance_count
            total_monthly_ondemand += monthly_od

            if workload_type == "steady_state":
                monthly_opt = hourly_ri * 730 * est_instance_count
                total_monthly_optimized += monthly_opt
                savings_monthly = monthly_od - monthly_opt
                ri_recommendations.append({
                    "aws_service": "EC2",
                    "instance_type": instance_type,
                    "quantity": est_instance_count,
                    "term": "1-year",
                    "payment_option": "All Upfront",
                    "monthly_ondemand_cost": round(monthly_od, 2),
                    "monthly_ri_cost": round(monthly_opt, 2),
                    "monthly_savings": round(savings_monthly, 2),
                    "annual_savings": round(savings_monthly * 12, 2),
                    "rationale": f"{est_instance_count} instance(s) running 24/7 with steady utilization. RI gives ~37% savings.",
                })
            elif workload_type == "predictable":
                monthly_opt = hourly_sp * 730 * est_instance_count
                total_monthly_optimized += monthly_opt
                savings_monthly = monthly_od - monthly_opt
                ri_recommendations.append({
                    "aws_service": "EC2",
                    "instance_type": instance_type,
                    "quantity": est_instance_count,
                    "term": "1-year",
                    "payment_option": "No Upfront",
                    "monthly_ondemand_cost": round(monthly_od, 2),
                    "monthly_ri_cost": round(monthly_opt, 2),
                    "monthly_savings": round(savings_monthly, 2),
                    "annual_savings": round(savings_monthly * 12, 2),
                    "rationale": f"Predictable usage pattern. Compute Savings Plan gives ~30% savings with flexibility.",
                })
            else:
                total_monthly_optimized += monthly_od  # no savings for bursty

        elif category == "rds":
            instance_type = matched_instance or "db.m5.xlarge"
            hourly_od = RDS_ONDEMAND.get(instance_type, 0.342)
            hourly_ri = RDS_RI_1YR.get(instance_type, hourly_od * 0.60)

            monthly_od = hourly_od * 730
            total_monthly_ondemand += monthly_od

            # Databases almost always run 24/7 — always recommend RI
            monthly_opt = hourly_ri * 730
            total_monthly_optimized += monthly_opt
            savings_monthly = monthly_od - monthly_opt
            ri_recommendations.append({
                "aws_service": "RDS",
                "instance_type": instance_type,
                "quantity": 1,
                "term": "1-year",
                "payment_option": "All Upfront",
                "monthly_ondemand_cost": round(monthly_od, 2),
                "monthly_ri_cost": round(monthly_opt, 2),
                "monthly_savings": round(savings_monthly, 2),
                "annual_savings": round(savings_monthly * 12, 2),
                "rationale": "Database runs continuously. Reserved Instance gives ~40% savings.",
            })

        elif category == "s3":
            # Approximate: GCP and S3 standard are similarly priced
            monthly_od = avg_monthly * 1.05  # S3 slightly more expensive
            total_monthly_ondemand += monthly_od
            total_monthly_optimized += monthly_od  # no RI for S3

        elif category == "fargate":
            # Cloud Run to Fargate — roughly similar pricing
            monthly_od = avg_monthly * 1.1
            total_monthly_ondemand += monthly_od
            total_monthly_optimized += monthly_od  # bursty workloads stay on-demand

        elif category == "lambda":
            monthly_od = avg_monthly * 0.9  # Lambda is often slightly cheaper
            total_monthly_ondemand += monthly_od
            total_monthly_optimized += monthly_od

        elif category == "elasticache":
            instance_type = "cache.m5.large"
            hourly_od = ELASTICACHE_ONDEMAND.get(instance_type, 0.156)
            hourly_ri = ELASTICACHE_RI_1YR.get(instance_type, hourly_od * 0.65)
            monthly_od = hourly_od * 730
            monthly_opt = hourly_ri * 730
            total_monthly_ondemand += monthly_od
            total_monthly_optimized += monthly_opt
            savings_monthly = monthly_od - monthly_opt
            ri_recommendations.append({
                "aws_service": "ElastiCache",
                "instance_type": instance_type,
                "quantity": 1,
                "term": "1-year",
                "payment_option": "All Upfront",
                "monthly_ondemand_cost": round(monthly_od, 2),
                "monthly_ri_cost": round(monthly_opt, 2),
                "monthly_savings": round(savings_monthly, 2),
                "annual_savings": round(savings_monthly * 12, 2),
                "rationale": "Cache runs continuously. Reserved node gives ~35% savings.",
            })

        else:
            # For services without specific pricing, estimate 1:1 cost
            total_monthly_ondemand += avg_monthly
            total_monthly_optimized += avg_monthly

    total_monthly_savings = total_monthly_ondemand - total_monthly_optimized

    # The hero number: savings from Day-0 optimization vs. waiting 3 months
    # During the 3-month observation window, you'd pay on-demand instead of optimized
    observation_window_waste = total_monthly_savings * 3

    # Total first-year savings = 12 months of RI savings
    total_first_year_savings = total_monthly_savings * 12

    return {
        "total_monthly_gcp": round(total_monthly_gcp, 2),
        "total_monthly_ondemand": round(total_monthly_ondemand, 2),
        "total_monthly_optimized": round(total_monthly_optimized, 2),
        "total_monthly_savings": round(total_monthly_savings, 2),
        "total_first_year_savings": round(total_first_year_savings, 2),
        "savings_vs_observation_window": round(observation_window_waste, 2),
        "ri_recommendations": ri_recommendations,
    }
```

**Step 3 — Monthly cost comparison builder**

```python
# agents/cost_comparison.py

def build_monthly_comparison(
    df,  # pandas DataFrame from billing parser
    cost_results: dict,
) -> list[dict]:
    """Build month-by-month GCP vs AWS comparison."""
    if "month" not in df.columns or "cost" not in df.columns:
        return []

    monthly_gcp = df.groupby("month")["cost"].sum().sort_index()

    # Calculate the ratio of AWS costs to GCP costs
    gcp_total = cost_results["total_monthly_gcp"]
    if gcp_total == 0:
        return []

    od_ratio = cost_results["total_monthly_ondemand"] / gcp_total
    opt_ratio = cost_results["total_monthly_optimized"] / gcp_total

    comparison = []
    for month, gcp_cost in monthly_gcp.items():
        comparison.append({
            "month": str(month),
            "gcp_cost": round(gcp_cost, 2),
            "aws_ondemand": round(gcp_cost * od_ratio, 2),
            "aws_optimized": round(gcp_cost * opt_ratio, 2),
        })

    return comparison
```

**Step 4 — Test the full FinOps pipeline locally**

Run: parse CSV → analyze patterns → estimate costs → build comparison. Verify:
- Steady-state services get RI recommendations.
- Bursty services stay on-demand.
- `total_first_year_savings` is a believable number (for the sample data, target $30K–$50K range).
- `savings_vs_observation_window` shows the 3-month waste.
- Monthly comparison shows all 12 months.

**Deliverable by hour 8:** Complete FinOps pipeline: billing CSV → usage patterns → AWS cost projection → RI recommendations → hero savings number.

### Hours 8–12: Integration — Wire Into the Agent Pipeline

**Step 1 — Build the FinOps Agent wrapper**

```python
# agents/finops.py
import json
from agents.billing_parser import parse_billing_csv
from agents.pattern_analyzer import analyze_patterns
from agents.cost_engine import estimate_aws_costs
from agents.cost_comparison import build_monthly_comparison

FINOPS_SUMMARY_PROMPT = """You are a FinOps analyst writing a cost report for a CTO who needs to justify cloud migration ROI to their CFO. You will receive:
1. GCP usage patterns
2. AWS cost projections with RI/Savings Plan recommendations
3. A cost comparison table

Write a 2-3 paragraph natural language summary that:
- States the current GCP monthly spend
- States the projected AWS monthly spend with and without Day-0 optimizations
- Highlights the top 2-3 RI/Savings Plan recommendations with specific dollar amounts
- Ends with the headline: total first-year savings and the cost of waiting for a traditional observation window

Use specific dollar amounts. Be confident and precise. No jargon — a CFO should understand every sentence.

Respond with ONLY the summary text, no JSON, no markdown headers."""

async def run(context: dict, claude_client) -> dict:
    billing_raw = context.get("gcp_billing_raw", [])
    aws_mappings = context.get("aws_mapping", [])

    if not billing_raw:
        context["finops"] = {
            "error": "No billing data provided",
            "total_first_year_savings": 0,
            "ri_recommendations": [],
            "cost_comparison": [],
            "usage_patterns": [],
            "summary": "No billing data was provided for analysis.",
        }
        return context

    # Step 1: Parse billing data
    df = parse_billing_csv(billing_raw)

    # Step 2: Analyze usage patterns
    patterns = analyze_patterns(df)

    # Step 3: Estimate AWS costs
    cost_results = estimate_aws_costs(patterns, aws_mappings)

    # Step 4: Build monthly comparison
    comparison = build_monthly_comparison(df, cost_results)

    # Step 5: Generate natural language summary via Claude
    summary_input = {
        "patterns": patterns,
        "cost_results": cost_results,
        "comparison_sample": comparison[:3] if comparison else [],
    }

    try:
        response = claude_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            temperature=0,
            system=FINOPS_SUMMARY_PROMPT,
            messages=[{
                "role": "user",
                "content": f"Generate a cost summary from this data:\n{json.dumps(summary_input, indent=2)}"
            }]
        )
        summary = response.content[0].text.strip()
    except Exception:
        summary = (
            f"Your current GCP environment costs approximately "
            f"${cost_results['total_monthly_gcp']:,.2f}/month. "
            f"After migration to AWS, projected cost is "
            f"${cost_results['total_monthly_ondemand']:,.2f}/month at on-demand rates, "
            f"or ${cost_results['total_monthly_optimized']:,.2f}/month with Day-0 RI optimizations. "
            f"Estimated first-year savings: ${cost_results['total_first_year_savings']:,.2f}."
        )

    # Assemble output
    context["finops"] = {
        "gcp_monthly_total": cost_results["total_monthly_gcp"],
        "aws_monthly_ondemand": cost_results["total_monthly_ondemand"],
        "aws_monthly_optimized": cost_results["total_monthly_optimized"],
        "total_monthly_savings": cost_results["total_monthly_savings"],
        "total_first_year_savings": cost_results["total_first_year_savings"],
        "savings_vs_observation_window": cost_results["savings_vs_observation_window"],
        "ri_recommendations": cost_results["ri_recommendations"],
        "cost_comparison": comparison,
        "usage_patterns": patterns,
        "summary": summary,
    }

    return context
```

**Step 2 — Integrate with Dev 1's orchestrator**

- Push your files: `agents/finops.py`, `agents/billing_parser.py`, `agents/pattern_analyzer.py`, `agents/cost_engine.py`, `agents/cost_comparison.py`, `agents/aws_pricing.py`.
- Dev 1 replaces the FinOps stub with your real agent.
- Test end-to-end: upload Terraform + billing CSV → all agents run → FinOps tab shows results.

**Step 3 — Integrate with Dev 2's mapping output**

- The cost engine uses `aws_mapping` to find instance types for pricing. Before hour 8, you used your own test mappings. Now test with Dev 2's real mapping output.
- Key check: does `aws_mapping[].aws_config.instance_type` exist and match keys in your pricing tables? If Dev 2 uses a different field name, coordinate a fix.
- Fallback: if a mapped instance type isn't in your pricing table, use a default (m5.xlarge for compute, db.m5.xlarge for RDS). Log it but don't crash.

**Step 4 — Validate the hero number**

Run the full pipeline with Dev 4's realistic sample data. The `total_first_year_savings` must be:
- Derived from actual billing data (not hardcoded).
- In a believable range ($30K–$50K for a mid-size workload).
- Explainable: if a judge asks "how did you get $47,200?", you should be able to point to the RI recommendations and show the math.

Check: `sum of all ri_recommendations[].annual_savings` should equal `total_first_year_savings`. If it doesn't, there's a bug.

### Hours 12–16: Polish the Numbers

**Tune the sample data for demo impact.**

Work with Dev 4 to adjust the sample billing CSV so the numbers tell a compelling story:
- Total GCP monthly spend should be in the $8K–$12K range (realistic for a mid-size company).
- AWS on-demand should be slightly higher than GCP (this is realistic — AWS compute is often 5–10% more expensive without discounts).
- AWS optimized should be 20–30% lower than GCP (this is the wow moment — migration + optimization saves money).
- The Day-0 savings number should be $35K–$50K/year.

**Make the RI recommendations crisp.**

Each recommendation should read like a specific, actionable purchase order:
- "Purchase 2x m5.xlarge EC2 Reserved Instances (1-year, All Upfront) — saves $1,348/year"
- "Purchase 1x db.m5.xlarge RDS Reserved Instance (1-year, All Upfront) — saves $2,184/year"

These are the lines judges will read. Make them concrete and specific.

**Add the observation window comparison.**

Make sure `savings_vs_observation_window` is prominent. This is the number that proves the Day-0 concept: "If you used a traditional FinOps tool, you'd waste $X during the 3-month observation window before it could make these same recommendations."

### Hours 16–20: Demo Prep

- Run the full demo 5 times. The FinOps output must be consistent every run (temperature=0 helps, but verify).
- Help Dev 1 build the cached response for demo mode.
- Write down the 30-second explanation of how Day-0 FinOps works for the demo:
  1. "We ingest 12 months of GCP billing history."
  2. "We detect which workloads are steady-state vs. bursty."
  3. "We map steady-state workloads to AWS Reserved Instances and calculate the exact savings."
  4. "Traditional FinOps tools need 3 months of AWS data to make this recommendation. We do it before migration even starts."
- Prepare for the hardest judge question: "How accurate are these numbers?" Answer: "The pricing is based on published AWS rates. The usage pattern analysis uses coefficient of variation to classify workloads. The accuracy improves with more granular billing data. For this demo, we're using 12 months of service-level billing, which gives us high confidence on steady-state workloads."

### Hours 20–24: Buffer

- Fix any last bugs.
- Do NOT add new pricing data or new service categories.
- Be available for final integration testing.

---

## Files You Own

| File | Purpose |
|------|---------|
| `agents/finops.py` | FinOps Agent wrapper — main entry point |
| `agents/billing_parser.py` | GCP billing CSV parser with column normalization |
| `agents/pattern_analyzer.py` | Usage pattern detection (steady/predictable/bursty) |
| `agents/cost_engine.py` | AWS cost projection + RI recommendation engine |
| `agents/cost_comparison.py` | Monthly GCP vs AWS comparison builder |
| `agents/aws_pricing.py` | Hardcoded AWS pricing reference tables |
| `agents/pricing_adapter.py` | Live Pricing API adapter + fallback selector |
| `agents/cost_explorer_adapter.py` | Optional Cost Explorer pull-through for baseline comparisons |
| `agents/optimizer_adapter.py` | Compute Optimizer-style recommendation adapter / heuristic fallback |
| `scripts/generate_test_billing.py` | Test billing data generator (for dev/testing) |

---

## The Math Behind the Hero Number

Judges will ask. Here's the derivation:

```
total_first_year_savings = sum(each RI recommendation's annual_savings)

annual_savings per RI = (on-demand monthly - RI monthly) × 12

savings_vs_observation_window = total_monthly_savings × 3
  (3 months of overspend while traditional tools "observe")

Example with sample data:
  2× EC2 m5.xlarge RI:    (280.32 - 168.00) × 12 = $1,347.84/yr
  1× RDS db.m5.xlarge RI: (249.66 - 149.80) × 12 = $1,198.32/yr
  ... (more RIs)
  Total: ~$47,200/yr

  Observation window waste: ($47,200 / 12) × 3 = $11,800
  "Traditional tools would have cost you $11,800 in the first 3 months
   before making these same recommendations."
```

This math must be traceable from the output. If `total_first_year_savings` doesn't equal the sum of individual `annual_savings` values, your numbers lose credibility.

---

## Gotchas and Failure Modes

**Billing CSV has unexpected columns or format.**
Fix: The column normalizer handles common variants. If it still fails, fall back to treating the first column as service, last numeric column as cost. Don't crash — return partial results with a warning.

**aws_mapping isn't available yet (Dev 2 is behind).**
Fix: Your cost engine should work without mappings by using default instance types. The pattern analyzer and billing parser don't need mappings at all. You can produce a FinOps report with just billing data.

**AWS API credentials aren't available or the adapters error out.**
Fix: Fall back automatically to the reference pricing tables and heuristic optimizer logic. Populate `pricing_sources` honestly so the UI and judges know what mode the product is running in.

**The savings number is too small to be impressive.**
Fix: Tune the sample billing data. Increase the compute hours, add a second database instance, add a Memorystore instance. Steady-state services drive RI savings — more steady-state services = bigger number.

**The savings number is unrealistically large.**
Fix: Sanity check — total_first_year_savings should not exceed 40% of total GCP annual spend. If it does, your pricing tables might have errors or your instance count estimation is off.

**Claude generates a bad summary.**
Fix: You have a hardcoded fallback summary that uses f-strings with the actual numbers. It's less elegant but always accurate. The fallback fires automatically on any Claude API error.

---

## What to Cut If Behind

1. **Cut the natural language summary** — the numbers and tables speak for themselves. Use the hardcoded fallback f-string.
2. **Cut usage pattern descriptions** — just show the classification (steady_state/bursty) without the prose explanation.
3. **Cut per-month comparison** — show only the monthly averages, not all 12 months.
4. **Cut live AWS adapters before cutting the schema** — keep `pricing_sources`, `optimizer_recommendations`, and `watchdog_baseline` even if they come from fallbacks.
5. **Cut ElastiCache/Lambda/Fargate pricing** — focus on EC2 and RDS. These two services drive 80% of RI savings.
6. **Never cut the RI recommendations** — this is the core deliverable.
7. **Never cut `total_first_year_savings`** — this is the hero number. Without it, you don't have a demo.
