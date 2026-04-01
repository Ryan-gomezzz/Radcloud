"""Session management router."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from db.models import ChatMessage, Session, User
from routers.auth import get_current_user

router = APIRouter(prefix="/sessions", tags=["sessions"])


class SessionSummary(BaseModel):
    id: str
    phase: str
    plan_id: str | None
    created_at: datetime
    updated_at: datetime
    message_count: int


class CreateSessionResponse(BaseModel):
    session_id: str


@router.post("", response_model=CreateSessionResponse, status_code=201)
async def create_session(
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    session = Session(user_id=current_user.id)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return CreateSessionResponse(session_id=session.id)


@router.get("", response_model=list[SessionSummary])
async def list_sessions(
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Session).where(Session.user_id == current_user.id).order_by(Session.updated_at.desc())
    )
    sessions = result.scalars().all()
    summaries = []
    for s in sessions:
        count_result = await db.execute(
            select(ChatMessage).where(ChatMessage.session_id == s.id)
        )
        count = len(count_result.scalars().all())
        summaries.append(
            SessionSummary(
                id=s.id,
                phase=s.phase,
                plan_id=s.plan_id,
                created_at=s.created_at,
                updated_at=s.updated_at,
                message_count=count,
            )
        )
    return summaries


@router.get("/{session_id}", response_model=SessionSummary)
async def get_session(
    session_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Session).where(Session.id == session_id, Session.user_id == current_user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    count_result = await db.execute(
        select(ChatMessage).where(ChatMessage.session_id == session_id)
    )
    return SessionSummary(
        id=session.id,
        phase=session.phase,
        plan_id=session.plan_id,
        created_at=session.created_at,
        updated_at=session.updated_at,
        message_count=len(count_result.scalars().all()),
    )


@router.delete("/{session_id}", status_code=204)
async def delete_session(
    session_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Session).where(Session.id == session_id, Session.user_id == current_user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    # clear in-memory credentials
    try:
        from cloud.credential_store import clear_credentials
        clear_credentials(session_id)
    except Exception:
        pass
    await db.delete(session)
    await db.commit()
