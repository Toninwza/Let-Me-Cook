# Handoff: web (PULL) for the next Claude session

Written 2026-10-16 early morning by the previous session so a new session (cloud or local) can
continue with no gap. Read this file fully, then `AGENTS.md`, then `docs/contract.md`.
This file contains no secrets. Keys are listed by name only (section 9).

## 1. Who you are working for

- The user is **Kiratikorn** (Git user `Toninwza`), software engineer, DevOps background, vibe coder.
- He owns **`web/`**. The friend **anupat2046** owns **`api/`** (routes, DB, Gemini agent, Stripe, voice,
  `models.py`). A third teammate owns seed data and the pitch.
- Reply in **Thai**, short and direct, say problems immediately, no hedging. Docs and UI copy must
  not contain em dash characters.
- Event: U-Hackathon (Flow Summit), Track AI. Demo on stage **Friday 2026-10-16 afternoon**. Freeze
  deploys 2 hours before and prepare a backup video. Scoring: working app 40%, practicality 40%,
  usability and design 10%, partners (ElevenLabs, Avalanche, Tokenomist) 5%, U-Bot 5%.
- Product: an AI shopping agent in chat. The user states a need once, the bot searches our own shop
  platform, picks 3 products with reasons, closes the sale in chat (Stripe PromptPay QR or card).
- Brand: **PULL**, tagline "Pull and serve everything you want". The "U" in the logo is a horseshoe
  magnet. Words: "bot" (never "UBot"), "U-Tag" (user profile), "U-Pay" (checkout screen).
- Shelved to roadmap, do not build: UTOPIA wallet, on-chain voice biometrics, escrow on every payment,
  auto-refund from photo check, logistics webhooks, calendar sync, auto-replenishment.
  Avalanche escrow on Fuji testnet is an optional stretch only after the core flow is solid.

## 2. Working rules (the user's explicit preferences, follow them)

1. **Plan first, then build.** For a new chunk of work, state the plan in chat and wait for a go.
   Exploratory questions get a short recommendation, not an implementation.
2. **UI work: draft first, user approves, then commit.** Drafts live in the Claude Design canvas
   (section 8). Do not commit UI the user has not seen.
3. **Never merge or push into `main` or `masterdev` without the user's explicit yes for that action.**
   One approval does not carry over. Push work to the working branch only.
4. **No attribution lines** in commits or PRs (no `Co-Authored-By`, no "Generated with Claude Code").
   `.claude/settings.json` already sets empty attribution. Commit style: `feat:`, `fix:`, `docs:`.
5. **Do not edit `api/`** without asking (friend's files). Write the request as a message for the user
   to forward (draft in section 7).
6. No fake screens. Every screen must run on real data. Mock data is only allowed in `ai/` fixtures.
7. The browser only calls `/api/*` (Next rewrites to FastAPI). Never read Supabase tables from the
   browser (RLS is on). Supabase JS is used for **auth only**.
8. This repo is **public**. Never commit keys, real PromptPay IDs, `.env` files.
9. Next.js here is v16 with breaking changes. Read the matching guide under
   `web/node_modules/next/dist/docs/` before using Next APIs. `web/AGENTS.md` repeats this.

## 3. Branches and state

| Branch | Where | State |
|---|---|---|
| `dev/tonrak` | origin | **The working branch.** Everything in this file. Ahead of the others. |
| `masterdev` | origin | Snapshot `339bfae`: friend's backend + our first web version. Behind `dev/tonrak`. |
| `scaffold` | origin | Friend's branch. Latest `40f4d7f` (card payment). Do not push web work here. |
| `main` | origin | Reverted to the initial skeleton on purpose. Do not merge into it without approval. |

Local-only leftovers on the user's machine (ignore, not needed in cloud): branch
`archive/tonrak-api-old` (our old API, superseded by the friend's) and two stashes.

Backend = friend's `scaffold` at `40f4d7f`. If the friend pushes more, merge `origin/scaffold` into
`dev/tonrak` (take the friend's `api/` and `docs/contract.md`, keep our `web/`). `web/` conflicts
are possible: ours wins.

## 4. Stack and how to run

- `web/`: Next.js 16.4.1 App Router, React 19.3, Tailwind v4 (`@theme` in `globals.css`), TypeScript,
  `@supabase/supabase-js`. Fonts: IBM Plex Sans Thai (body), Unbounded (display).
- `api/`: FastAPI, uv, SQLModel. SQLite fallback when `DATABASE_URL` is empty.
- Dev server needs `API_URL` (default `http://localhost:8000`), rewrites `/api/*` to the API.
  SSE streams one event at a time through the rewrite (verified in dev and `next start`).

```bash
cd api && uv sync && uv run python -m app.seed          # needs no keys for SQLite
cd api && uv run uvicorn app.main:app --port 8000
cd web && npm install && npm run dev                      # http://localhost:3000
cd web && npx tsc --noEmit -p . && npx eslint app lib components   # must print nothing
```

Without `GEMINI_API_KEY` the agent replays fixtures only for `/pick`, `/clarify`, `/no_results`,
`/error` messages. A normal message needs Gemini. Without `STRIPE_SECRET_KEY` checkout returns 503.
After switching branches, **restart `npm run dev`** (stale CSS otherwise: brand colors vanish).

## 5. What is built (all in `web/`, verified in the browser, API at `40f4d7f`)

Routes: `/` landing (prompt box, magnetic-field product cards), `/home` magnet home,
`/chat` chatbot, `/login`, `/orders` my orders, `/shop/[shopId]` shop page (polls 3 s),
`/pay/done` Stripe Checkout return page. `(app)` route group wraps `/home` and `/chat` in the shell.

- **App shell** `components/app-shell.tsx`: desktop sidebar (260 px, collapses to 76 px with tooltips),
  mobile drawer opened by `MenuButton` (pages put it in their header), Esc closes. Nav has only
  "หน้าแรก" and "Chatbot" (user's choice). User card at the bottom.
- **Auth** `components/auth-provider.tsx` + `lib/supabase.ts` + `/login`: email+password sign in and
  sign up, Google button, forgot password, Thai error mapping. When `NEXT_PUBLIC_SUPABASE_*` are not
  set the page says so and "demo user" still works. **The API does not know the logged-in user yet**
  (section 7): chat and orders use the demo user `u_demo` (`DEMO_USER_ID` in `lib/api.ts`).
- **Chat** `app/(app)/chat/chat.tsx`: SSE events (agent_step, message_delta, clarify, options,
  checkout_request, error, done), steps panel (collapses to "bot ทำงาน N ขั้น"), product widget with
  cards and a compare table (`components/product-widget.tsx`), voice input and spoken replies
  (`lib/hooks.ts`: `useVoiceInput`, `useBotVoice`, from the friend, ElevenLabs), `?q=` auto-sends the
  first message (used by landing and home).
- **U-Pay** `components/upay-sheet.tsx`: summary (qty, shop discount, U-Tag line when the backend
  applies one), method choice PromptPay QR or card (Stripe Checkout in a new tab), QR step polls the
  order every 3 s, `payment_failed` has a "new QR" button, test mode link `payment_test_url`.
- **Orders** `app/orders/my-orders.tsx`: tabs by status, expandable 3-step bar, tracking number,
  customer "ฉันได้รับสินค้าแล้ว", "ซื้ออีกครั้ง". Shop page: ship / delivered buttons.
- Hover, cursor, focus ring rules are global in `globals.css`; `prefers-reduced-motion` respected.
- Product images do not exist yet (`image_url` null). `components/product-thumb.tsx` draws a tinted
  box with the category name. The friend's `Order` has no image or original price.

Known behaviors: the friend's backend applies a 5% U-Tag discount; web shows it only as one line in
the U-Pay summary (the user asked to remove the 5% badge everywhere else). Stripe minimum total is
10 baht. Stripe is in **test mode** (QR scan needs "จำลองการจ่าย" link, card test number
`4242 4242 4242 4242`).

## 6. Approved by the user, NOT built yet (do these first)

Design sources are in `docs/design/` (open the `.dc.html` for exact spacing and copy; they use the
Claude Design format with `{{holes}}`, treat them as visual specs, not code to run).

### 6a. Light theme (user said the dark green home plus dark sidebar "does not feel like a shopping app")
- Whole app on light ground: page `#F4F5F2`, cards `#FFFFFF`, borders `#E2E5E0`. Green is accent only
  (primary buttons, active nav, status chips). Saffron only for discounts and the "AI" badge.
- **Sidebar light** (`HomeLight.dc.html`): white, 1 px right border, active item = light green
  `#E3F1EA` with a solid green icon tile, user card with outline. Applies to desktop sidebar and
  mobile drawer in `components/app-shell.tsx`. Logo magnet uses real colors (saffron body, grey tips).
- **Home `/home`** (desktop `HomeLight.dc.html`, mobile `HomeLightMobile.dc.html`): greeting and
  delivery area, big prompt box (textarea, mic, "เริ่มแชท") that sends `/chat?q=...`, starter chips,
  "ดึงมาให้คุณ" with category tabs filtering real products (`listProducts`, categories from the
  data), 3-column product cards (mobile: horizontal scroll), right column "ออเดอร์ที่กำลังมา" (real
  orders, hide if none) and "แชทล่าสุด" (**only when the sessions endpoint exists**, else hide it,
  never fake data). Cards link to `/chat?q=<product title>`.
- Remove the old green `home.tsx` look. Keep `/` landing as is (it is already light).
- Tokens live in `web/app/globals.css` (`--color-basil #1E6F50`, `forest #0F3D2C`, `saffron #F2A93B`,
  `ink #17211D`, etc.). Reuse them.

### 6b. Voice recording like Messenger (`VoiceInput.dc.html`)
Current behavior: tap to start, tap again to stop and send, cap 30 s, no cancel. Replace with:
- **Tap** (press shorter than ~250 ms) = hands-free mode: bar shows trash (cancel), timer, waveform,
  big green **send button that stops, transcribes and sends in one tap**.
- **Hold** = push to talk: records while held, **release sends**, **slide left cancels**, **slide up to
  a lock icon switches to hands-free**. Use pointer events with `setPointerCapture`; show hints
  "เลื่อนซ้ายเพื่อยกเลิก". Keyboard: focus mic and press Enter = tap.
- Recording shorter than 0.6 s is discarded as an accidental press. Max 120 s, warn at 110 s, auto
  send at the limit (today `MAX_RECORD_S = 30` in `lib/hooks.ts`).
- Sent message appears immediately as a user bubble with a mic icon and "กำลังถอดเสียง 0:42", then
  the transcript replaces it. If transcription fails keep the audio blob and show "ลองส่งใหม่".
- Spoken replies stay: voice request gets a voice answer, typed request only when the speaker toggle
  is on. `useVoiceInput` in `lib/hooks.ts` needs `cancel()`, a level meter (optional) and the longer
  limit. The microphone cannot be tested in the Claude browser pane (blocked), so verify the pointer
  logic by dispatching events, then ask the user to test on a phone. Mic needs HTTPS or localhost.

## 7. Designed, waiting for the user's approval, and needs the friend

### Chat sessions sub-bar (`AppShellSessions.dc.html`, `AppShellSessionsMobile.dc.html`)
Two-level nav on desktop: the main sidebar collapses to icons on `/chat`, and a 308 px sessions
panel appears: "แชทใหม่", search, groups "วันนี้ / เมื่อวาน", each item = small picked-product
thumbnail (44 px), title (from the first user message), snippet, time, and an order chip
("ออเดอร์ · กำลังจัดส่ง", or "เลือกสินค้าแล้ว · ยังไม่ได้สั่งซื้อ"). The thread header shows a strip
with the picked product and its order. Mobile: tap the title in the header, sheet slides up.
It is meant to grow into an e-commerce simulation later (more main nav items).
**Do not build before the user approves.** It needs from the friend (`api/`, draft message):
> ขอ 1 endpoint ครับ: `GET /api/sessions?user_id=` คืนรายการ session ของ user เรียงใหม่สุดก่อน
> แต่ละรายการมี `session_id`, `title` (ข้อความแรกของ user ตัดไม่เกิน 40 ตัวอักษร), `last_message`,
> `updated_at`, `picked_product` (product_id, title, price, image_url หรือ null ถ้ายังไม่ได้เลือก,
> หาจาก option_ids ล่าสุดที่ตามด้วยคำขอซื้อ หรือจากออเดอร์) และ `order` (order_id, status, total
> หรือ null, หาจาก orders.session_id) ส่วน `GET /sessions/{id}/messages` ที่มีอยู่ใช้เปิดแชทเดิมต่อได้เลย

### Supabase auth reaching the API (friend)
> เว็บล็อกอินด้วย Supabase Auth แล้ว จะส่ง `Authorization: Bearer <access_token>` มากับทุก request
> ขอให้ API ตรวจ token (JWKS ของโปรเจกต์ หรือเรียก `/auth/v1/user`), ใช้ `sub` เป็น `app_user.id`
> สร้างแถว `app_user` ให้ตอน login ครั้งแรก (ชื่อจาก `user_metadata.name`, ที่อยู่ว่างให้กรอกทีหลัง)
> และให้ `POST /sessions`, `/orders` ใช้ user จาก token แทน `user_id` ที่ส่งมาจากหน้าเว็บ

When the friend ships it: add the header in `lib/api.ts` (`call()` and `sendMessage()`, token from
`supabase.auth.getSession()`), drop `DEMO_USER_ID`, and update `docs/contract.md` first (rule 2).

## 8. The design canvas (optional reference)

Private Claude Design artifact: https://claude.ai/artifact/NXeHTM7Xw4sWym3FcQreMY
It holds every screen (landing, home, chat, U-Pay, orders, shop, login, nav, sessions, voice, light
home). If your session cannot open it, use `docs/design/` plus section 6 and 7. To change a design,
read `project/canvas.json` first, edit only the files you change, publish to the same URL, and
never overwrite the user's own edits (re-read before publishing). The user edits boards by hand.

Palette: ink `#17211D`, basil `#1E6F50`, basil dark `#14513A`, basil soft `#E3F1EA`, forest `#0F3D2C`,
saffron `#F2A93B`, saffron soft `#FFF1D6`, ground `#F4F5F2`, line `#E2E5E0`, danger `#B42318`.
Style the user likes: floating tilted product cards, iPhone widget tiles, rounded 14 to 24 px, small
product thumbnails. Do not copy another app's layout or branding (Shopee, Fastwork were references
for feel only).

## 9. Environment and secrets (NOT in the repo)

`api/.env` and `web/.env.local` are git ignored, so a fresh clone or a cloud session has none.
The user must provide these as environment variables or local files:

| Name | Used by | Notes |
|---|---|---|
| `DATABASE_URL` | api | Supabase Session pooler string. Empty = local SQLite (fine for UI work) |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | api | model `gemini-2.5-flash` |
| `STRIPE_SECRET_KEY` | api | test key `sk_test_...` |
| `ELEVENLABS_API_KEY` | api | voice (Scribe STT, eleven_v3 TTS) |
| `WEB_URL` | api | public web URL for Stripe return, default `http://localhost:3000` |
| `API_URL` | web | build time, default `http://localhost:8000` |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | web | login. Not provided yet |

Security: the keys above were pasted into an earlier chat. **Rotate all of them after the demo**
(DB password, Gemini, Stripe, ElevenLabs). Supabase settings for login: Authentication > Providers >
Email, turn **Confirm email off** (otherwise sign up needs an inbox); Google needs an OAuth client in
Google Cloud, optional. The friend's schema added columns to `orders`; an old Supabase `orders`
table must be recreated or altered (`create_all` does not add columns).

## 10. Next steps in order

1. Build 6a (light theme: sidebar, drawer, `/home`), check desktop (1280) and mobile (375).
2. Build 6b (voice). Test pointer logic by dispatching events; ask the user to try the mic.
3. If the user approves the sessions design: build the web side behind the friend's endpoint.
4. Wire login to the API once the friend ships token support.
5. Deploy: Cloud Run for `api/` then `web/` (HTTPS needed for the mic; `API_URL` is baked in at build
   time, deploy the API first). Dockerfiles exist. Create tables and seed on Supabase first. Min
   instances 1. Not done yet.
6. Before demo: run the full flow on the real URL on a phone (landing, chat, buy, pay, ship, deliver),
   record a backup video, freeze deploys 2 hours before.

Definition of done for each UI chunk: `tsc` and `eslint` clean, tested in the browser at mobile and
desktop widths, screenshots shown to the user, **not committed until the user says so**.

## 11. Pitfalls already hit

- Dev server serves stale CSS after a branch switch: restart it.
- Tailwind v4: use `@theme` (not `@theme inline`) for custom colors that need utility classes.
- React lint rule `react-hooks/set-state-in-effect` is on: wrap first fetches in `setTimeout(fn, 0)`.
- Use `next/link` `<Link>` for internal links (lint rule `no-html-link-for-pages`).
- Git Bash rewrites `/clarify` style arguments into paths: prefix with `MSYS_NO_PATHCONV=1`.
- Windows line endings warnings from git are harmless.
- The Claude browser pane may time out on screenshots; use `read_page`, `get_page_text` or JS
  geometry checks, and resize to mobile with `resize_window` (reset to `desktop` afterwards).
- Stripe newer API rejects `payment_method_types`; the friend's code already handles it.
