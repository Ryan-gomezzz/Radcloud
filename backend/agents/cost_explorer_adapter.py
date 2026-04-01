"""Cost Explorer adapter — optional pull-through for AWS baseline spend.

Falls back to ``"not_connected"`` when credentials or boto3 are unavailable.
The result is reported in ``pricing_sources.cost_explorer``.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

logger = logging.getLogger(__name__)

try:
    import boto3
    _HAS_BOTO3 = True
except ImportError:
    _HAS_BOTO3 = False


class CostExplorerAdapter:
    """Wraps AWS Cost Explorer (``ce``) for baseline spend comparison."""

    def __init__(self) -> None:
        self._client: Any | None = None
        self._status: str = "not_connected"
        self._try_connect()

    def _try_connect(self) -> None:
        if not _HAS_BOTO3:
            return
        try:
            self._client = boto3.client("ce", region_name="us-east-1")
            # Smoke-test with a 1-day query
            end = datetime.utcnow().strftime("%Y-%m-%d")
            start = (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d")
            self._client.get_cost_and_usage(
                TimePeriod={"Start": start, "End": end},
                Granularity="DAILY",
                Metrics=["BlendedCost"],
            )
            self._status = "live"
            logger.info("Connected to AWS Cost Explorer (live)")
        except Exception as exc:
            logger.info("Cost Explorer unavailable (%s)", exc)
            self._client = None

    @property
    def status(self) -> str:
        return self._status

    def get_monthly_costs(self, months: int = 3) -> list[dict]:
        """Return the last *months* of AWS spend, grouped by service.

        Returns an empty list if the adapter is not connected.
        """
        if self._client is None:
            return []
        try:
            end = datetime.utcnow().strftime("%Y-%m-%d")
            start = (datetime.utcnow() - timedelta(days=30 * months)).strftime("%Y-%m-%d")
            resp = self._client.get_cost_and_usage(
                TimePeriod={"Start": start, "End": end},
                Granularity="MONTHLY",
                Metrics=["BlendedCost"],
                GroupBy=[{"Type": "DIMENSION", "Key": "SERVICE"}],
            )
            results: list[dict] = []
            for period in resp.get("ResultsByTime", []):
                month = period["TimePeriod"]["Start"][:7]
                for group in period.get("Groups", []):
                    results.append({
                        "month": month,
                        "aws_service": group["Keys"][0],
                        "cost": float(group["Metrics"]["BlendedCost"]["Amount"]),
                    })
            return results
        except Exception as exc:
            logger.warning("Cost Explorer query failed: %s", exc)
            return []
