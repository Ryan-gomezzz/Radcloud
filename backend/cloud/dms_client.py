"""DMS / storage migration — simulated progress streams for MVP."""
from __future__ import annotations

import asyncio
import random
from collections.abc import AsyncIterator


async def simulate_db_migration() -> AsyncIterator[dict]:
    """Yield DB migration progress dicts."""
    progress = 0.0
    lag = 280
    rows = 0
    total = 48_000_000
    while progress < 100:
        await asyncio.sleep(0.35)
        progress = min(100.0, progress + random.uniform(2.0, 5.5))
        lag = max(8, min(400, lag + random.randint(-6, 8)))
        rows = min(total, rows + random.randint(8_000, 22_000))
        yield {
            "progress": round(progress, 1),
            "replication_lag_ms": lag,
            "rows_migrated": rows,
            "total_rows": total,
        }


async def simulate_storage_migration() -> AsyncIterator[dict]:
    """Yield storage transfer progress dicts."""
    transferred = 0.0
    total_gb = 820.0
    while transferred < total_gb * 0.99:
        await asyncio.sleep(0.35)
        transferred = min(total_gb, transferred + random.uniform(4.0, 14.0))
        mbps = random.uniform(155, 220)
        yield {
            "transferred_gb": round(transferred, 2),
            "total_gb": total_gb,
            "transfer_rate_mbps": round(mbps, 1),
        }
