"""Cost projection engine — maps GCP billing patterns to three AWS cost scenarios.

Scenarios produced:
1. AWS on-demand  (vanilla migration, no optimisations)
2. AWS optimised  (Day-0 RI / Savings Plans based on GCP usage patterns)
3. Original GCP   (for comparison baseline)

The *hero number* — ``total_first_year_savings`` — is the sum of all
individual RI recommendation ``annual_savings``.
"""

from __future__ import annotations

from agents.aws_pricing import (
    EC2_ONDEMAND, EC2_RI_1YR, EC2_SAVINGS_PLAN,
    RDS_ONDEMAND, RDS_RI_1YR,
    ELASTICACHE_ONDEMAND, ELASTICACHE_RI_1YR,
)

# Maps GCP service display-names to AWS pricing categories
GCP_TO_AWS_PRICING_CATEGORY: dict[str, str] = {
    "Compute Engine":   "ec2",
    "Cloud SQL":        "rds",
    "Cloud Storage":    "s3",
    "Cloud Run":        "fargate",
    "Cloud Functions":  "lambda",
    "Memorystore":      "elasticache",
    "Cloud Pub/Sub":    "sns_sqs",
    "BigQuery":         "athena",
    "Networking":       "data_transfer",
    "Cloud DNS":        "route53",
}


def _find_instance_type(gcp_service: str, aws_mappings: list[dict]) -> str | None:
    """Find the AWS instance type for a GCP service from the mapping output.

    Handles both the current stub format (``suggested_shape``) and the
    planned Dev 2 format (``aws_config.instance_type``).
    """
    for m in aws_mappings:
        # Match on several possible identifier fields
        mapped_gcp = (
            m.get("gcp_service")
            or m.get("gcp_resource")
            or ""
        )
        # Loose match: if the mapping mentions a keyword from the GCP service
        if (
            mapped_gcp.lower() in gcp_service.lower()
            or gcp_service.lower() in mapped_gcp.lower()
            or any(
                kw in mapped_gcp.lower()
                for kw in gcp_service.lower().split()
                if len(kw) > 3
            )
        ):
            # Try Dev 2 schema first, then stub schema
            instance_type = (
                m.get("aws_config", {}).get("instance_type")
                or m.get("suggested_shape")
            )
            if instance_type:
                return instance_type
    return None


def estimate_aws_costs(
    billing_patterns: list[dict],
    aws_mappings: list[dict] | None,
) -> dict:
    """Produce three cost scenarios and RI recommendations.

    Parameters
    ----------
    billing_patterns:
        Output of ``pattern_analyzer.analyze_patterns``.
    aws_mappings:
        Output of the mapping agent (may be *None* if Dev 2 isn't ready).
    """
    if aws_mappings is None:
        aws_mappings = []

    ri_recommendations: list[dict] = []
    total_monthly_ondemand = 0.0
    total_monthly_optimized = 0.0
    total_monthly_gcp = 0.0

    for pattern in billing_patterns:
        gcp_service = pattern["gcp_service"]
        avg_monthly = pattern["avg_monthly_cost"]
        workload_type = pattern["pattern"]
        total_monthly_gcp += avg_monthly

        category = GCP_TO_AWS_PRICING_CATEGORY.get(gcp_service, "other")
        matched_instance = _find_instance_type(gcp_service, aws_mappings)

        # ----------------------------------------------------------------
        # EC2
        # ----------------------------------------------------------------
        if category == "ec2":
            instance_type = matched_instance or "m5.xlarge"
            hourly_od = EC2_ONDEMAND.get(instance_type, 0.192)

            # Estimate instance count from GCP spend
            monthly_per_instance = hourly_od * 730
            est_instance_count = max(1, round(avg_monthly / monthly_per_instance))

            # If the count is unrealistically high for a single recommendation,
            # step up to a larger instance type to keep it believable (4-10 range)
            _INSTANCE_LADDER = [
                "m5.xlarge", "m5.2xlarge", "m5.4xlarge", "m5.8xlarge",
            ]
            if est_instance_count > 10 and instance_type in _INSTANCE_LADDER:
                for bigger in _INSTANCE_LADDER[_INSTANCE_LADDER.index(instance_type) + 1:]:
                    bigger_hourly = EC2_ONDEMAND.get(bigger, hourly_od)
                    bigger_count = max(1, round(avg_monthly / (bigger_hourly * 730)))
                    if bigger_count <= 10:
                        instance_type = bigger
                        hourly_od = bigger_hourly
                        est_instance_count = bigger_count
                        break

            hourly_ri = EC2_RI_1YR.get(instance_type, hourly_od * 0.63)
            hourly_sp = EC2_SAVINGS_PLAN.get(instance_type, hourly_od * 0.70)

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
                    "rationale": (
                        f"{est_instance_count} instance(s) running 24/7 with "
                        f"steady utilisation. RI gives ~37% savings."
                    ),
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
                    "rationale": (
                        "Predictable usage pattern. Compute Savings Plan "
                        "gives ~30% savings with flexibility."
                    ),
                })
            else:
                total_monthly_optimized += monthly_od  # no savings for bursty

        # ----------------------------------------------------------------
        # RDS
        # ----------------------------------------------------------------
        elif category == "rds":
            instance_type = matched_instance or "db.m5.xlarge"
            hourly_od = RDS_ONDEMAND.get(instance_type, 0.342)
            hourly_ri = RDS_RI_1YR.get(instance_type, hourly_od * 0.60)

            # Estimate number of DB instances from GCP Cloud SQL spend
            monthly_per_instance = hourly_od * 730
            est_db_count = max(1, round(avg_monthly / monthly_per_instance))

            # Auto-size up if count is unrealistic
            _RDS_LADDER = ["db.m5.large", "db.m5.xlarge", "db.m5.2xlarge", "db.m5.4xlarge"]
            if est_db_count > 4 and instance_type in _RDS_LADDER:
                for bigger in _RDS_LADDER[_RDS_LADDER.index(instance_type) + 1:]:
                    bigger_hourly = RDS_ONDEMAND.get(bigger, hourly_od)
                    bigger_count = max(1, round(avg_monthly / (bigger_hourly * 730)))
                    if bigger_count <= 4:
                        instance_type = bigger
                        hourly_od = bigger_hourly
                        hourly_ri = RDS_RI_1YR.get(instance_type, hourly_od * 0.60)
                        est_db_count = bigger_count
                        break

            monthly_od = hourly_od * 730 * est_db_count
            total_monthly_ondemand += monthly_od

            # Databases are almost always 24/7 — always recommend RI
            monthly_opt = hourly_ri * 730 * est_db_count
            total_monthly_optimized += monthly_opt
            savings_monthly = monthly_od - monthly_opt
            ri_recommendations.append({
                "aws_service": "RDS",
                "instance_type": instance_type,
                "quantity": est_db_count,
                "term": "1-year",
                "payment_option": "All Upfront",
                "monthly_ondemand_cost": round(monthly_od, 2),
                "monthly_ri_cost": round(monthly_opt, 2),
                "monthly_savings": round(savings_monthly, 2),
                "annual_savings": round(savings_monthly * 12, 2),
                "rationale": f"{est_db_count} database instance(s) running continuously. Reserved Instance gives ~40% savings.",
            })

        # ----------------------------------------------------------------
        # S3
        # ----------------------------------------------------------------
        elif category == "s3":
            monthly_od = avg_monthly * 1.05  # S3 slightly more expensive
            total_monthly_ondemand += monthly_od
            total_monthly_optimized += monthly_od  # no RI for S3

        # ----------------------------------------------------------------
        # Fargate (Cloud Run equivalent)
        # ----------------------------------------------------------------
        elif category == "fargate":
            monthly_od = avg_monthly * 1.1
            total_monthly_ondemand += monthly_od
            total_monthly_optimized += monthly_od  # bursty → stays on-demand

        # ----------------------------------------------------------------
        # Lambda (Cloud Functions equivalent)
        # ----------------------------------------------------------------
        elif category == "lambda":
            monthly_od = avg_monthly * 0.9  # Lambda is often slightly cheaper
            total_monthly_ondemand += monthly_od
            total_monthly_optimized += monthly_od

        # ----------------------------------------------------------------
        # ElastiCache (Memorystore equivalent)
        # ----------------------------------------------------------------
        elif category == "elasticache":
            instance_type = matched_instance or "cache.m5.large"
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

        # ----------------------------------------------------------------
        # Other / unclassified
        # ----------------------------------------------------------------
        else:
            total_monthly_ondemand += avg_monthly
            total_monthly_optimized += avg_monthly

    total_monthly_savings = total_monthly_ondemand - total_monthly_optimized

    # Hero number: first-year savings = sum of all RI annual savings
    # We derive from the recommendation list so the math is traceable.
    total_first_year_savings = sum(
        rec["annual_savings"] for rec in ri_recommendations
    )

    # Observation window waste: 3 months of RI savings thrown away waiting
    observation_window_waste = total_monthly_savings * 3

    return {
        "total_monthly_gcp": round(total_monthly_gcp, 2),
        "total_monthly_ondemand": round(total_monthly_ondemand, 2),
        "total_monthly_optimized": round(total_monthly_optimized, 2),
        "total_monthly_savings": round(total_monthly_savings, 2),
        "total_first_year_savings": round(total_first_year_savings, 2),
        "savings_vs_observation_window": round(observation_window_waste, 2),
        "ri_recommendations": ri_recommendations,
    }
