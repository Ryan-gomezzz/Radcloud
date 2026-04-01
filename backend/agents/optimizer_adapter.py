"""Compute Optimizer adapter — heuristic rightsizing recommendations.

When live AWS Compute Optimizer access is unavailable (the typical hackathon
case), this module uses a simple heuristic: if a workload's projected
utilisation is below 45 %, recommend the next smaller instance family.
"""

from __future__ import annotations

import logging
from typing import Any

from agents.aws_pricing import EC2_ONDEMAND

logger = logging.getLogger(__name__)

# Instance downsizing ladder — maps an instance type to a cheaper alternative
_DOWNSIZE_MAP: dict[str, str] = {
    "m5.16xlarge": "m6i.8xlarge",
    "m5.8xlarge":  "m6i.4xlarge",
    "m5.4xlarge":  "m6i.2xlarge",
    "m5.2xlarge":  "m6i.xlarge",
    "m5.xlarge":   "m6i.large",
    "m5.large":    "t3.large",
    "m6i.8xlarge": "m6i.4xlarge",
    "m6i.4xlarge": "m6i.2xlarge",
    "m6i.2xlarge": "m6i.xlarge",
    "m6i.xlarge":  "m6i.large",
    "m6i.large":   "t3.large",
    "r5.4xlarge":  "r6i.xlarge",
    "r5.2xlarge":  "r6i.large",
    "r5.xlarge":   "r6i.large",
    "r5.large":    "t3.large",
    "c5.2xlarge":  "c6i.xlarge",
    "c5.xlarge":   "c6i.large",
    "c5.large":    "t3.medium",
}


class OptimizerAdapter:
    """Generates Compute-Optimizer-style recommendations via heuristic logic."""

    def __init__(self) -> None:
        self._status: str = "heuristic"

    @property
    def status(self) -> str:
        return self._status

    def recommend(
        self,
        usage_patterns: list[dict],
        aws_mappings: list[dict],
    ) -> list[dict]:
        """Produce rightsizing suggestions.

        For each mapped EC2 resource whose billing pattern shows low peak
        utilisation (< 45 %), suggest a smaller shape and calculate savings.
        """
        recommendations: list[dict] = []

        for mapping in aws_mappings:
            # Accept both schema variants from the mapping agent
            resource_id = mapping.get("gcp_resource") or mapping.get("name", "unknown")
            aws_service = mapping.get("aws_service", "")

            # Only rightsize EC2 workloads
            if "EC2" not in aws_service.upper():
                continue

            current_shape = (
                mapping.get("aws_config", {}).get("instance_type")
                or mapping.get("suggested_shape", "m5.xlarge")
            )

            # Find the matching billing pattern for utilisation estimate
            peak_pct = 100
            for pat in usage_patterns:
                gcp_svc = pat.get("gcp_service", "")
                if "Compute" in gcp_svc:
                    peak_pct = pat.get("peak_utilization_pct", 100)
                    break

            if peak_pct >= 45:
                continue  # well-utilised — no recommendation

            recommended_shape = _DOWNSIZE_MAP.get(current_shape)
            if not recommended_shape:
                continue

            current_hourly = EC2_ONDEMAND.get(current_shape, 0.192)
            recommended_hourly = EC2_ONDEMAND.get(recommended_shape, current_hourly)
            monthly_savings = round((current_hourly - recommended_hourly) * 730, 2)

            if monthly_savings <= 0:
                continue

            confidence = round(max(0.5, 1.0 - (peak_pct / 100)), 2)

            recommendations.append({
                "resource_id": resource_id,
                "current_shape": current_shape,
                "recommended_shape": recommended_shape,
                "reason": (
                    f"Sustained utilisation below {peak_pct}% across 12 months "
                    f"of projected workload"
                ),
                "estimated_monthly_savings": monthly_savings,
                "confidence": confidence,
            })

        return recommendations
