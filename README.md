# RADCloud

Monorepo for **RADCloud**: migration-native FinOps with a FastAPI orchestrator and a React (Vite + Tailwind) frontend.

## Layout

```
radcloud/
├── frontend/          # React app (Vite + Tailwind)
├── backend/
│   ├── main.py        # FastAPI orchestrator
│   ├── config.py      # Bedrock model ID + region (env overrides)
│   ├── llm.py         # Claude via AWS Bedrock (boto3 invoke_model)
│   ├── build_cache.py # Regenerates data/cached_response.json from stub agents
│   ├── agents/        # Agent modules (stubs; replace with real agents)
│   └── models.py      # Shared Pydantic schemas
├── data/              # Sample Terraform, billing CSV, cached_response.json (demo)
└── README.md
```

**Agent pipeline:** Discovery → Mapping → Risk → FinOps → **Watchdog** (emits `runbook`, `watchdog`, `iac_bundle`).

**LLM:** Agents call **Amazon Bedrock** (Anthropic Claude) through `backend/llm.py` — not the direct Anthropic API. Model ID is centralized in `backend/config.py` (override with `BEDROCK_MODEL_ID`).

## Prerequisites

- Node.js 20+ and npm
- Python 3.11+
- AWS account with **Bedrock model access** enabled for your chosen Claude model (Console → Amazon Bedrock → Model access)

## Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
```

### AWS credentials (Bedrock)

Use the standard AWS credential chain (recommended: `aws configure`, IAM role on EC2/ECS, or environment variables):

```bash
set AWS_ACCESS_KEY_ID=...
set AWS_SECRET_ACCESS_KEY=...
set AWS_DEFAULT_REGION=us-east-1
```

Optional overrides:

- `BEDROCK_MODEL_ID` — default `anthropic.claude-sonnet-4-6` (change if your account uses another profile ID, e.g. `anthropic.claude-sonnet-4-5-20250929-v1:0` or `anthropic.claude-sonnet-4-20250514-v1:0`)
- `AWS_DEFAULT_REGION` — default `us-east-1` (must match a region where Bedrock hosts the model)

Run the API:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

API: [http://localhost:8000/docs](http://localhost:8000/docs)

### Quick Bedrock smoke test

From `backend/` with credentials configured:

```bash
python -c "from llm import call_llm; print(call_llm([{'role':'user','content':'Say hello in one word.'}]))"
```

### Demo mode (instant cached `/analyze`)

Returns `data/cached_response.json` without running agents or Bedrock (good for live demos):

```bash
set DEMO_MODE=true
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Or pass `--demo` on the uvicorn/python command line (see `backend/main.py`).

Regenerate the cache after changing stubs:

```bash
cd backend
python build_cache.py
```

Copy/sync `frontend/src/data/cachedResponse.json` from `data/cached_response.json` if you change backend output shape (or re-run your copy step).

## Frontend

React (Vite), Tailwind CSS 4, React Router, Zustand, Lucide icons, Recharts, and scripted onboarding chat. Routes: `/login`, `/signup`, `/app/onboarding`, `/app/dashboard` (and FinOps, Migration, Watchdog, Runbook, IaC sub-routes). Mock auth uses `localStorage` (`radcloud_user`).

```bash
cd frontend
npm install
npm run dev
```

Vite dev server proxies `/analyze`, `/sample-data`, and `/health` to `http://localhost:8000`.

Optional `frontend/.env`:

- `VITE_API_URL` — leave unset or empty for same-origin API (production: FastAPI serves the SPA). Set to `http://localhost:8000` if you run the UI without the proxy.
- `VITE_DEMO_MODE=true` — skip API and use bundled `src/data/cachedResponse.json`

If the API is unreachable, the app falls back to the cached demo response automatically.

## Single-port production (FastAPI + static SPA)

After `npm run build` in `frontend/`, copy the contents of `frontend/dist/` into `backend/static/` (including the `assets/` folder). With `backend/static/` present, `uvicorn` serves the SPA and `/assets/*`; API routes remain `/analyze`, `/analyze-stream`, `/sample-data`, `/health`, `/docs`, etc.

## Railway

Root [`nixpacks.toml`](nixpacks.toml) installs Python and Node, builds the frontend, and copies `frontend/dist/*` to `backend/static/`. [`railway.json`](railway.json) sets the start command and `/health` check. Set `DEMO_MODE=true` in Railway for instant cached analyses when appropriate.

## Sample data

- Repo root: `data/sample.tf` (~30 resources), `data/sample_billing.csv` (12 months)
- Served to the UI: `frontend/public/demo/` (used by **Try sample data**)

## CI/CD (GitHub Actions)

- **CI** ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)): on every push and pull request to `main` or `dev-1`, runs frontend `npm ci`, ESLint, and Vite production build; installs backend deps, byte-compiles Python, and smoke-imports the FastAPI app.
- **Deploy frontend** ([`.github/workflows/deploy-frontend.yml`](.github/workflows/deploy-frontend.yml)): builds the Vite app with `VITE_BASE=/<repository-name>/` (for GitHub project Pages) and deploys `frontend/dist` to **GitHub Pages**. Triggers on pushes to `main` that touch `frontend/**`, or run it manually via **Actions → Deploy frontend (GitHub Pages) → Run workflow**.

**Enable Pages once:** Repository **Settings → Pages → Build and deployment → Source: GitHub Actions**.

Hosted demo uses cached API fallback unless you set `VITE_API_URL` in the build step to a public API URL.

## License

Proprietary / team use unless otherwise stated.
