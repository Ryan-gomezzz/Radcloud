"""Runbook agent — stub."""


async def run(context: dict, claude_client) -> dict:
    context["runbook"] = [
        {"step": 1, "title": "Inventory validation", "detail": "Confirm GCP resources match discovery output."},
        {"step": 2, "title": "Network", "detail": "Create VPC, subnets, routing, security groups."},
        {"step": 3, "title": "Data migration", "detail": "Replicate DB; plan cutover window."},
        {"step": 4, "title": "App cutover", "detail": "Deploy to EC2/ECS; shift DNS/ALB."},
        {"step": 5, "title": "FinOps lock-in", "detail": "Purchase RIs/Savings Plans per finops plan."},
    ]
    return context
