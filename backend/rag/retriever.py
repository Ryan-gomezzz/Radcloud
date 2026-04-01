"""RAG retriever — convenience wrapper used by agents."""
from __future__ import annotations

from rag.store import get_store


def retrieve(query: str, top_k: int = 5) -> str:
    """Retrieve top-k relevant chunks for a query. Returns empty string if RAG is unavailable."""
    store = get_store()
    return store.retrieve(query, top_k=top_k)


def retrieve_for_agent(agent_name: str, context: dict) -> str:
    """Build an agent-specific query and retrieve relevant context."""
    query = _build_query(agent_name, context)
    if not query:
        return ""
    return retrieve(query)


def _build_query(agent_name: str, context: dict) -> str:
    inventory = context.get("gcp_inventory", [])
    resource_types = list({r.get("resource_type", "") for r in inventory if r.get("resource_type")})
    resource_summary = ", ".join(resource_types[:10]) if resource_types else "GCP resources"

    queries = {
        "finops": (
            f"AWS pricing for {resource_summary}, Reserved Instance recommendations, "
            "cost optimization strategies, Savings Plans"
        ),
        "mapping": (
            f"Best AWS equivalent services for {resource_summary}, "
            "GCP to AWS service mapping, migration considerations, compatibility"
        ),
        "risk": (
            f"Common migration risks for {resource_summary}, "
            "IAM translation issues, data migration pitfalls, network cutover risks"
        ),
        "discovery": (
            f"GCP {resource_summary} service documentation, edge cases, "
            "configuration options for migration planning"
        ),
        "watchdog": (
            "Post-migration monitoring AWS CloudWatch, alarms, dashboards, "
            "Terraform patterns, runbook steps, verification checklist"
        ),
        "planner": (
            "Migration execution phases GCP to AWS, Terraform apply strategy, "
            "DMS CDC cutover playbook, DNS cutover, rollback strategy"
        ),
    }
    return queries.get(agent_name, f"GCP to AWS migration for {resource_summary}")
