"""Async SQLite database engine and session factory."""
from __future__ import annotations

import logging
import os
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

logger = logging.getLogger(__name__)


def _resolve_db_path() -> str:
    """Pick a SQLite file path.

    - Empty or whitespace ``RADCLOUD_DB_PATH`` is treated as unset (Railway often
      stores blank vars as ``""``, which would otherwise yield a broken URL
      ``sqlite+aiosqlite:///`` and break ``init_db`` / signup).
    - On Railway, default to ``/tmp/radcloud.db`` so the DB is always on a
      writable filesystem (ephemeral until redeploy unless you add a volume).
    """
    raw = os.environ.get("RADCLOUD_DB_PATH")
    if raw is not None and raw.strip():
        return raw.strip()
    if os.environ.get("RAILWAY_PROJECT_ID") or os.environ.get("RAILWAY_ENVIRONMENT"):
        return "/tmp/radcloud.db"
    return str(Path(__file__).resolve().parent.parent / "radcloud.db")


_DB_PATH = _resolve_db_path()
Path(_DB_PATH).parent.mkdir(parents=True, exist_ok=True)
_DATABASE_URL = f"sqlite+aiosqlite:///{_DB_PATH}"
logger.info("SQLite database path: %s", _DB_PATH)

engine = create_async_engine(_DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


async def init_db() -> None:
    """Create all tables on startup."""
    from db import models as _  # noqa: F401 — registers ORM models
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
