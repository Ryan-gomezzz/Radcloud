"""FinOps agent — stub: Day-0 cost optimization narrative."""

async def run(context: dict, claude_client) -> dict:
    context["finops"] = {
        "gcp_monthly_total": 9840.00,
        "aws_monthly_ondemand": 10320.00,
        "aws_monthly_optimized": 6387.00,
        "total_monthly_savings": 3933.00,
        "total_first_year_savings": 47200.00,
        "savings_vs_observation_window": 11800.00,
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
                "rationale": "2 instances running 24/7 with >90% utilization.",
            },
            {
                "aws_service": "RDS",
                "instance_type": "db.m5.xlarge",
                "quantity": 1,
                "term": "1-year",
                "payment_option": "Partial Upfront",
                "monthly_ondemand_cost": 410.00,
                "monthly_ri_cost": 260.00,
                "monthly_savings": 150.00,
                "annual_savings": 1800.00,
                "rationale": "Primary PostgreSQL always-on; align with Multi-AZ production profile.",
            },
        ],
        "cost_comparison": [
            {"month": "2024-01", "gcp_cost": 9200, "aws_ondemand": 9660, "aws_optimized": 6280},
            {"month": "2024-02", "gcp_cost": 9450, "aws_ondemand": 9920, "aws_optimized": 6310},
            {"month": "2024-03", "gcp_cost": 9600, "aws_ondemand": 10080, "aws_optimized": 6350},
            {"month": "2024-04", "gcp_cost": 9780, "aws_ondemand": 10250, "aws_optimized": 6370},
            {"month": "2024-05", "gcp_cost": 9900, "aws_ondemand": 10380, "aws_optimized": 6390},
            {"month": "2024-06", "gcp_cost": 9840, "aws_ondemand": 10320, "aws_optimized": 6387},
            {"month": "2024-07", "gcp_cost": 10100, "aws_ondemand": 10590, "aws_optimized": 6420},
            {"month": "2024-08", "gcp_cost": 9950, "aws_ondemand": 10440, "aws_optimized": 6400},
            {"month": "2024-09", "gcp_cost": 9700, "aws_ondemand": 10180, "aws_optimized": 6360},
            {"month": "2024-10", "gcp_cost": 9580, "aws_ondemand": 10050, "aws_optimized": 6340},
            {"month": "2024-11", "gcp_cost": 9720, "aws_ondemand": 10200, "aws_optimized": 6365},
            {"month": "2024-12", "gcp_cost": 9840, "aws_ondemand": 10320, "aws_optimized": 6387},
        ],
        "usage_patterns": [
            {
                "gcp_service": "Compute Engine",
                "pattern": "steady_state",
                "avg_monthly_cost": 3200.00,
                "recommendation": "reserved_instance",
                "description": "Runs near-continuously. Ideal for RIs.",
            },
            {
                "gcp_service": "Cloud SQL",
                "pattern": "steady_state",
                "avg_monthly_cost": 2800.00,
                "recommendation": "reserved_instance",
                "description": "Primary and replica always on; purchase RDS RI on baseline.",
            },
            {
                "gcp_service": "Cloud Run",
                "pattern": "bursty",
                "avg_monthly_cost": 890.00,
                "recommendation": "savings_plan_compute",
                "description": "Scale-to-zero capable; blend Fargate SP with min-capacity tuning.",
            },
        ],
        "summary": (
            "Your GCP environment costs $9,840/month on average. Lift-and-shift on-demand AWS would be "
            "$10,320/month (+4.9%), but RADCloud Day-0 optimization lands at $6,387/month (−35.1% vs on-demand "
            "AWS, −35.1% vs GCP baseline after rightsizing and RIs). First-year savings vs a traditional "
            "90-day FinOps observation path are estimated at $47,200, with $11,800 avoided waste during the "
            "observation window alone."
        ),
    }
    return context
