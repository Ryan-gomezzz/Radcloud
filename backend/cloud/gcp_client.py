"""GCP connectivity — service account auth + Cloud Asset Inventory discovery.

google-cloud-asset is lazily imported so the app starts even if the SDK is
not installed or credentials are unavailable.
"""
from __future__ import annotations

import json
from typing import Any

from cloud.credential_store import CloudCredentials


_ASSET_TYPES = [
    "compute.googleapis.com/Instance",
    "sqladmin.googleapis.com/Instance",
    "storage.googleapis.com/Bucket",
    "run.googleapis.com/Service",
    "cloudfunctions.googleapis.com/CloudFunction",
    "pubsub.googleapis.com/Topic",
    "bigquery.googleapis.com/Dataset",
    "redis.googleapis.com/Instance",
    "container.googleapis.com/Cluster",
    "dns.googleapis.com/ManagedZone",
    "compute.googleapis.com/Network",
    "compute.googleapis.com/Subnetwork",
]


def connect_with_service_account(creds: CloudCredentials, service_account_json: dict) -> dict:
    """Validate a GCP service account JSON key and test connectivity."""
    try:
        from google.cloud import resourcemanager_v3
        from google.oauth2 import service_account

        sa_creds = service_account.Credentials.from_service_account_info(
            service_account_json,
            scopes=["https://www.googleapis.com/auth/cloud-platform.read-only"],
        )
        project_id = service_account_json.get("project_id")
        if not project_id:
            return {"connected": False, "error": "project_id missing from service account JSON"}

        # Verify connectivity — list the project
        rm_client = resourcemanager_v3.ProjectsClient(credentials=sa_creds)
        project = rm_client.get_project(name=f"projects/{project_id}")

        creds.gcp_service_account = service_account_json
        creds.gcp_project_id = project_id
        creds.gcp_project_name = project.display_name
        creds.gcp_connected = True

        return {
            "connected": True,
            "project_id": project_id,
            "project_name": project.display_name,
        }
    except ImportError:
        return {"connected": False, "error": "google-cloud-asset SDK not installed"}
    except Exception as e:
        creds.gcp_connected = False
        return {"connected": False, "error": str(e)}


def discover_assets(creds: CloudCredentials) -> list[dict[str, Any]]:
    """Discover all GCP assets via Cloud Asset Inventory API."""
    if not creds.gcp_connected or not creds.gcp_service_account:
        return []

    try:
        from google.cloud import asset_v1
        from google.oauth2 import service_account

        sa_creds = service_account.Credentials.from_service_account_info(
            creds.gcp_service_account,
            scopes=["https://www.googleapis.com/auth/cloud-platform.read-only"],
        )
        client = asset_v1.AssetServiceClient(credentials=sa_creds)
        project_id = creds.gcp_project_id

        inventory = []
        for asset_type in _ASSET_TYPES:
            try:
                request = asset_v1.ListAssetsRequest(
                    parent=f"projects/{project_id}",
                    asset_types=[asset_type],
                    content_type=asset_v1.ContentType.RESOURCE,
                )
                for asset in client.list_assets(request=request):
                    resource = asset.resource
                    resource_data = dict(resource.data) if resource.data else {}
                    inventory.append({
                        "name": asset.name.split("/")[-1],
                        "asset_type": asset_type,
                        "resource_type": _asset_type_to_resource_type(asset_type),
                        "config": resource_data,
                        "location": resource_data.get("location", "unknown"),
                    })
            except Exception:
                continue

        creds.gcp_resource_count = len(inventory)
        return inventory

    except ImportError:
        return []
    except Exception:
        return []


def _asset_type_to_resource_type(asset_type: str) -> str:
    mapping = {
        "compute.googleapis.com/Instance": "compute_instance",
        "sqladmin.googleapis.com/Instance": "cloud_sql",
        "storage.googleapis.com/Bucket": "gcs_bucket",
        "run.googleapis.com/Service": "cloud_run",
        "cloudfunctions.googleapis.com/CloudFunction": "cloud_function",
        "pubsub.googleapis.com/Topic": "pubsub_topic",
        "bigquery.googleapis.com/Dataset": "bigquery_dataset",
        "redis.googleapis.com/Instance": "memorystore_redis",
        "container.googleapis.com/Cluster": "gke_cluster",
        "dns.googleapis.com/ManagedZone": "cloud_dns",
        "compute.googleapis.com/Network": "vpc_network",
        "compute.googleapis.com/Subnetwork": "vpc_subnet",
    }
    return mapping.get(asset_type, "unknown")
