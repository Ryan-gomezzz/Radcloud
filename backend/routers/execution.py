"""Execution router — SSE simulation with terraform/DMS stubs and approval gates."""
from __future__ import annotations

import asyncio
import json
import logging
import uuid
from dataclasses import dataclass
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sse_starlette.sse import EventSourceResponse

from cloud import dms_client, terraform_runner
from db.models import User
from routers.auth import decode_access_token, get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/execution", tags=["execution"])


@dataclass
class _ExecCtx:
    user_id: str
    rejected: bool = False
    gate_event: asyncio.Event | None = None
    gate_name: str | None = None


_contexts: dict[str, _ExecCtx] = {}


def _emit(obj: dict[str, Any]) -> dict[str, str]:
    return {"data": json.dumps(obj)}


async def _wait_gate(ctx: _ExecCtx, gate_name: str) -> bool:
    """Return False if rejected. Call only after the gate payload was yielded to the client."""
    ctx.gate_event = asyncio.Event()
    ctx.gate_name = gate_name
    await ctx.gate_event.wait()
    ctx.gate_event = None
    ctx.gate_name = None
    return not ctx.rejected


async def _simulate(ctx: _ExecCtx):
    """Async generator of event dicts for SSE."""
    lines_s0 = [
        "[discovery] Scanning GCP projects…",
        "[discovery] Listing Compute instances…",
        "[discovery] Parsing IAM bindings…",
        "[discovery] Inventory snapshot complete.",
    ]
    for line in lines_s0:
        yield {"type": "log", "stageIndex": 0, "line": line}
        await asyncio.sleep(0.28)

    yield {"type": "stage", "stageIndex": 0, "status": "completed"}
    yield {"type": "stage", "stageIndex": 1, "status": "running"}
    for line in [
        "[plan] Loading approved migration plan…",
        "[plan] Validating scope with stakeholders…",
        "[plan] Plan checksum verified.",
        "[plan] Gate cleared — proceeding to IaC.",
    ]:
        yield {"type": "log", "stageIndex": 1, "line": line}
        await asyncio.sleep(0.28)
    yield {"type": "stage", "stageIndex": 1, "status": "completed"}

    yield {"type": "stage", "stageIndex": 2, "status": "running"}
    async for line in terraform_runner.plan("", {}):
        yield {"type": "log", "stageIndex": 2, "line": line}
    yield {
        "type": "gate",
        "gate": "terraform_plan",
        "stageIndex": 2,
        "message": "Review Terraform plan output before apply.",
        "costDelta": 312,
        "resourceCount": 28,
        "visible": True,
    }
    ok = await _wait_gate(ctx, "terraform_plan")
    if not ok:
        yield {"type": "failed", "message": "Execution rejected at plan gate"}
        return
    yield {"type": "stage", "stageIndex": 2, "status": "completed"}

    yield {"type": "stage", "stageIndex": 3, "status": "running"}
    async for line in terraform_runner.apply("", {}):
        yield {"type": "log", "stageIndex": 3, "line": line}
    yield {
        "type": "gate",
        "gate": "terraform_apply",
        "stageIndex": 3,
        "message": "Confirm apply to production account.",
        "costDelta": 312,
        "resourceCount": 28,
        "visible": True,
    }
    ok = await _wait_gate(ctx, "terraform_apply")
    if not ok:
        yield {"type": "failed", "message": "Execution rejected at apply gate"}
        return
    yield {"type": "stage", "stageIndex": 3, "status": "completed"}

    yield {"type": "stage", "stageIndex": 4, "status": "running"}
    async for up in dms_client.simulate_db_migration():
        yield {
            "type": "db",
            "progress": up.get("progress", 0),
            "replicationLag": up.get("replication_lag_ms", 0),
            "rowsMigrated": up.get("rows_migrated", 0),
            "totalRows": up.get("total_rows", 0),
        }
    async for up in dms_client.simulate_storage_migration():
        yield {
            "type": "storage",
            "transferredGB": up.get("transferred_gb", 0),
            "totalGB": up.get("total_gb", 0),
            "transferRate": up.get("transfer_rate_mbps", 0),
        }
    for line in [
        "[migrate] Validating row counts…",
        "[migrate] Cutover window scheduled…",
        "[migrate] Replication steady state.",
    ]:
        yield {"type": "log", "stageIndex": 4, "line": line}
        await asyncio.sleep(0.25)
    yield {"type": "stage", "stageIndex": 4, "status": "completed"}

    yield {"type": "stage", "stageIndex": 5, "status": "running"}
    for line in [
        "[verify] Running smoke tests…",
        "[verify] DNS propagation check…",
        "[verify] Cost anomaly scan…",
        "[verify] Execution complete.",
    ]:
        yield {"type": "log", "stageIndex": 5, "line": line}
        await asyncio.sleep(0.28)
    yield {"type": "stage", "stageIndex": 5, "status": "completed"}
    yield {"type": "complete"}


@router.post("/start")
async def start_execution(current_user: Annotated[User, Depends(get_current_user)]):
    eid = uuid.uuid4().hex
    _contexts[eid] = _ExecCtx(user_id=current_user.id)
    return {"execution_id": eid}


@router.get("/{execution_id}/stream")
async def execution_stream(
    execution_id: str,
    token: Annotated[str | None, Query(description="JWT for EventSource (no Authorization header in browsers)")] = None,
):
    if not token:
        raise HTTPException(status_code=401, detail="Missing token query parameter for SSE auth")
    try:
        user_id = decode_access_token(token)
    except HTTPException:
        raise
    ctx = _contexts.get(execution_id)
    if not ctx or ctx.user_id != user_id:
        raise HTTPException(status_code=404, detail="Execution not found")

    async def gen():
        try:
            async for ev in _simulate(ctx):
                yield _emit(ev)
        except Exception as e:
            logger.exception("execution stream error")
            yield _emit({"type": "error", "message": str(e)})

    return EventSourceResponse(gen())


@router.post("/{execution_id}/approve")
async def approve_gate(
    execution_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
):
    ctx = _contexts.get(execution_id)
    if not ctx or ctx.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Execution not found")
    if ctx.gate_event and not ctx.gate_event.is_set():
        ctx.gate_event.set()
    return {"ok": True}


@router.post("/{execution_id}/reject")
async def reject_gate(
    execution_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
):
    ctx = _contexts.get(execution_id)
    if not ctx or ctx.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Execution not found")
    ctx.rejected = True
    if ctx.gate_event and not ctx.gate_event.is_set():
        ctx.gate_event.set()
    return {"ok": True, "rejected": True}
