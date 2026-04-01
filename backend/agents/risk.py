"""Risk Agent — deterministic rules + Claude-powered deep analysis.

Consumes: gcp_inventory, aws_mapping (from upstream agents)
Produces: risks, risk_summary (added to context)
"""

import json

from agents.risk_rules import detect_deterministic_risks

RISK_SYSTEM_PROMPT = """You are a cloud migration risk analyst specializing in GCP-to-AWS migrations. You will receive:
1. A GCP resource inventory
2. An AWS mapping with gap flags
3. A list of risks already detected by automated rules

Your job: identify 2-3 ADDITIONAL risks that the automated rules missed. Focus on:
- Interaction effects between services (e.g., a Pub/Sub subscription pushing directly to BigQuery has no AWS equivalent — this requires rearchitecting the pipeline)
- Operational risks (monitoring, alerting, logging differences)
- Application-level risks (SDK changes, API differences, client library updates)
- Compliance or data residency concerns

For each risk, provide:
- id: "RISK-NNN" (continue numbering from where automated rules left off)
- category: one of service_compatibility, iam_model, networking, data_migration, downtime, cost_surprise
- severity: high, medium, or low
- title: one-line summary
- description: 2-3 sentences explaining the risk
- affected_resources: list of resource names
- aws_alternative: what to use instead
- migration_impact: what happens if this risk is not addressed
- mitigation: specific steps to mitigate
- estimated_effort_days: integer

Respond ONLY with a JSON array of risk objects. No markdown, no backticks, no explanation."""


async def run(context: dict, claude_client) -> dict:
    inventory = context.get("gcp_inventory", [])
    mapping = context.get("aws_mapping", [])

    # Phase 1: Deterministic risks
    auto_risks, next_counter = detect_deterministic_risks(inventory, mapping)

    # Phase 2: Claude-powered deep analysis
    if claude_client is not None:
        try:
            response = claude_client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=2048,
                temperature=0,
                system=RISK_SYSTEM_PROMPT,
                messages=[{
                    "role": "user",
                    "content": (
                        f"GCP Inventory:\n{json.dumps(inventory, indent=2)}\n\n"
                        f"AWS Mapping:\n{json.dumps(mapping, indent=2)}\n\n"
                        f"Already detected risks (continue numbering from RISK-{next_counter:03d}):\n"
                        f"{json.dumps([{'id': r['id'], 'title': r['title']} for r in auto_risks], indent=2)}"
                    )
                }]
            )

            raw_text = response.content[0].text.strip()
            if raw_text.startswith("```"):
                raw_text = raw_text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

            claude_risks = json.loads(raw_text)
            all_risks = auto_risks + claude_risks
        except Exception:
            all_risks = auto_risks
    else:
        all_risks = auto_risks

    # Sort by severity: high → medium → low
    severity_order = {"high": 0, "medium": 1, "low": 2}
    all_risks.sort(key=lambda r: severity_order.get(r.get("severity", "low"), 3))

    # Build summary
    high_count = sum(1 for r in all_risks if r["severity"] == "high")
    med_count = sum(1 for r in all_risks if r["severity"] == "medium")
    low_count = sum(1 for r in all_risks if r["severity"] == "low")

    top_risk = next((r for r in all_risks if r["severity"] == "high"), all_risks[0] if all_risks else None)

    if high_count == 0:
        assessment = "Migration is low-risk. No critical compatibility issues detected. Standard migration procedures apply."
    elif high_count <= 2:
        assessment = f"Migration is feasible with moderate risk. {high_count} high-severity item(s) require upfront architectural decisions before migration begins."
    else:
        assessment = f"Migration carries significant risk. {high_count} high-severity items require detailed technical spikes and may extend the migration timeline."

    context["risks"] = all_risks
    context["risk_summary"] = {
        "total_risks": len(all_risks),
        "high": high_count,
        "medium": med_count,
        "low": low_count,
        "top_risk": top_risk["title"] if top_risk else "None",
        "overall_assessment": assessment,
    }

    return context
