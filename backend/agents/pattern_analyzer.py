"""Usage-pattern analyser — classifies GCP services as steady / predictable / bursty."""

from __future__ import annotations

import numpy as np
import pandas as pd


def analyze_patterns(df: pd.DataFrame) -> list[dict]:
    """Detect usage patterns per GCP service.

    Classification logic (based on coefficient of variation of monthly cost):
      * **steady_state** — CV < 0.15 and avg daily hours > 20  → recommend RI
      * **predictable**  — CV < 0.30 and avg daily hours > 12  → recommend Savings Plan
      * **bursty**       — everything else                      → keep on-demand

    Returns a list of dicts, one per service, ready for the cost engine.
    """
    patterns: list[dict] = []

    if "service" not in df.columns or "cost" not in df.columns:
        return patterns

    for service, group in df.groupby("service"):
        monthly = group.groupby("month")["cost"].sum()

        avg_monthly = monthly.mean()
        std_monthly = monthly.std() if len(monthly) > 1 else 0.0
        cv = (std_monthly / avg_monthly) if avg_monthly > 0 else 0.0  # coefficient of variation

        # Estimate daily usage hours from usage_amount when the unit is hours
        avg_daily_hours = 24.0  # default assumption for always-on services
        if "usage_amount" in group.columns and "usage_unit" in group.columns:
            hour_rows = group[
                group["usage_unit"].str.contains("hour", case=False, na=False)
            ]
            if len(hour_rows) > 0:
                total_hours = hour_rows["usage_amount"].sum()
                days_spanned = max(
                    (group["usage_start"].max() - group["usage_start"].min()).days, 1
                ) if "usage_start" in group.columns else 365
                avg_daily_hours = min(total_hours / days_spanned, 24.0)

        # ---- Classify pattern ----
        if cv < 0.15 and avg_daily_hours > 20:
            pattern = "steady_state"
            recommendation = "reserved_instance"
            description = (
                f"{service} runs near-continuously with low variance "
                f"(CV={cv:.2f}). Ideal candidate for Reserved Instances."
            )
        elif cv < 0.30 and avg_daily_hours > 12:
            pattern = "predictable"
            recommendation = "savings_plan"
            description = (
                f"{service} shows predictable usage patterns. "
                f"Savings Plans provide flexibility with discount."
            )
        else:
            pattern = "bursty"
            recommendation = "on_demand"
            description = (
                f"{service} has variable usage (CV={cv:.2f}). "
                f"Keep on-demand for cost efficiency."
            )

        peak_pct = min(
            int((monthly.max() / avg_monthly) * 100) if avg_monthly > 0 else 100,
            100,
        )

        patterns.append({
            "gcp_service": str(service),
            "pattern": pattern,
            "avg_monthly_cost": round(float(avg_monthly), 2),
            "avg_daily_hours": round(float(avg_daily_hours), 1),
            "peak_utilization_pct": peak_pct,
            "coefficient_of_variation": round(float(cv), 3),
            "recommendation": recommendation,
            "description": description,
        })

    return patterns
