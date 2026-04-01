"""Terraform plan/apply — simulated async line stream for MVP.

Future: tempfile.mkdtemp, subprocess terraform plan -json / apply, env from credential store.
"""
from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator


async def plan(_config_dir: str, _env: dict) -> AsyncIterator[str]:
    """Yield simulated terraform plan log lines."""
    lines = [
        "[terraform] Initializing provider plugins…",
        "[terraform] Refreshing state…",
        "[terraform] Planning 28 resources to add, 0 to change, 0 to destroy.",
        "[terraform] module.vpc.aws_vpc.main will be created",
        "[terraform] module.compute.aws_instance.web will be created",
        "[terraform] Plan complete — review approval required.",
    ]
    for line in lines:
        await asyncio.sleep(0.45)
        yield line


async def apply(_config_dir: str, _env: dict) -> AsyncIterator[str]:
    """Yield simulated terraform apply log lines."""
    lines = [
        "[terraform] Applying execution plan…",
        "[terraform] aws_vpc.main: Creating…",
        "[terraform] aws_vpc.main: Creation complete after 8s",
        "[terraform] aws_subnet.private: Creating…",
        "[terraform] Apply complete — 28 resources added.",
    ]
    for line in lines:
        await asyncio.sleep(0.45)
        yield line
