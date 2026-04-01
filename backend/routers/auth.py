"""JWT authentication router — signup, login, me."""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import bcrypt
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from db.models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

_jwt_raw = os.environ.get("JWT_SECRET")
_SECRET = (
    _jwt_raw.strip()
    if _jwt_raw and _jwt_raw.strip()
    else "radcloud-dev-secret-change-in-production"
)
_ALGORITHM = "HS256"
_TOKEN_EXPIRE_DAYS = 30

_bearer = HTTPBearer(auto_error=False)


# ---------- Pydantic schemas ----------

class SignupRequest(BaseModel):
    name: str
    email: str
    password: str
    company: str | None = None
    cloud_environments: list[str] = []


class LoginRequest(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    company: str | None
    cloud_environments: list[str]
    created_at: datetime


class TokenResponse(BaseModel):
    token: str
    user: UserResponse


# ---------- Helpers ----------

def _hash_password(plain: str) -> str:
    data = plain.encode("utf-8")
    if len(data) > 72:
        data = data[:72]
    return bcrypt.hashpw(data, bcrypt.gensalt()).decode("ascii")


def _verify_password(plain: str, hashed: str) -> bool:
    try:
        h = hashed.encode("utf-8")
    except (UnicodeEncodeError, AttributeError):
        return False
    data = plain.encode("utf-8")
    if len(data) > 72:
        data = data[:72]
    return bcrypt.checkpw(data, h)


def _create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.utcnow() + timedelta(days=_TOKEN_EXPIRE_DAYS),
    }
    return jwt.encode(payload, _SECRET, algorithm=_ALGORITHM)


def _decode_token(token: str) -> str:
    """Return user_id from a valid token or raise HTTPException."""
    try:
        payload = jwt.decode(token, _SECRET, algorithms=[_ALGORITHM])
        user_id: str | None = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def decode_access_token(token: str) -> str:
    """Public helper for SSE/query-token auth — same as _decode_token."""
    return _decode_token(token)


def _user_to_response(user: User) -> UserResponse:
    envs = json.loads(user.cloud_environments or "[]")
    return UserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        company=user.company,
        cloud_environments=envs,
        created_at=user.created_at,
    )


# ---------- Dependency ----------

async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    db: AsyncSession = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = _decode_token(credentials.credentials)
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def get_current_user_optional(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """Bearer JWT if present; otherwise None (for optional auth on analyze)."""
    if not credentials:
        return None
    try:
        user_id = _decode_token(credentials.credentials)
    except HTTPException:
        return None
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


# ---------- Routes ----------

@router.post("/signup", response_model=TokenResponse, status_code=201)
async def signup(body: SignupRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    try:
        user = User(
            name=body.name,
            email=body.email,
            company=body.company,
            hashed_password=_hash_password(body.password),
            cloud_environments=json.dumps(body.cloud_environments),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    except SQLAlchemyError:
        logger.exception("signup database error")
        raise HTTPException(
            status_code=503,
            detail=(
                "Database error during signup. Check Railway logs; ensure "
                "RADCLOUD_DB_PATH is unset or a writable path (not blank)."
            ),
        ) from None

    return TokenResponse(token=_create_token(user.id), user=_user_to_response(user))


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not _verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return TokenResponse(token=_create_token(user.id), user=_user_to_response(user))


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    return _user_to_response(current_user)
