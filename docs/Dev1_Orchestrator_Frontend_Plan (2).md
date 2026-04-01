# Dev 1 — Orchestrator + Frontend: Master Implementation Plan

**Project:** RADCloud  
**Role:** Orchestrator + Frontend  
**Time Budget:** 24 hours  
**Stack:** React (Vite + Tailwind), Python (FastAPI), **AWS Bedrock — Anthropic Claude** (see `backend/llm.py`, `backend/config.py`)

> **LLM inference:** The product uses **Claude only through Amazon Bedrock** (`invoke_model`), not the standalone Anthropic API. Orchestrator calls agents as `await agent_fn(context)`; agents use `call_llm_async()` from `backend/llm.py`.

---

## Your Responsibility in One Line

You own the user-facing app and the brain that coordinates all agents. If the frontend doesn't work or the orchestrator doesn't chain agents correctly, nothing else matters.

---

## Product Parity Requirements

The website describes RADCloud as a full product, not just a pipeline demo. Your plan must therefore ship the following product-level experience:

- The **5 agents shown to users are:** Discovery, Mapping, Risk, FinOps Intel, and **Watchdog**.
- The **Watchdog agent is the fifth agent in the orchestrator**, and it is responsible for emitting the post-migration outputs:
  - `runbook`
  - `watchdog`
  - `iac_bundle`
- The frontend must expose all major product surfaces promised in the website:
  - migration analysis tabs
  - Day-0 FinOps hero card
  - Watchdog dashboard / remediation opportunities
  - generated migration runbook
  - generated AWS Terraform / IaC output
- Where live cloud integrations are not ready, the UX must still exist using cached/demo-safe fallbacks. Do not leave these as implicit future ideas.

---

## Hour-by-Hour Execution Plan

### Hour 0–1: Kickoff + Schema Alignment

This hour is shared with the full team. Do not skip it.

- Set up the monorepo structure:
  ```
  radcloud/
  ├── frontend/          # React app (you own this)
  ├── backend/
  │   ├── main.py        # FastAPI orchestrator (you own this)
  │   ├── agents/        # Agent modules (Dev 2, 3, 4 own these)
  │   │   ├── __init__.py
  │   │   ├── discovery.py
  │   │   ├── mapping.py
  │   │   ├── risk.py
  │   │   ├── finops.py
  │   │   └── watchdog.py
  │   └── models.py      # Shared Pydantic schemas
  ├── data/              # Sample terraform + billing CSV
  └── README.md
  ```
- Agree on the shared context schema with all devs. Push the Pydantic models to `models.py` so everyone imports from the same place.
- Lock the product output contract in this hour. The backend response must include:
  - `gcp_inventory`
  - `aws_mapping`
  - `aws_architecture`
  - `risks`
  - `risk_summary`
  - `finops`
  - `runbook`
  - `watchdog`
  - `iac_bundle`
- Agree on the agent interface contract: every agent is an async function with this signature (LLM calls use `backend/llm.py` — Bedrock — internally):
  ```python
  async def run(context: dict) -> dict:
      # reads what it needs from context
      # writes its output back to context
      # returns the updated context
  ```
- Set up the GitHub repo. Make sure everyone can clone, run, and push.

### Hours 1–4: Build the Backend Orchestrator

This is your most critical piece. Get it working with stub agents before the real agents exist.

**Step 1 — FastAPI skeleton with CORS**

```python
# backend/main.py
from fastapi import FastAPI, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
import json, csv, io

app = FastAPI(title="RADCloud API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Step 2 — The /analyze endpoint**

Single POST endpoint that accepts:
- `terraform_config`: string (pasted Terraform/YAML)
- `billing_csv`: uploaded file (GCP billing export)

```python
@app.post("/analyze")
async def analyze(
    terraform_config: str = Form(...),
    billing_csv: UploadFile = None,
):
    # 1. Build initial context
    context = {
        "gcp_config_raw": terraform_config,
        "gcp_billing_raw": [],
        "status": "starting",
        "errors": [],
    }

    # 2. Parse billing CSV if provided
    if billing_csv:
        content = await billing_csv.read()
        reader = csv.DictReader(io.StringIO(content.decode("utf-8")))
        context["gcp_billing_raw"] = [row for row in reader]

    # 3. Run agent pipeline sequentially
    pipeline = [
        ("discovery", discovery_agent.run),
        ("mapping", mapping_agent.run),
        ("risk", risk_agent.run),
        ("finops", finops_agent.run),
        ("watchdog", watchdog_agent.run),
    ]

    for agent_name, agent_fn in pipeline:
        context["status"] = agent_name
        try:
            context = await agent_fn(context)
        except Exception as e:
            context["errors"].append({
                "agent": agent_name,
                "error": str(e)
            })
            # Continue with partial results

    context["status"] = "complete"
    return context
```

**Step 3 — AWS Bedrock (Claude) via `llm.py`**

Agents call `call_llm_async()` from `backend/llm.py` (boto3 `bedrock-runtime` `invoke_model`). Model ID and region live in `backend/config.py` (`BEDROCK_MODEL_ID`, `AWS_DEFAULT_REGION`). No client is passed into `run()` — credentials use the standard AWS chain.

**Step 4 — Stub agents for testing**

Write stubs for all 5 agents that return hardcoded sample data. This lets you test the full pipeline without waiting for Dev 2/3/4. The Watchdog stub must return `runbook`, `watchdog`, and `iac_bundle` so the full product shell is visible in the frontend before the real agent exists.

```python
# agents/discovery.py (stub)
async def run(context: dict) -> dict:
    context["gcp_inventory"] = [
        {"type": "compute_instance", "name": "web-server-1", "machine_type": "n1-standard-4", "region": "us-central1"},
        {"type": "cloud_sql", "name": "main-db", "tier": "db-n1-standard-2", "region": "us-central1"},
        {"type": "gcs_bucket", "name": "app-assets", "storage_class": "STANDARD", "region": "us"},
    ]
    return context
```

Do the same for mapping, risk, finops, and runbook stubs. Use realistic-looking sample data — you'll use these stubs for frontend development too.

**Step 5 — Streaming status endpoint (SSE)**

Add a Server-Sent Events endpoint so the frontend can show real-time agent progress:

```python
from fastapi.responses import StreamingResponse
import asyncio

# Use a global dict to track status per request (simple approach for hackathon)
# In the analyze endpoint, yield status updates as agents complete

@app.post("/analyze-stream")
async def analyze_stream(
    terraform_config: str = Form(...),
    billing_csv: UploadFile = None,
):
    async def event_generator():
        # ... same pipeline but yield SSE events between agents
        for agent_name, agent_fn in pipeline:
            yield f"data: {json.dumps({'status': agent_name, 'message': f'Running {agent_name} agent...'})}\n\n"
            context = await agent_fn(context)
            yield f"data: {json.dumps({'status': agent_name, 'message': f'{agent_name} complete', 'partial': context})}\n\n"
        yield f"data: {json.dumps({'status': 'complete', 'result': context})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

Note: if SSE is taking too long to get right, fall back to a simple POST that returns the full result. Don't burn hours on streaming — it's nice-to-have.

**Deliverable by hour 4:** A running FastAPI server with `/analyze` that chains 5 stub agents and returns a complete context JSON.

### Hours 4–8: Build the Frontend

**Step 1 — Scaffold**

```bash
npm create vite@latest frontend -- --template react
cd frontend
npm install
npm install -D tailwindcss @tailwindcss/vite
```

**Step 2 — App layout (single page, three sections)**

```
┌─────────────────────────────────────────────┐
│  RADCloud — Migration-Native FinOps         │
├─────────────────────────────────────────────┤
│  INPUT PANEL                                │
│  [Terraform/YAML textarea] [CSV upload]     │
│  [Analyze button]                           │
├─────────────────────────────────────────────┤
│  STATUS BAR                                 │
│  Discovery → Mapping → Risk → FinOps Intel →│
│  Watchdog   (highlight current agent)       │
├─────────────────────────────────────────────┤
│  RESULTS PANEL (tabbed)                     │
│  [Asset Map] [Architecture] [Risks]         │
│  [FinOps Plan] [Runbook] [Watchdog]         │
│  [IaC Output]                               │
│                                             │
│  (content of selected tab)                  │
└─────────────────────────────────────────────┘
```

**Step 3 — Input Panel component**

```jsx
function InputPanel({ onSubmit, isLoading }) {
  const [terraform, setTerraform] = useState("");
  const [billingFile, setBillingFile] = useState(null);

  const handleSubmit = () => {
    const formData = new FormData();
    formData.append("terraform_config", terraform);
    if (billingFile) formData.append("billing_csv", billingFile);
    onSubmit(formData);
  };

  return (
    <div>
      <textarea
        placeholder="Paste your GCP Terraform or YAML config here..."
        value={terraform}
        onChange={(e) => setTerraform(e.target.value)}
        rows={12}
      />
      <input
        type="file"
        accept=".csv"
        onChange={(e) => setBillingFile(e.target.files[0])}
      />
      <button onClick={handleSubmit} disabled={isLoading || !terraform}>
        {isLoading ? "Analyzing..." : "Analyze"}
      </button>
    </div>
  );
}
```

**Step 4 — Status Bar component**

Show the 5 agents as a horizontal pipeline. Highlight the current one. Grey out pending ones. Green checkmark for completed ones.

```jsx
const AGENTS = ["Discovery", "Mapping", "Risk", "FinOps Intel", "Watchdog"];

function StatusBar({ currentAgent, completedAgents }) {
  return (
    <div className="flex items-center gap-2">
      {AGENTS.map((agent, i) => {
        const isComplete = completedAgents.includes(agent.toLowerCase());
        const isCurrent = currentAgent === agent.toLowerCase();
        return (
          <div key={agent} className="flex items-center gap-2">
            <div className={`px-3 py-1 rounded text-sm font-medium
              ${isComplete ? "bg-green-100 text-green-800" : ""}
              ${isCurrent ? "bg-blue-100 text-blue-800 animate-pulse" : ""}
              ${!isComplete && !isCurrent ? "bg-gray-100 text-gray-400" : ""}
            `}>
              {isComplete ? "✓ " : ""}{agent}
            </div>
            {i < AGENTS.length - 1 && <span className="text-gray-300">→</span>}
          </div>
        );
      })}
    </div>
  );
}
```

**Step 5 — Results Panel with 7 tabs**

Each tab renders the relevant section of the context JSON. Here's what each tab shows:

| Tab | Context key | Display as |
|-----|------------|------------|
| Asset Map | `gcp_inventory` | Table of GCP resources (type, name, config) |
| Architecture | `aws_mapping` + `aws_architecture` | Service mapping table + architecture narrative |
| Risks | `risks` | List of risks with severity badges (red/yellow/green) |
| FinOps Plan | `finops` | Cost comparison table + RI recommendations + **the headline savings number in large bold text** |
| Runbook | `runbook` | Ordered list of migration steps with rollback + ownership |
| Watchdog | `watchdog` | Dashboard cards, trend charts, optimization opportunities, auto-remediation pipeline |
| IaC Output | `iac_bundle` | Generated AWS Terraform modules/files, assumptions, deployment notes |

The FinOps tab is the most important visually. The Day-0 savings number should be the most prominent element on the entire page. Think big font, a colored card, impossible to miss.

The Watchdog tab is the second most important. It is what closes the gap between "migration plan" and "operating product." It should visibly show:

- monthly AWS baseline / optimized spend
- top optimization opportunities
- anomaly detection status
- Detect → Evaluate → Apply → Verify remediation pipeline
- whether auto-remediation is simulated, suggested-only, or executable

```jsx
function FinOpsTab({ finops }) {
  if (!finops) return null;
  return (
    <div>
      {/* THE HERO NUMBER */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center mb-6">
        <p className="text-sm text-green-600 font-medium">Day-0 FinOps Savings</p>
        <p className="text-4xl font-bold text-green-800 mt-1">
          ${finops.total_first_year_savings?.toLocaleString()}
        </p>
        <p className="text-sm text-green-600 mt-2">
          estimated first-year savings vs. waiting for traditional FinOps observation period
        </p>
      </div>

      {/* RI recommendations table */}
      {/* Cost comparison table */}
      {/* Natural language summary */}
    </div>
  );
}
```

**Step 6 — API call wiring**

```jsx
const handleAnalyze = async (formData) => {
  setIsLoading(true);
  setCurrentAgent("discovery");

  try {
    const response = await fetch("http://localhost:8000/analyze", {
      method: "POST",
      body: formData,
    });
    const result = await response.json();
    setResults(result);
  } catch (error) {
    setError(error.message);
  } finally {
    setIsLoading(false);
    setCurrentAgent(null);
  }
};
```

If you implemented the SSE endpoint, use EventSource to update the status bar in real-time. If not, just show a spinner with a simulated progress bar that cycles through agent names on a timer.

**Deliverable by hour 8:** A working React app that talks to the backend, shows the agent pipeline status, and renders Asset Map, Architecture, Risks, FinOps, Runbook, Watchdog, and IaC Output from the stub data.

### Hours 8–12: Integration

This is when the real agents from Dev 2/3/4 replace your stubs.

- Pull each dev's agent code into `backend/agents/`.
- Replace stub imports with real agent imports.
- Test the full pipeline: real Terraform input → real Discovery → real Mapping → real Risk → real FinOps → real Watchdog → frontend displays real output.
- Debug integration issues. Common problems:
  - Agent writes to a context key with a different name or structure than the frontend expects → fix the agent or the frontend.
  - Agent takes too long (Bedrock / Claude inference timing out) → add timeout handling, increase timeout.
  - Agent throws an error on real data → work with the agent's dev to fix.
- Make sure partial results display correctly: if the Risk agent fails, the frontend should still show Asset Map, Architecture, and whatever else succeeded.

**Your job during integration is to be the glue.** You know the full pipeline. When something breaks, you figure out which agent is at fault and coordinate the fix.

### Hours 12–16: Polish

- Make the frontend look professional. This is a demo — visual polish matters.
  - Clean typography, consistent spacing, no default browser styling.
  - The RADCloud brand: pick a simple color scheme (suggest dark blue + green accents to evoke cloud + money/savings).
  - Add a subtle loading animation while agents run.
  - Make sure the FinOps savings number has maximum visual impact.
- Make the app look like the product on the website, not a bare internal tool:
  - Add a concise executive-summary header area that reinforces "Migration-Native FinOps" and "Day-0 optimization".
  - Make the Watchdog view feel like an operations dashboard, not a plain JSON dump.
  - Show IaC output in a code-viewer / file-tree style panel so the generated Terraform feels tangible.
- Error states: show user-friendly messages if an agent fails.
- Edge cases: what if the user pastes garbage Terraform? Show a validation error. What if the CSV has wrong columns? Show a helpful message.
- Add a "Try Sample Data" button that pre-fills the inputs with the demo data (from Dev 4). This is a safety net for the live demo.

### Hours 16–20: Demo Prep

- Lock the code. No new features.
- Build the demo script (exact click sequence, exact talking points per tab).
- Run the demo end-to-end at least 5 times.
- Pre-cache the LLM pipeline responses for the sample data: save the full context JSON from a successful run and add a `--demo-mode` flag that returns the cached result instead of calling Bedrock. This guarantees the demo works even if inference is slow or rate-limited.
- Time the demo. It should be under 5 minutes.
- Prepare for questions: "How does the mapping work?", "Where does the pricing data come from?", "How accurate is the cost estimate?", "What exactly does Watchdog do after migration?", "Is this real Terraform or a plan artifact?"

### Hours 20–24: Buffer

- Fix any last bugs found during rehearsal.
- Do NOT start new features.
- Final rehearsal with the full team.

---

## Key Technical Decisions

**Why FastAPI, not Flask?**
Async support out of the box. If you want SSE or WebSocket streaming later, it's trivial. Also, automatic OpenAPI docs at `/docs` are useful for debugging during integration.

**Why sequential agent execution, not parallel?**
Agents depend on each other: Mapping needs Discovery output, Risk needs Mapping output, etc. The pipeline is inherently sequential. Don't over-engineer parallelism for a hackathon.

**Why stub agents first?**
You cannot afford to be blocked by Dev 2/3/4. With stubs, your frontend and orchestrator are fully testable by hour 8, regardless of whether the real agents are ready.

**Why a "Try Sample Data" button?**
Live demos fail. Network issues, API rate limits, typos. The sample data button is your insurance policy. If anything goes wrong during the live demo, click it and the demo still works perfectly from cached data.

**Why cache Bedrock responses for demo mode?**
Claude-on-Bedrock latency can vary from 2–15 seconds per call. With 5 agents each making 1–2 calls, the demo could take 30–60 seconds of loading. Cached responses make it instant. Only use caching during the demo, not during development/testing.

---

## Files You Own

| File | Purpose |
|------|---------|
| `backend/main.py` | FastAPI app, /analyze endpoint, agent orchestration |
| `backend/models.py` | Pydantic models for shared context schema |
| `backend/agents/__init__.py` | Agent imports |
| `backend/agents/*.py` (stubs only) | Stub implementations, replaced by Dev 2/3/4 code |
| `frontend/src/App.jsx` | Main app component |
| `frontend/src/components/InputPanel.jsx` | Terraform + CSV input |
| `frontend/src/components/StatusBar.jsx` | Agent pipeline progress |
| `frontend/src/components/ResultsPanel.jsx` | Tabbed results container |
| `frontend/src/components/tabs/AssetMapTab.jsx` | GCP inventory display |
| `frontend/src/components/tabs/ArchitectureTab.jsx` | AWS mapping + architecture |
| `frontend/src/components/tabs/RisksTab.jsx` | Risk report |
| `frontend/src/components/tabs/FinOpsTab.jsx` | Cost comparison + Day-0 savings |
| `frontend/src/components/tabs/RunbookTab.jsx` | Migration runbook |
| `frontend/src/components/tabs/WatchdogTab.jsx` | Post-migration optimization dashboard |
| `frontend/src/components/tabs/IaCOutputTab.jsx` | Generated AWS Terraform / IaC bundle viewer |

---

## Integration Checklist

Use this when wiring in real agents at hour 8:

- [ ] Discovery agent writes `gcp_inventory` in the expected format
- [ ] Mapping agent reads `gcp_inventory` and writes `aws_mapping` + `aws_architecture`
- [ ] Risk agent reads `aws_mapping` and writes `risks` as a list with `category`, `severity`, `description`, `mitigation`
- [ ] FinOps agent reads `gcp_billing_raw` + `aws_mapping` and writes `finops` with `total_first_year_savings`, `ri_recommendations`, `cost_comparison`, `summary`
- [ ] Watchdog agent reads all prior context and writes `runbook`, `watchdog`, and `iac_bundle`
- [ ] Frontend renders every field without crashing on null/undefined
- [ ] Error in one agent doesn't crash the pipeline
- [ ] "Try Sample Data" button works with cached output
- [ ] Watchdog tab clearly communicates whether remediation actions are simulated or executable
- [ ] IaC tab renders generated files / code blocks without layout breakage

---

## What to Cut If Behind

1. **Cut SSE streaming** — just use a simple POST with a loading spinner. Simulate the agent steps with a timer.
2. **Cut edge case validation** — if the demo data works, that's enough. Don't spend hours handling malformed input.
3. **Cut live cloud adapters in the UI** — if needed, render cached data while preserving the Watchdog/IaC surfaces and their schemas.
4. **Cut Watchdog chart polish, not the Watchdog tab itself** — static cards are acceptable; the product surface must still exist.
5. **Never cut the FinOps tab** — this is the entire demo.
6. **Never cut the Watchdog + IaC surfaces** — these are the features that align the app with the product website.
7. **Never cut the "Try Sample Data" button** — this is your demo insurance policy.
