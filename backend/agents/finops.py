"""FinOps Agent — LLM-powered cost analysis with RAG context.

Falls back to hardcoded demo data if LLM call fails.
"""
from __future__ import annotations

import json
import logging
import re

logger = logging.getLogger(__name__)

_STUB_FINOPS = {
    "gcp_monthly_total": 9840.00,
    "aws_monthly_ondemand": 10320.00,
    "aws_monthly_optimized": 6387.00,
    "total_monthly_savings": 3933.00,
    "total_first_year_savings": 47200.00,
    "savings_vs_observation_window": 11800.00,
    "savings_percent": 35.1,
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
        "$10,320/month (+4.9%), but RADCloud Day-0 optimization lands at $6,387/month (-35.1% vs on-demand "
        "AWS, -35.1% vs GCP baseline after rightsizing and RIs). First-year savings vs a traditional "
        "90-day FinOps observation path are estimated at $47,200."
    ),
}


def _parse_json(text: str) -> dict | None:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass
    return None


async def run(context: dict) -> dict:
    from llm import call_llm_async
    from rag.retriever import retrieve_for_agent

    inventory = context.get("gcp_inventory", [])
    aws_mapping = context.get("aws_mapping", {})
    billing_raw = context.get("gcp_billing_raw", [])

    billing_summary = ""
    if billing_raw:
        try:
            total = sum(float(row.get("cost", 0)) for row in billing_raw[:200] if row.get("cost"))
            billing_summary = f"GCP billing data: {len(billing_raw)} rows, estimated monthly avg: ${total/12:.0f}"
        except Exception:
            billing_summary = f"GCP billing data: {len(billing_raw)} rows available"

    rag_ctx = retrieve_for_agent("finops", context)

    aws_services = []
    if isinstance(aws_mapping, list):
        aws_services = list({m.get("aws_service", "") for m in aws_mapping if m.get("aws_service")})
    elif isinstance(aws_mapping, dict):
        aws_services = list({m.get("aws_service", "") for m in aws_mapping.get("mappings", []) if m.get("aws_service")})

    resource_count = len(inventory)
    resource_types = list({r.get("resource_type", r.get("service", "")) for r in inventory})[:12]

    system = """You are a senior FinOps engineer specializing in GCP-to-AWS cloud migration cost analysis.
Produce a precise JSON cost analysis based on the infrastructure details provided.
Output ONLY a valid JSON object — no markdown, no explanation."""

    if rag_ctx:
        system += f"\n\n### Pricing Reference Context:\n{rag_ctx}"

    user_msg = f"""Analyze this GCP infrastructure for AWS migration costs:

Resources: {resource_count} total
Types: {', '.join(resource_types)}
Target AWS services: {', '.join(aws_services) if aws_services else 'EC2, RDS, ElastiCache, S3, ECS, Lambda, SNS, SQS'}
{billing_summary}

Return this exact JSON structure (fill in realistic numbers):
{{
  "gcp_monthly_total": <number>,
  "aws_monthly_ondemand": <number>,
  "aws_monthly_optimized": <number>,
  "total_monthly_savings": <number>,
  "total_first_year_savings": <number>,
  "savings_percent": <number>,
  "ri_recommendations": [
    {{"aws_service": "...", "instance_type": "...", "quantity": 1, "term": "1-year", "payment_option": "All Upfront", "monthly_ondemand_cost": 0, "monthly_ri_cost": 0, "monthly_savings": 0, "annual_savings": 0, "rationale": "..."}}
  ],
  "cost_comparison": [
    {{"month": "M1", "gcp_cost": 0, "aws_ondemand": 0, "aws_optimized": 0}},
    ... 12 entries
  ],
  "usage_patterns": [
    {{"gcp_service": "...", "pattern": "steady_state|bursty|dev_test", "avg_monthly_cost": 0, "recommendation": "reserved_instance|savings_plan|spot", "description": "..."}}
  ],
  "summary": "..."
}}"""

    try:
        raw = await call_llm_async(
            messages=[{"role": "user", "content": user_msg}],
            system=system,
            max_tokens=3000,
            temperature=0.1,
        )
        finops = _parse_json(raw)
        if finops and "gcp_monthly_total" in finops and "cost_comparison" in finops:
            context["finops"] = finops
            logger.info("FinOps agent: LLM-generated analysis (%d resources)", resource_count)
            return context
        logger.warning("FinOps: LLM output missing required fields, using stub")
    except Exception as e:
        logger.warning("FinOps LLM failed, using stub: %s", e)

    context["finops"] = _STUB_FINOPS
    return context


# Mapping for watchdog baseline service names
GCP_TO_AWS_CATEGORY: dict[str, str] = {
    "Compute Engine":  "EC2",
    "Cloud SQL":       "RDS",
    "Cloud Storage":   "S3",
    "Cloud Run":       "Fargate",
    "Cloud Functions": "Lambda",
    "Memorystore":     "ElastiCache",
    "BigQuery":        "Athena",
    "Cloud Pub/Sub":   "SNS/SQS",
    "Networking":      "Data Transfer",
}
