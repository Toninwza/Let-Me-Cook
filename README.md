# Let-Me-Cook

U-Hackathon 2026 — Track 1 (AI).

## Structure

```
web/   Next.js 16 (App Router, TypeScript, Tailwind) — frontend
api/   FastAPI (Python 3.13, uv, SQLModel) — backend, all routes under /api
```

The browser only ever calls `/api/*` on the Next.js app. `web/next.config.ts`
rewrites those requests to the FastAPI service at `API_URL`, so there is no CORS
setup in the client and API keys stay on the server.

## Run locally

Backend (http://localhost:8000, docs at `/api/docs`):

```bash
cd api
cp .env.example .env    # optional: leave DATABASE_URL empty to use local SQLite
uv run python -m app.seed              # load api/seed/data.json (safe to rerun)
uv run uvicorn app.main:app --reload --port 8000
```

Frontend (http://localhost:3000):

```bash
cd web
npm install
npm run dev
```

Check the wiring: open http://localhost:3000/api/health — it should return
`{"status":"ok","db":"ok"}`.

## Database

- Local: SQLite file `api/dev.db`, created automatically.
- Deployed: Supabase Postgres. Use the **Session pooler** connection string
  (port 5432) as `DATABASE_URL`. Tables are created on startup (`create_all`).

## Deploy

- `api/` has a `Dockerfile` that listens on `$PORT` — works on Cloud Run or Railway.
  Set `DATABASE_URL`, `CORS_ORIGINS` and AI keys as environment variables.
- `web/`: set `API_URL` to the deployed API URL (no trailing slash).
  **It is read at build time** (rewrites are baked into the build), so deploy the
  API first, then build the web app. Changing `API_URL` later needs a rebuild.
  - Vercel: set `API_URL` in Project Settings → Environment Variables, then redeploy.
  - Docker (Cloud Run / Railway): `docker build --build-arg API_URL=https://... .`

Test the whole stack locally with Docker:

```bash
docker network create lmc-net
docker build -t letmecook-api api
docker build --build-arg API_URL=http://lmc-api:8080 -t letmecook-web web
docker run -d --name lmc-api --network lmc-net letmecook-api
docker run -d --name lmc-web --network lmc-net -p 3000:8080 letmecook-web
```
