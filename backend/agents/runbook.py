"""Runbook Generator — Claude-powered phased migration plan.

Consumes: gcp_inventory, aws_mapping, risks, finops
Produces: runbook (added to context)
"""

import json


RUNBOOK_SYSTEM_PROMPT = """You are a cloud migration project manager creating a migration runbook for a GCP-to-AWS migration. You will receive:
1. GCP resource inventory
2. AWS target mapping
3. Risk report
4. FinOps recommendations (if available)

Generate a detailed migration runbook with these exact phases:

Phase 1 — Pre-Migration (1-2 weeks): AWS account setup, landing zone, VPC creation, IAM roles, security groups, monitoring setup.
Phase 2 — Data Migration (2-3 weeks): Database migration with DMS, storage migration with S3 Transfer, DNS preparation.
Phase 3 — Compute Migration (1-2 weeks): EC2 instances, containers (ECS/Fargate), serverless functions, messaging.
Phase 4 — Cutover (1-2 days): DNS switch, traffic routing, final data sync, go-live validation.
Phase 5 — Post-Migration (1-2 weeks): Monitoring, performance validation, decommission GCP resources, finalize FinOps (purchase Reserved Instances per Day-0 plan).

For each phase, provide 4-6 specific steps. Each step must have:
- step_number (integer, sequential within phase)
- action (specific, actionable instruction)
- responsible ("Cloud Infrastructure Team", "Application Team", "Database Team", "Security Team", or "FinOps Team")
- estimated_hours (integer)
- dependencies (list of "Phase X, Step Y" strings, or empty list)
- rollback (specific rollback instruction)
- notes (additional context)

CRITICAL: Phase 5 must include a step to execute the Day-0 FinOps plan — purchasing Reserved Instances and Savings Plans based on the pre-calculated recommendations.

Also generate:
- estimated_total_duration (string like "8-12 weeks")
- rollback_plan (2-3 sentence summary)
- success_criteria (list of 5 measurable criteria)

Respond ONLY with a JSON object matching this structure. No markdown, no backticks."""


def _build_fallback_runbook(finops: dict) -> dict:
    """Fallback runbook when Claude is unavailable — structurally correct, generic steps."""
    return {
        "title": "GCP to AWS Migration Runbook",
        "estimated_total_duration": "8-12 weeks",
        "phases": [
            {
                "phase_number": 1,
                "name": "Pre-Migration",
                "duration": "1-2 weeks",
                "steps": [
                    {"step_number": 1, "action": "Set up AWS landing zone with VPC, subnets, and security groups matching the target architecture", "responsible": "Cloud Infrastructure Team", "estimated_hours": 16, "dependencies": [], "rollback": "Delete AWS VPC and associated resources", "notes": "Use the networking topology from the Architecture output as the blueprint"},
                    {"step_number": 2, "action": "Create IAM roles and policies for all service accounts identified in the mapping", "responsible": "Security Team", "estimated_hours": 8, "dependencies": [], "rollback": "Delete created IAM roles", "notes": "Map each GCP service account to an AWS IAM role with equivalent permissions"},
                    {"step_number": 3, "action": "Set up CloudWatch dashboards and alarms for target infrastructure", "responsible": "Cloud Infrastructure Team", "estimated_hours": 8, "dependencies": ["Phase 1, Step 1"], "rollback": "Delete CloudWatch resources", "notes": "Mirror existing GCP monitoring configuration"},
                    {"step_number": 4, "action": "Configure AWS Budgets and cost anomaly detection", "responsible": "FinOps Team", "estimated_hours": 4, "dependencies": [], "rollback": "Delete budget configurations", "notes": "Set alerts at 80% and 100% of projected monthly spend"},
                ],
            },
            {
                "phase_number": 2,
                "name": "Data Migration",
                "duration": "2-3 weeks",
                "steps": [
                    {"step_number": 1, "action": "Set up AWS DMS for continuous database replication from Cloud SQL to RDS", "responsible": "Database Team", "estimated_hours": 24, "dependencies": ["Phase 1, Step 1"], "rollback": "Stop DMS replication tasks", "notes": "Start with read replica, then promote"},
                    {"step_number": 2, "action": "Migrate Cloud Storage buckets to S3 using AWS DataSync", "responsible": "Cloud Infrastructure Team", "estimated_hours": 16, "dependencies": ["Phase 1, Step 1"], "rollback": "Delete S3 objects (source remains intact)", "notes": "Verify lifecycle rules are configured on target buckets"},
                    {"step_number": 3, "action": "Set up ElastiCache Redis cluster to replace Memorystore", "responsible": "Cloud Infrastructure Team", "estimated_hours": 8, "dependencies": ["Phase 1, Step 1"], "rollback": "Delete ElastiCache cluster", "notes": "Match memory size and HA configuration"},
                    {"step_number": 4, "action": "Prepare Route 53 hosted zone and DNS records with low TTL", "responsible": "Cloud Infrastructure Team", "estimated_hours": 4, "dependencies": [], "rollback": "Revert DNS TTL values", "notes": "Set TTL to 60 seconds 24 hours before cutover"},
                ],
            },
            {
                "phase_number": 3,
                "name": "Compute Migration",
                "duration": "1-2 weeks",
                "steps": [
                    {"step_number": 1, "action": "Deploy EC2 instances from generated Terraform and configure application stack", "responsible": "Application Team", "estimated_hours": 16, "dependencies": ["Phase 2, Step 1"], "rollback": "Terminate EC2 instances", "notes": "Use AMIs matching the GCP instance images"},
                    {"step_number": 2, "action": "Deploy Cloud Run services as ECS Fargate tasks behind an ALB", "responsible": "Application Team", "estimated_hours": 16, "dependencies": ["Phase 1, Step 1"], "rollback": "Delete ECS services and ALB", "notes": "Map Cloud Run concurrency settings to ECS task definitions"},
                    {"step_number": 3, "action": "Migrate Cloud Functions to AWS Lambda with API Gateway or EventBridge triggers", "responsible": "Application Team", "estimated_hours": 12, "dependencies": ["Phase 1, Step 2"], "rollback": "Delete Lambda functions", "notes": "Update runtime configurations and environment variables"},
                    {"step_number": 4, "action": "Set up SNS/SQS to replace Pub/Sub topics and subscriptions", "responsible": "Application Team", "estimated_hours": 12, "dependencies": ["Phase 1, Step 1"], "rollback": "Delete SNS topics and SQS queues", "notes": "Rebuild dead-letter queue configuration"},
                ],
            },
            {
                "phase_number": 4,
                "name": "Cutover",
                "duration": "1-2 days",
                "steps": [
                    {"step_number": 1, "action": "Perform final DMS sync and verify data integrity with checksum comparison", "responsible": "Database Team", "estimated_hours": 4, "dependencies": ["Phase 3, Step 1"], "rollback": "Revert to GCP database as primary", "notes": "Schedule during lowest-traffic window"},
                    {"step_number": 2, "action": "Switch DNS records from GCP to AWS endpoints", "responsible": "Cloud Infrastructure Team", "estimated_hours": 2, "dependencies": ["Phase 4, Step 1"], "rollback": "Revert DNS to GCP endpoints (low TTL enables fast rollback)", "notes": "Monitor for DNS propagation across regions"},
                    {"step_number": 3, "action": "Run smoke tests against all AWS endpoints", "responsible": "Application Team", "estimated_hours": 4, "dependencies": ["Phase 4, Step 2"], "rollback": "Revert DNS if smoke tests fail", "notes": "Test all critical user flows and API endpoints"},
                    {"step_number": 4, "action": "Validate monitoring dashboards and confirm all alarms are green", "responsible": "Cloud Infrastructure Team", "estimated_hours": 2, "dependencies": ["Phase 4, Step 3"], "rollback": "N/A", "notes": "Compare latency and error rates against GCP baseline"},
                ],
            },
            {
                "phase_number": 5,
                "name": "Post-Migration",
                "duration": "1-2 weeks",
                "steps": [
                    {"step_number": 1, "action": "Execute Day-0 FinOps plan: purchase Reserved Instances and Savings Plans per pre-calculated recommendations", "responsible": "FinOps Team", "estimated_hours": 2, "dependencies": ["Phase 4, Step 3"], "rollback": "RIs are non-refundable but can be sold on RI Marketplace", "notes": "Purchase per pre-calculated plan to start saving immediately rather than waiting 3 months"},
                    {"step_number": 2, "action": "Monitor production for 72 hours — track latency, error rates, and cost accumulation", "responsible": "Cloud Infrastructure Team", "estimated_hours": 8, "dependencies": ["Phase 4, Step 4"], "rollback": "Initiate full rollback if error rates exceed baseline by >5%", "notes": "Compare against GCP production metrics"},
                    {"step_number": 3, "action": "Activate Watchdog continuous optimization scanning", "responsible": "FinOps Team", "estimated_hours": 4, "dependencies": ["Phase 5, Step 1"], "rollback": "Disable Watchdog scanning", "notes": "Enable anomaly detection with 12% threshold"},
                    {"step_number": 4, "action": "Begin GCP resource decommissioning (non-database resources first)", "responsible": "Cloud Infrastructure Team", "estimated_hours": 8, "dependencies": ["Phase 5, Step 2"], "rollback": "Re-provision GCP resources from Terraform state", "notes": "Keep GCP database running for 2 weeks as fallback"},
                    {"step_number": 5, "action": "Final GCP database decommission after 2-week observation period", "responsible": "Database Team", "estimated_hours": 4, "dependencies": ["Phase 5, Step 4"], "rollback": "Restore from GCP backup if needed", "notes": "Take final backup before deletion"},
                ],
            },
        ],
        "rollback_plan": "Each phase has individual rollback steps. Full rollback involves reverting DNS to GCP endpoints and stopping AWS DMS replication. GCP infrastructure remains intact until post-migration validation completes.",
        "success_criteria": [
            "All services responding on AWS endpoints with <200ms latency",
            "Database replication lag < 1 second at cutover",
            "Zero data loss verified by checksum comparison",
            "All monitoring and alerting operational on AWS",
            "Day-0 Reserved Instances purchased and active",
        ],
    }


async def run(context: dict, claude_client) -> dict:
    inventory = context.get("gcp_inventory", [])
    mapping = context.get("aws_mapping", [])
    risks = context.get("risks", [])
    finops = context.get("finops", {})

    # Build a concise context summary for Claude (don't send raw data — too long)
    resource_summary = {}
    for r in inventory:
        rtype = r.get("resource_type", r.get("type", "other"))
        resource_summary[rtype] = resource_summary.get(rtype, 0) + 1

    mapping_summary = []
    for m in mapping:
        mapping_summary.append({
            "from": f"{m.get('gcp_service', m.get('gcp_resource', '?'))} ({m.get('gcp_resource_id', m.get('gcp_resource', '?'))})",
            "to": m.get("aws_service", "?"),
            "confidence": m.get("mapping_confidence", "?"),
        })

    risk_titles = [{"severity": r["severity"], "title": r["title"]} for r in risks[:10]]

    ri_summary = []
    for rec in finops.get("ri_recommendations", []):
        if "annual_savings" in rec:
            ri_summary.append(
                f"{rec.get('quantity', 1)}x {rec.get('instance_type', rec.get('service', '?'))} "
                f"{rec.get('aws_service', rec.get('service', '?'))} RI — saves ${rec['annual_savings']:,.0f}/yr"
            )
        else:
            ri_summary.append(
                f"{rec.get('service', '?')}: {rec.get('coverage_pct', '?')}% coverage · {rec.get('term', '?')}"
            )

    context_for_claude = {
        "resource_counts": resource_summary,
        "total_resources": len(inventory),
        "mapping_summary": mapping_summary,
        "key_risks": risk_titles,
        "day0_finops_purchases": ri_summary,
        "total_first_year_savings": finops.get("total_first_year_savings", 0),
    }

    runbook = None

    if claude_client is not None:
        try:
            response = claude_client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=6000,
                temperature=0,
                system=RUNBOOK_SYSTEM_PROMPT,
                messages=[{
                    "role": "user",
                    "content": f"Generate the migration runbook from this context:\n{json.dumps(context_for_claude, indent=2)}"
                }]
            )

            raw_text = response.content[0].text.strip()
            if raw_text.startswith("```"):
                raw_text = raw_text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

            runbook = json.loads(raw_text)
        except Exception:
            runbook = None

    if runbook is None:
        runbook = _build_fallback_runbook(finops)

    context["runbook"] = runbook
    return context
