"""Monthly cost-comparison builder — GCP actual vs AWS on-demand vs AWS optimised."""

from __future__ import annotations

import pandas as pd


def build_monthly_comparison(
    df: pd.DataFrame,
    cost_results: dict,
) -> list[dict]:
    """Build a month-by-month comparison table.

    Uses the ratio of aggregate AWS costs to GCP to project each individual
    month, preserving the real month-to-month shape of spending.
    """
    if "month" not in df.columns or "cost" not in df.columns:
        return []

    monthly_gcp = df.groupby("month")["cost"].sum().sort_index()

    gcp_total = cost_results.get("total_monthly_gcp", 0)
    if gcp_total == 0:
        return []

    od_ratio = cost_results["total_monthly_ondemand"] / gcp_total
    opt_ratio = cost_results["total_monthly_optimized"] / gcp_total

    comparison: list[dict] = []
    for month, gcp_cost in monthly_gcp.items():
        comparison.append({
            "month": str(month),
            "gcp_cost": round(float(gcp_cost), 2),
            "aws_ondemand": round(float(gcp_cost) * od_ratio, 2),
            "aws_optimized": round(float(gcp_cost) * opt_ratio, 2),
        })

    return comparison
