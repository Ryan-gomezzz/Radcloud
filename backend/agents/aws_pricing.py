"""Static AWS pricing reference tables — us-east-1, Linux.

Used as deterministic fallback when live AWS Pricing API is unavailable.
Prices sourced from published AWS rate cards (approximate).
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# EC2 on-demand hourly (us-east-1, Linux)
# ---------------------------------------------------------------------------
EC2_ONDEMAND: dict[str, float] = {
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

# 1-year All Upfront RI — effective hourly (~37 % discount)
EC2_RI_1YR: dict[str, float] = {k: round(v * 0.63, 4) for k, v in EC2_ONDEMAND.items()}

# Compute Savings Plan 1-year — effective hourly (~30 % discount)
EC2_SAVINGS_PLAN: dict[str, float] = {k: round(v * 0.70, 4) for k, v in EC2_ONDEMAND.items()}

# ---------------------------------------------------------------------------
# RDS on-demand hourly (Single-AZ, us-east-1)
# ---------------------------------------------------------------------------
RDS_ONDEMAND: dict[str, float] = {
    "db.t3.micro":   0.017,
    "db.t3.small":   0.034,
    "db.m5.large":   0.171,
    "db.m5.xlarge":  0.342,
    "db.m5.2xlarge": 0.684,
    "db.m5.4xlarge": 1.368,
    "db.r5.large":   0.240,
    "db.r5.xlarge":  0.480,
}

# 1-year All Upfront RI (~40 % discount)
RDS_RI_1YR: dict[str, float] = {k: round(v * 0.60, 4) for k, v in RDS_ONDEMAND.items()}

# ---------------------------------------------------------------------------
# S3 per-GB monthly
# ---------------------------------------------------------------------------
S3_PRICING: dict[str, float] = {
    "STANDARD":             0.023,
    "STANDARD_IA":          0.0125,
    "GLACIER_IR":           0.004,
    "GLACIER_DEEP_ARCHIVE": 0.00099,
}

# ---------------------------------------------------------------------------
# Lambda
# ---------------------------------------------------------------------------
LAMBDA_PRICE_PER_GB_SECOND: float = 0.0000166667
LAMBDA_PRICE_PER_REQUEST: float = 0.0000002

# ---------------------------------------------------------------------------
# Fargate (per vCPU-hour and per GB-hour)
# ---------------------------------------------------------------------------
FARGATE_VCPU_PER_HOUR: float = 0.04048
FARGATE_GB_PER_HOUR: float = 0.004445

# ---------------------------------------------------------------------------
# ElastiCache (Redis) on-demand hourly
# ---------------------------------------------------------------------------
ELASTICACHE_ONDEMAND: dict[str, float] = {
    "cache.t3.micro":  0.017,
    "cache.t3.small":  0.034,
    "cache.m5.large":  0.156,
    "cache.m5.xlarge": 0.312,
    "cache.r5.large":  0.228,
}

ELASTICACHE_RI_1YR: dict[str, float] = {
    k: round(v * 0.65, 4) for k, v in ELASTICACHE_ONDEMAND.items()
}
