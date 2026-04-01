"""Watchdog Agent — the fifth agent that closes the loop.

Consumes: gcp_inventory, aws_mapping, risks, finops, runbook
Produces: watchdog, iac_bundle (added to context)

The Watchdog is the post-migration operating plan:
- Spend baseline and target savings
- Optimization opportunities derived from real data
- Anomaly threshold / scan frequency
- Detect → Evaluate → Apply → Verify pipeline
"""

from agents.watchdog_rules import (
    AUTO_REMEDIATION_PIPELINE,
    DEFAULT_ANOMALY_THRESHOLD_PCT,
    DEFAULT_SCAN_FREQUENCY,
    calculate_projected_spend,
    generate_optimization_opportunities,
)
from agents.iac_generator import generate_iac_bundle


async def run(context: dict, claude_client) -> dict:
    mapping = context.get("aws_mapping", [])
    risks = context.get("risks", [])
    finops = context.get("finops", {})
    inventory = context.get("gcp_inventory", [])

    # --- Watchdog output ---
    monthly_spend, annual_savings = calculate_projected_spend(finops)
    opportunities = generate_optimization_opportunities(mapping, risks, finops)

    context["watchdog"] = {
        "status": "active",
        "scan_frequency": DEFAULT_SCAN_FREQUENCY,
        "projected_monthly_aws_spend": monthly_spend,
        "projected_annual_savings": annual_savings,
        "active_agents": ["risk", "finops", "watchdog"],
        "anomaly_threshold_pct": DEFAULT_ANOMALY_THRESHOLD_PCT,
        "optimization_opportunities": opportunities,
        "auto_remediation_pipeline": AUTO_REMEDIATION_PIPELINE,
    }

    # --- IaC bundle output ---
    context["iac_bundle"] = generate_iac_bundle(mapping, inventory)

    return context
