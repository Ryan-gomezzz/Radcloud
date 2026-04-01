"""Pipeline — migration plan registry, approve / reject / modify."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from db.models import Session as DbSession
from db.models import User
from routers.auth import get_current_user

router = APIRouter(prefix="/pipeline", tags=["pipeline"])

# plan_id -> { user_id, plan dict, modifications[], status }
_plans: dict[str, dict] = {}


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
    row = _plans.get(plan_id)
    if not row or row["user_id"] != user_id:
        return None
    return row


class SessionRef(BaseModel):
    session_id: str | None = None


class ModifyBody(BaseModel):
    notes: str
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
