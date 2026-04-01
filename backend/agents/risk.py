"""Risk agent — stub."""


async def run(context: dict, claude_client) -> dict:
    context["risks"] = [
        {
            "category": "Data residency",
            "severity": "medium",
            "description": "GCS bucket region `us` is multi-region; confirm target S3 strategy.",
            "mitigation": "Pin to a single AWS region and enable replication if needed.",
        },
        {
            "category": "Cutover",
            "severity": "high",
            "description": "Database migration window not defined.",
            "mitigation": "Use DMS or logical replication with a rehearsed rollback.",
        },
    ]
    return context
