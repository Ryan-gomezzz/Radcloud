"""RADCloud FastAPI orchestrator — chains agent pipeline."""

from __future__ import annotations

import csv
import io
import json
import logging
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated, Any

from fastapi import Depends, FastAPI, Form, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from agents import discovery, finops, mapping, planner, risk, watchdog
from db.bootstrap import ensure_bootstrap_user
from db.database import init_db
from db.models import User
from llm import call_llm_async
from rag.store import build_store
from routers import auth, cloud, execution, pipeline, sessions
from routers.auth import get_current_user_optional
from routers.pipeline import register_migration_plan

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        await init_db()
    except Exception:
        logger.exception("init_db failed — SQLite auth/session features may be unavailable")
    try:
        await ensure_bootstrap_user()
    except Exception:
        logger.exception("ensure_bootstrap_user failed — set RADCLOUD_BOOTSTRAP_* in Railway if you need a fixed login")
    try:
        await build_store()
    except Exception:
        logger.exception("build_store failed — RAG may be empty; agents continue with stubs")
    yield


app = FastAPI(title="RADCloud API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(cloud.router)
app.include_router(sessions.router)
app.include_router(pipeline.router)
app.include_router(execution.router)

PIPELINE: list[tuple[str, Any]] = [
    ("discovery", discovery.run),
    ("mapping", mapping.run),
    ("risk", risk.run),
    ("finops", finops.run),
    ("watchdog", watchdog.run),
    ("planner", planner.run),
]

_REPO_ROOT = Path(__file__).resolve().parent.parent
_CACHED_RESPONSE_PATH = _REPO_ROOT / "data" / "cached_response.json"
_BACKEND_DIR = Path(__file__).resolve().parent
_STATIC_DIR = _BACKEND_DIR / "static"


def _demo_mode_enabled() -> bool:
    env = os.environ.get("DEMO_MODE", "").lower()
    if env in ("true", "1", "yes"):
        return True
    return "--demo" in sys.argv


def _load_cached_response() -> dict[str, Any]:
    if not _CACHED_RESPONSE_PATH.is_file():
        raise FileNotFoundError(
            f"Demo cache missing: {_CACHED_RESPONSE_PATH}. Run backend once without DEMO_MODE or generate the file."
        )
    with open(_CACHED_RESPONSE_PATH, encoding="utf-8") as f:
        return json.load(f)


async def _run_pipeline(context: dict) -> dict:
    for agent_name, agent_fn in PIPELINE:
        context["status"] = agent_name
        try:
            context = await agent_fn(context)
        except Exception as e:
            context.setdefault("errors", []).append({"agent": agent_name, "error": str(e)})
    context["status"] = "complete"
    return context


def _register_plan_if_authed(context: dict, current_user: User | None) -> None:
    mp = context.get("migration_plan")
    if current_user and isinstance(mp, dict) and mp.get("plan_id"):
        register_migration_plan(current_user.id, mp)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/sample-data")
async def get_sample_data():
    """Return sample Terraform and billing CSV for the demo flow."""
    tf_path = _REPO_ROOT / "data" / "sample.tf"
    billing_path = _REPO_ROOT / "data" / "sample_billing.csv"
    if not tf_path.is_file() or not billing_path.is_file():
        return JSONResponse(
            {"detail": "Sample data files missing"},
            status_code=404,
        )
    terraform = tf_path.read_text(encoding="utf-8")
    billing_csv = billing_path.read_text(encoding="utf-8")
    return {"terraform": terraform, "billing_csv": billing_csv}


@app.post("/chat")
async def chat(request: Request):
    """
    Natural language onboarding chat.
    The frontend sends the full conversation history.
    The backend calls Bedrock with a system prompt that guides the onboarding.
    Returns the AI's next message + any extracted structured data.
    """
    body = await request.json()
    messages = body.get("messages", [])

    if _demo_mode_enabled():
        user_msgs = [m for m in messages if m.get("role") == "user" and str(m.get("content", "")).strip()]
        user_count = len(user_msgs)
        
        state = {
            "goal": "migration",
            "has_existing_aws": False,
            "has_terraform": True,
            "has_billing": True,
            "wants_sample_data": False,
            "ready_to_analyze": False,
        }
        
        if user_count == 0:
            text = "Welcome to RADCloud! I'm your digital cloud consultant. Are you looking to migrate infrastructure to AWS, or optimize existing environments today?"
            state = { "goal": None, "has_existing_aws": None, "has_terraform": False, "has_billing": False, "wants_sample_data": False, "ready_to_analyze": False }
        elif user_count == 1:
            text = "Great. Have you already set up an AWS environment, or are we starting fresh?"
            state["has_existing_aws"] = None
        elif user_count == 2:
            text = "Understood. Do you have your infrastructure configurations and billing exports, or would you like to run a demo with sample data?"
        elif user_count == 3:
            text = "Perfect. I've received your configurations. Shall I go ahead and run the comprehensive RADCloud analysis?"
            state["ready_to_analyze"] = True
        else:
            text = "I'm ready when you are. Just click 'Run Pipeline' to proceed."
            state["ready_to_analyze"] = True
            
        return {"message": text, "state": state}

    system_prompt = """You are the RADCloud onboarding assistant. You are a senior cloud migration consultant helping a user set up their GCP-to-AWS migration analysis.

Your personality: professional, knowledgeable, concise. You speak like a trusted consultant — confident but not arrogant. You explain technical concepts simply when needed. You never use emojis. You use proper punctuation and clear language.

Your goal is to collect the following information through natural conversation:

1. PRIMARY GOAL — Are they migrating from GCP to AWS, optimizing existing AWS costs, or both?
2. CURRENT STATE — Do they have any existing AWS presence?
3. INFRASTRUCTURE CONFIG — Their GCP Terraform/YAML configuration (they will paste it or request sample data)
4. BILLING DATA — Their GCP billing export CSV (they will upload it or request sample data)
5. CONFIRMATION — Confirm what you have and ask if they are ready to run the analysis.

Rules:
- Ask ONE question at a time. Do not overwhelm with multiple questions.
- If the user's response is ambiguous, ask a clarifying follow-up.
- If the user says something unrelated, gently redirect to the task.
- When the user provides their config, acknowledge what you received (e.g., "I can see Terraform configuration with several compute and database resources").
- When you have all 4 pieces of information, summarize what you have and ask "Shall I run the analysis?"
- If the user asks to use sample/demo data, say: "I will use a sample fintech infrastructure called NovaPay — 30 GCP resources with 12 months of billing history. This will demonstrate the full RADCloud pipeline."
- Keep responses to 2-4 sentences. Never write paragraphs.
- Never use emojis. Never use markdown formatting in your responses (no **, no ##, no bullet points with *). Write plain text only.

At the END of every response, append a JSON block wrapped in <radcloud_state> tags. This is invisible to the user but parsed by the frontend:

<radcloud_state>
{
  "goal": "migration" | "finops" | "both" | null,
  "has_existing_aws": true | false | null,
  "has_terraform": true | false,
  "has_billing": true | false,
  "wants_sample_data": true | false,
  "ready_to_analyze": true | false
}
</radcloud_state>

Always include this state block. Update it as you collect information."""

    try:
        response_text = await call_llm_async(
            messages=messages,
            system=system_prompt,
            max_tokens=512,
            temperature=0.3,
        )

        state = {}
        clean_text = response_text
        if "<radcloud_state>" in response_text:
            parts = response_text.split("<radcloud_state>")
            clean_text = parts[0].strip()
            if "</radcloud_state>" in parts[1]:
                state_json = parts[1].split("</radcloud_state>")[0].strip()
                try:
                    state = json.loads(state_json)
                except json.JSONDecodeError:
                    pass

        return {
            "message": clean_text,
            "state": state,
        }
    except Exception as e:
        # Fallback if Bedrock is unreachable or credentials are missing
        user_msgs = [m for m in messages if m.get("role") == "user" and str(m.get("content", "")).strip()]
        user_count = len(user_msgs)
        
        state = {
            "goal": "migration",
            "has_existing_aws": False,
            "has_terraform": True,
            "has_billing": True,
            "wants_sample_data": False,
            "ready_to_analyze": False,
        }
        
        if user_count == 0:
            text = "Welcome to RADCloud! (Bedrock unreachable, running offline proxy) Are you looking to migrate infrastructure to AWS, or optimize existing environments today?"
            state = { "goal": None, "has_existing_aws": None, "has_terraform": False, "has_billing": False, "wants_sample_data": False, "ready_to_analyze": False }
        elif user_count == 1:
            text = "(Offline proxy) Great. Have you already set up an AWS environment, or are we starting fresh?"
            state["has_existing_aws"] = None
        elif user_count == 2:
            text = "(Offline proxy) Understood. Do you have your infrastructure configurations and billing exports, or would you like to run a demo with sample data?"
        elif user_count == 3:
            text = "(Offline proxy) Perfect. I've received your configurations. Shall I go ahead and run the comprehensive RADCloud analysis?"
            state["ready_to_analyze"] = True
        else:
            text = "(Offline proxy) I'm ready when you are. Just click 'Run Pipeline' to proceed."
            state["ready_to_analyze"] = True
            
        return {"message": text, "state": state}


@app.post("/analyze")
async def analyze(
    current_user: Annotated[User | None, Depends(get_current_user_optional)],
    terraform_config: str = Form(...),
    billing_csv: UploadFile | None = None,
):
    if _demo_mode_enabled():
        out = _load_cached_response()
        out = {**out, "gcp_config_raw": terraform_config, "demo_mode": True}
        if billing_csv and billing_csv.filename:
            content = await billing_csv.read()
            reader = csv.DictReader(io.StringIO(content.decode("utf-8")))
            out["gcp_billing_raw"] = [row for row in reader]
        if not out.get("migration_plan"):
            out["migration_plan"] = planner.stub_migration_plan()
        _register_plan_if_authed(out, current_user)
        return out

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

    out = await _run_pipeline(context)
    _register_plan_if_authed(out, current_user)
    return out


@app.post("/analyze-stream")
async def analyze_stream(
    current_user: Annotated[User | None, Depends(get_current_user_optional)],
    terraform_config: str = Form(...),
    billing_csv: UploadFile | None = None,
):
    if _demo_mode_enabled():
        out = _load_cached_response()
        out = {**out, "gcp_config_raw": terraform_config, "demo_mode": True}
        if billing_csv and billing_csv.filename:
            content = await billing_csv.read()
            reader = csv.DictReader(io.StringIO(content.decode("utf-8")))
            out["gcp_billing_raw"] = [row for row in reader]
        if not out.get("migration_plan"):
            out["migration_plan"] = planner.stub_migration_plan()
        _register_plan_if_authed(out, current_user)

        async def demo_events():
            yield f"data: {json.dumps({'status': 'complete', 'message': 'Demo mode — cached result', 'result': out})}\n\n"

        return StreamingResponse(demo_events(), media_type="text/event-stream")

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
                context = await agent_fn(context)
            except Exception as e:
                context.setdefault("errors", []).append({"agent": agent_name, "error": str(e)})
            yield f"data: {json.dumps({'status': agent_name, 'message': f'{agent_name} complete', 'partial': context})}\n\n"
        context["status"] = "complete"
        _register_plan_if_authed(context, current_user)
        yield f"data: {json.dumps({'status': 'complete', 'result': context})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


if _STATIC_DIR.is_dir():
    assets_dir = _STATIC_DIR / "assets"
    if assets_dir.is_dir():
        app.mount(
            "/assets",
            StaticFiles(directory=str(assets_dir)),
            name="assets",
        )

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve the React SPA for non-API browser navigation."""
        index = _STATIC_DIR / "index.html"
        if not index.is_file():
            return JSONResponse({"detail": "Frontend not built"}, status_code=404)
        return FileResponse(str(index))
