"""RADCloud FastAPI orchestrator — chains agent pipeline."""

from __future__ import annotations

import csv
import io
import json
import os
from typing import Any

from fastapi import FastAPI, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from agents import discovery, finops, mapping, risk, runbook, watchdog

try:
    import anthropic

    _api_key = os.environ.get("ANTHROPIC_API_KEY")
    claude_client = anthropic.Anthropic(api_key=_api_key) if _api_key else None
except ImportError:
    claude_client = None

app = FastAPI(title="RADCloud API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

PIPELINE: list[tuple[str, Any]] = [
    ("discovery", discovery.run),
    ("mapping", mapping.run),
    ("risk", risk.run),
    ("finops", finops.run),
    ("runbook", runbook.run),
    ("watchdog", watchdog.run),
]


async def _run_pipeline(context: dict) -> dict:
    for agent_name, agent_fn in PIPELINE:
        context["status"] = agent_name
        try:
            context = await agent_fn(context, claude_client)
        except Exception as e:
            context.setdefault("errors", []).append({"agent": agent_name, "error": str(e)})
    context["status"] = "complete"
    return context


@app.post("/analyze")
async def analyze(
    terraform_config: str = Form(...),
    billing_csv: UploadFile | None = None,
):
    context: dict = {
        "gcp_config_raw": terraform_config,
        "gcp_billing_raw": [],
        "status": "starting",
        "errors": [],
    }

    if billing_csv and billing_csv.filename:
        content = await billing_csv.read()
        reader = csv.DictReader(io.StringIO(content.decode("utf-8")))
        context["gcp_billing_raw"] = [row for row in reader]

    return await _run_pipeline(context)


@app.post("/analyze-stream")
async def analyze_stream(
    terraform_config: str = Form(...),
    billing_csv: UploadFile | None = None,
):
    context: dict = {
        "gcp_config_raw": terraform_config,
        "gcp_billing_raw": [],
        "status": "starting",
        "errors": [],
    }

    if billing_csv and billing_csv.filename:
        content = await billing_csv.read()
        reader = csv.DictReader(io.StringIO(content.decode("utf-8")))
        context["gcp_billing_raw"] = [row for row in reader]

    async def event_generator():
        nonlocal context
        for agent_name, agent_fn in PIPELINE:
            yield f"data: {json.dumps({'status': agent_name, 'message': f'Running {agent_name} agent...'})}\n\n"
            try:
                context = await agent_fn(context, claude_client)
            except Exception as e:
                context.setdefault("errors", []).append({"agent": agent_name, "error": str(e)})
            yield f"data: {json.dumps({'status': agent_name, 'message': f'{agent_name} complete', 'partial': context})}\n\n"
        context["status"] = "complete"
        yield f"data: {json.dumps({'status': 'complete', 'result': context})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
