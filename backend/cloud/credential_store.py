"""In-memory credential store — credentials NEVER written to disk.

Keys expire when the process restarts, which is a desirable security property.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class CloudCredentials:
    session_id: str
    # GCP
    gcp_service_account: dict[str, Any] | None = None
    gcp_project_id: str | None = None
    gcp_connected: bool = False
    gcp_resource_count: int = 0
    gcp_project_name: str | None = None
    # AWS
    aws_access_key_id: str | None = None
    aws_secret_access_key: str | None = None
    aws_session_token: str | None = None
    aws_role_arn: str | None = None
    aws_account_id: str | None = None
    aws_account_alias: str | None = None
    aws_region: str = "us-east-1"
    aws_connected: bool = False

    def __repr__(self) -> str:
        return (
            f"CloudCredentials(session_id={self.session_id!r}, "
            f"gcp_connected={self.gcp_connected}, aws_connected={self.aws_connected}, "
            f"gcp_key=***REDACTED***, aws_key=***REDACTED***)"
        )


_store: dict[str, CloudCredentials] = {}


def get_or_create(session_id: str) -> CloudCredentials:
    if session_id not in _store:
        _store[session_id] = CloudCredentials(session_id=session_id)
    return _store[session_id]


def get_credentials(session_id: str) -> CloudCredentials | None:
    return _store.get(session_id)


def store_credentials(creds: CloudCredentials) -> None:
    _store[creds.session_id] = creds


def clear_credentials(session_id: str) -> None:
    _store.pop(session_id, None)
