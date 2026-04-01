# RADCloud

Monorepo for **RADCloud**: migration-native FinOps with a FastAPI orchestrator and a React (Vite + Tailwind) frontend.

## Layout

```
radcloud/
├── frontend/          # React app (Vite + Tailwind)
├── backend/
│   ├── main.py        # FastAPI orchestrator
│   ├── build_cache.py # Regenerates data/cached_response.json from stub agents
│   ├── agents/        # Agent modules (stubs; replace with real agents)
│   └── models.py      # Shared Pydantic schemas
├── data/              # Sample Terraform, billing CSV, cached_response.json (demo)
└── README.md
```

**Agent pipeline:** Discovery → Mapping → Risk → FinOps → **Watchdog** (emits `runbook`, `watchdog`, `iac_bundle`).

## Prerequisites

- Node.js 20+ and npm
- Python 3.11+

## Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
set ANTHROPIC_API_KEY=your-key   # optional for stub pipeline
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

API: [http://localhost:8000/docs](http://localhost:8000/docs)

### Demo mode (instant cached `/analyze`)

Returns `data/cached_response.json` without running agents (good for live demos):

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

```bash
cd frontend
npm install
npm run dev
```

Optional `frontend/.env`:

- `VITE_API_URL=http://localhost:8000` (default)
- `VITE_DEMO_MODE=true` — skip API and use bundled `src/data/cachedResponse.json`

If the API is unreachable, the app falls back to the cached demo response automatically.

## Sample data

- Repo root: `data/sample.tf` (~30 resources), `data/sample_billing.csv` (12 months)
- Served to the UI: `frontend/public/demo/` (used by **Try sample data**)

## License

Proprietary / team use unless otherwise stated.
