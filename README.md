# RADCloud

Monorepo for **RADCloud**: migration-native FinOps with a FastAPI orchestrator and a React (Vite + Tailwind) frontend.

## Layout

```
radcloud/
├── frontend/          # React app (Vite + Tailwind)
├── backend/
│   ├── main.py        # FastAPI orchestrator
│   ├── agents/        # Agent modules (stubs; replaced by specialized agents)
│   └── models.py      # Shared Pydantic schemas
├── data/              # Sample Terraform + billing CSV
└── README.md
```

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

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Optional: `frontend/.env` with `VITE_API_URL=http://localhost:8000` (defaults to that URL).

## Sample data

- Repo root: `data/sample.tf`, `data/sample_billing.csv`
- Served to the UI: `frontend/public/demo/` (used by **Try sample data**)

## License

Proprietary / team use unless otherwise stated.
