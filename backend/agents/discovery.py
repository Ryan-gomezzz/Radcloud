"""Discovery agent — stub."""


async def run(context: dict, claude_client) -> dict:
    context["gcp_inventory"] = [
        {
            "type": "compute_instance",
            "name": "web-server-1",
            "machine_type": "n1-standard-4",
            "region": "us-central1",
        },
        {
            "type": "cloud_sql",
            "name": "main-db",
            "tier": "db-n1-standard-2",
            "region": "us-central1",
        },
        {
            "type": "gcs_bucket",
            "name": "app-assets",
            "storage_class": "STANDARD",
            "region": "us",
        },
    ]
    return context
