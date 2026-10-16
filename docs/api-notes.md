# API notes (to integrate locally later)

Things found while building the cart and the home mic. Nothing here blocks the web features; each item
needs a run against the real API (Supabase, Stripe, ElevenLabs keys in `api/.env`).

## To check on a machine with real keys

- **Home mic, success path** (`feat/home-mic`): record, send, the words must land in `/chat?q=...`.
  Only the error path was tested (the sandbox has no `ELEVENLABS_API_KEY`, so `/api/voice/transcribe`
  answered 503).
- **Cart in the DB** (`feat/cart-db`, not merged): tested on SQLite only. Start the API once against
  Supabase; `init_db()` creates `cart_item` (and turns RLS on) by itself, no SQL by hand. Then check
  that the table exists and that a paid order removes its product from the cart (tested by calling
  `_mark_paid` directly, not through Stripe).
- **Cart before merge:** the cart belongs to `u_demo`, so every browser sees the same cart until auth
  exists. Fine for a single demo, not for several people at once.
- `feat/cart-db` touches `api/` and `models.py` (anupat2046): get a review and announce the schema
  change in the team chat before merging.

## Still demo in the API

1. No auth: the web sends the Supabase token, the API never checks it.
2. One user: the web hardcodes `DEMO_USER_ID` (`u_demo`) for orders, account and cart.
3. `PATCH /api/users/{id}` does not exist, but the web calls it (account page, first-checkout address
   form). Works today only because `u_demo` already has an address.
4. `POST /orders/{id}/status` (ship, deliver) is open to anyone and the tracking number is random.
5. Stripe customer email is `{user_id}@example.com`.
6. Rate limits live in process memory (breaks with more than one instance).
7. All data comes from `api/seed/data.json` (7 shops, 41 products, 1 user).
8. `models.py` header says Kiratikorn owns it, `AGENTS.md` says anupat2046. Agree on one.
