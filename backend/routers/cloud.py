"""Cloud connectivity router — GCP and AWS credential management."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from cloud import aws_client, gcp_client
from cloud.credential_store import get_or_create, get_credentials
from db.models import User
from routers.auth import get_current_user

router = APIRouter(prefix="/cloud", tags=["cloud"])


# ---------- Schemas ----------

class GCPConnectRequest(BaseModel):
    service_account_json: dict


class AWSConnectRequest(BaseModel):
    mode: str  # "keys" or "role"
    access_key_id: str | None = None
    secret_access_key: str | None = None
    role_arn: str | None = None
    region: str = "us-east-1"


class ConnectResponse(BaseModel):
    connected: bool
    detail: dict


class StatusResponse(BaseModel):
    connected: bool
    project_id: str | None = None
    project_name: str | None = None
    account_id: str | None = None
    account_alias: str | None = None
    resource_count: int = 0


# ---------- Routes ----------

@router.post("/gcp/connect")
async def connect_gcp(
    body: GCPConnectRequest,
    session_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
):
    creds = get_or_create(session_id)
    result = gcp_client.connect_with_service_account(creds, body.service_account_json)
    if result["connected"]:
        # Kick off discovery in background to get resource count
        try:
            assets = gcp_client.discover_assets(creds)
            creds.gcp_resource_count = len(assets)
        except Exception:
            pass
    return result


@router.get("/gcp/status", response_model=StatusResponse)
async def gcp_status(
    session_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
):
    creds = get_credentials(session_id)
    if not creds or not creds.gcp_connected:
        return StatusResponse(connected=False)
    return StatusResponse(
        connected=True,
        project_id=creds.gcp_project_id,
        project_name=creds.gcp_project_name,
        resource_count=creds.gcp_resource_count,
    )


@router.post("/gcp/discover")
async def discover_gcp(
    session_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
):
    creds = get_credentials(session_id)
    if not creds or not creds.gcp_connected:
        raise HTTPException(status_code=400, detail="GCP not connected for this session")
    assets = gcp_client.discover_assets(creds)
    return {"resource_count": len(assets), "resources": assets}


@router.post("/aws/connect")
async def connect_aws(
    body: AWSConnectRequest,
    session_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
):
    creds = get_or_create(session_id)
    if body.mode == "keys":
        if not body.access_key_id or not body.secret_access_key:
            raise HTTPException(status_code=400, detail="access_key_id and secret_access_key required for keys mode")
        result = aws_client.connect_with_keys(creds, body.access_key_id, body.secret_access_key, body.region)
    elif body.mode == "role":
        if not body.role_arn:
            raise HTTPException(status_code=400, detail="role_arn required for role mode")
        result = aws_client.connect_with_role(creds, body.role_arn, body.region)
    else:
        raise HTTPException(status_code=400, detail="mode must be 'keys' or 'role'")
    return result


@router.get("/aws/status", response_model=StatusResponse)
async def aws_status(
    session_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
):
    creds = get_credentials(session_id)
    if not creds or not creds.aws_connected:
        return StatusResponse(connected=False)
    return StatusResponse(
        connected=True,
        account_id=creds.aws_account_id,
        account_alias=creds.aws_account_alias,
    )
