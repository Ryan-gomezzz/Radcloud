"""FinOps agent — stub."""


async def run(context: dict, claude_client) -> dict:
    context["finops"] = {
        "total_first_year_savings": 127_500,
        "summary": (
            "Right-sized EC2/RDS vs. on-demand GCP footprint; reserved capacity on stable baselines."
        ),
        "cost_comparison": [
            {"line": "Compute (annual)", "gcp_estimate": 48_000, "aws_estimate": 36_000},
            {"line": "Database (annual)", "gcp_estimate": 32_000, "aws_estimate": 26_000},
            {"line": "Storage + egress (annual)", "gcp_estimate": 14_000, "aws_estimate": 11_000},
        ],
        "ri_recommendations": [
            {"service": "EC2", "coverage_pct": 60, "term": "1yr Standard RI"},
            {"service": "RDS", "coverage_pct": 80, "term": "1yr Standard RI"},
        ],
    }
    return context
