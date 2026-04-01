"""Pipeline — migration plan registry, approve / reject / modify."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from db.models import Session as DbSession
from db.models import User
from routers.auth import get_current_user

router = APIRouter(prefix="/pipeline", tags=["pipeline"])

# plan_id -> { user_id, plan dict, modifications[], status }
_plans: dict[str, dict] = {}

# Demo plan from UI (mergeMigrationPlan / cached responses) — same id as frontend DEMO_MIGRATION_PLAN
DEMO_PLAN_ID = "plan-demo-001"
# user_id -> row (isolated per user so approve/modify state is stable)
_demo_plan_sessions: dict[str, dict] = {}


def _demo_plan_payload() -> dict:
    return {
        "plan_id": DEMO_PLAN_ID,
        "phases": [
            {
                "id": "p1",
                "name": "Infrastructure Setup",
                "duration_days": 5,
                "resources": ["VPC", "Subnets", "Security groups"],
            },
            {
                "id": "p2",
                "name": "Compute Migration",
                "duration_days": 8,
                "resources": ["GCE", "MIG", "Load balancers"],
            },
            {
                "id": "p3",
                "name": "Database Migration",
                "duration_days": 12,
                "resources": ["Cloud SQL", "Memorystore"],
            },
            {
                "id": "p4",
                "name": "Storage + CDN",
                "duration_days": 4,
                "resources": ["GCS", "Cloud CDN"],
            },
            {
                "id": "p5",
                "name": "Verification & Cutover",
                "duration_days": 3,
                "resources": ["DNS", "Monitoring"],
            },
        ],
        "estimated_cost_delta": 312,
        "risk_count_high": 2,
        "architecture_mappings": [],
        "cost_categories": [
            {"category": "Compute", "before": 4200, "after": 4512},
            {"category": "Database", "before": 1800, "after": 1950},
            {"category": "Storage", "before": 890, "after": 920},
            {"category": "Networking", "before": 640, "after": 710},
            {"category": "Other", "before": 310, "after": 330},
        ],
        "risks": [],
    }


def register_migration_plan(user_id: str, plan: dict) -> None:
    pid = plan.get("plan_id")
    if not pid:
        return
    _plans[pid] = {
        "user_id": user_id,
        "plan": plan,
        "modifications": [],
        "status": "pending",
    }


def get_plan_row(plan_id: str, user_id: str) -> dict | None:
    if plan_id == DEMO_PLAN_ID:
        if user_id not in _demo_plan_sessions:
            _demo_plan_sessions[user_id] = {
                "user_id": user_id,
                "plan": _demo_plan_payload(),
                "modifications": [],
                "status": "pending",
            }
        return _demo_plan_sessions[user_id]
    row = _plans.get(plan_id)
    if not row or row["user_id"] != user_id:
        return None
    return row


class SessionRef(BaseModel):
    model_config = ConfigDict(extra="ignore")
    session_id: str | None = None


class ModifyBody(BaseModel):
    model_config = ConfigDict(extra="ignore")
    notes: str = ""
    session_id: str | None = None


@router.get("/plan/{plan_id}")
async def get_plan(
    plan_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
):
    row = get_plan_row(plan_id, current_user.id)
    if not row:
        raise HTTPException(status_code=404, detail="Plan not found")
    return row["plan"]


@router.post("/plan/{plan_id}/approve")
async def approve_plan(
    plan_id: str,
    body: SessionRef,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    row = get_plan_row(plan_id, current_user.id)
    if not row:
        raise HTTPException(status_code=404, detail="Plan not found")
    row["status"] = "approved"
    if body.session_id:
        result = await db.execute(
            select(DbSession).where(
                DbSession.id == body.session_id,
                DbSession.user_id == current_user.id,
            )
        )
        sess = result.scalar_one_or_none()
        if sess:
            sess.phase = "execution"
            sess.plan_id = plan_id
            await db.commit()
    return {"ok": True, "plan_id": plan_id, "phase": "execution"}


@router.post("/plan/{plan_id}/reject")
async def reject_plan(
    plan_id: str,
    body: SessionRef,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    row = get_plan_row(plan_id, current_user.id)
    if not row:
        raise HTTPException(status_code=404, detail="Plan not found")
    row["status"] = "rejected"
    if body.session_id:
        result = await db.execute(
            select(DbSession).where(
                DbSession.id == body.session_id,
                DbSession.user_id == current_user.id,
            )
        )
        sess = result.scalar_one_or_none()
        if sess:
            sess.phase = "analysis"
            await db.commit()
    return {"ok": True, "plan_id": plan_id, "phase": "analysis"}


@router.post("/plan/{plan_id}/modify")
async def modify_plan(
    plan_id: str,
    body: ModifyBody,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    row = get_plan_row(plan_id, current_user.id)
    if not row:
        raise HTTPException(status_code=404, detail="Plan not found")
    row["modifications"].append({"notes": body.notes})
    row["status"] = "modified"
    if body.session_id:
        result = await db.execute(
            select(DbSession).where(
                DbSession.id == body.session_id,
                DbSession.user_id == current_user.id,
            )
        )
        sess = result.scalar_one_or_none()
        if sess:
            sess.phase = "plan_review"
            await db.commit()
    return {"ok": True, "plan_id": plan_id, "modifications": row["modifications"]}
