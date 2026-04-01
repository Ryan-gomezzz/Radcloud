# RADCloud — single service: Vite SPA baked into FastAPI static + uvicorn
# Prefer this on Railway when Nixpacks Python lacks pip on PATH.

FROM node:20-bookworm-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim-bookworm
WORKDIR /app

# faiss-cpu / numpy wheels are usually manylinux; add build tools only if pip fails
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    build-essential \
  && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir --upgrade pip \
  && pip install --no-cache-dir -r /app/backend/requirements.txt

COPY backend /app/backend
COPY data /app/data
COPY --from=frontend /app/frontend/dist /app/frontend-dist
RUN rm -rf /app/backend/static \
  && mkdir -p /app/backend/static \
  && cp -r /app/frontend-dist/. /app/backend/static/

ENV PYTHONUNBUFFERED=1
WORKDIR /app/backend
EXPOSE 8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
