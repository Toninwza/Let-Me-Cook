# Let-Me-Cook: team rules for humans and AI tools

Read this file before writing any code. `CLAUDE.md` points here. `web/AGENTS.md` adds Next.js specific rules.

## What we are building

An AI shopping agent in a chat. The user states a need once, the bot searches shops on our own
platform, picks 3 products with reasons, and closes the sale in the chat (PromptPay QR, slip check).
Spec: `docs/contract.md`. Example stream: `api/app/ai/fixtures/chat_stream.json`.

## Words used in the product

| Word | Meaning |
|---|---|
| bot | our chat bot. Never call it "UBot" |
| U-Tag | the user profile: address, purchase history, discount |
| U-Pay | our checkout screen |
| U-Bot | the organizer's product. Not integrated yet, do not use the name for our bot |

## Who owns what

| Path | Owner | Notes |
|---|---|---|
| `web/` | Kiratikorn | Next.js App Router |
| `api/app/` except `ai/` | Kiratikorn | routes, SSE, DB, catalog, checkout, deploy |
| `api/app/models.py` | Kiratikorn only | the DB schema, see "Schema" below |
| `api/app/ai/` | AI teammate | pure Python, never imports FastAPI or touches HTTP |
| `api/seed/`, `docs/` test sets, pitch | third teammate | |

Do not edit files you do not own. If you need a change there, ask the owner.

## Hard rules

1. **No fake screens.** Every screen must run on real data and real logic. If a feature is not done,
   leave it out of the UI and tell it as roadmap. Mock data is allowed only inside `ai/` stubs and
   fixtures, never in what the demo shows.
2. **The contract is the source of truth.** Event and field names come from `docs/contract.md`.
   Change the contract first (and `api/app/ai/fixtures/chat_stream.json` in the same commit), then
   the code.
3. **Every chat stream ends with exactly one `done` event**, also after an `error`.
4. **The AI module only talks to the rest of the app through** `app.catalog` (product data) and
   `app.schemas` (types). It does not open DB sessions, read env files for DB, or call our HTTP API.
5. **Routes never import from inside `app/ai/`** except the three public functions:
   `run_agent`, `transcribe`, `verify_slip`.
6. **The browser only calls `/api/*`.** It never talks to Supabase directly (RLS is on and has no
   policies, so the anon key is blocked on purpose).
7. **Secrets:** this repo is public. Keys go in `api/.env` (git ignored). Never commit real keys or
   real PromptPay IDs of people outside the team.
8. Docs and UI copy: no em dash characters.

## Schema

- Only Kiratikorn edits `api/app/models.py`.
- Tables are created on API startup with `create_all`, which only creates missing tables. It does
  **not** add new columns to an existing table. After changing a model, drop and recreate the
  table in Supabase (fine while there is no real data) or run an `ALTER TABLE` by hand.
- The schema is frozen before the seed data goes in. Announce in the team chat before any change.

## Run locally

```bash
cd api && uv run uvicorn app.main:app --reload --port 8000
cd api && uv run python -m app.seed      # load api/seed/data.json (idempotent)
cd web && npm run dev                    # http://localhost:3000
```

Without `DATABASE_URL` the API uses a local SQLite file, so you do not need Supabase to work.

## Testing the AI module without the web

```bash
cd api && uv run python -m app.ai.try "หาเก้าอี้ทำงาน งบ 3000"
```

Prints every event `run_agent` yields. Use it to check your output against the contract.
The stub plays `/clarify`, `/no_results`, `/pick`, `/error` turns from the fixture. In Git Bash
prefix the command with `MSYS_NO_PATHCONV=1`, or Git Bash rewrites `/clarify` into a Windows path.

## Git

- `main` must always run. Work on your own branch, merge when it runs.
- Commit messages: `feat: ...`, `fix: ...`, `docs: ...`.
