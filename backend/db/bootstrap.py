"""Optional bootstrap user from environment (Railway / ops only — never commit secrets)."""
from __future__ import annotations

import json
import logging
import os

from sqlalchemy import select

from db.database import AsyncSessionLocal
from db.models import User

logger = logging.getLogger(__name__)


async def ensure_bootstrap_user() -> None:
    """If RADCLOUD_BOOTSTRAP_EMAIL and RADCLOUD_BOOTSTRAP_PASSWORD are set, create or update that user.

    Password is never logged. Use this in Railway Variables instead of hardcoding credentials in git.
    """
    from routers.auth import _hash_password

    email = (os.environ.get("RADCLOUD_BOOTSTRAP_EMAIL") or "").strip()
    password = os.environ.get("RADCLOUD_BOOTSTRAP_PASSWORD")
    if not email or password is None or password == "":
        return

    name = (os.environ.get("RADCLOUD_BOOTSTRAP_NAME") or "Demo user").strip() or "Demo user"
    company_raw = os.environ.get("RADCLOUD_BOOTSTRAP_COMPANY")
    company = company_raw.strip() if company_raw and company_raw.strip() else None

    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        hashed = _hash_password(password)
        if user:
            user.hashed_password = hashed
            user.name = name
            user.company = company
            await session.commit()
            logger.info("Bootstrap user updated (email=%s)", email)
            return
        session.add(
            User(
                name=name,
                email=email,
                company=company,
                hashed_password=hashed,
                cloud_environments=json.dumps([]),
            )
        )
        await session.commit()
        logger.info("Bootstrap user created (email=%s)", email)
