# Backend to-do from the web

For anupat2046. Asked by Kiratikorn (web). Contract first, code after (hard rule 2).
Read this file only, it has everything. Do Part 0 first, then Part 1. Parts 2 and 3 need nothing from you.

## Part 0: the web already calls these, the API does not have them

Checked against `api/app/routers/` on `dev/tonrak`. Today the API has only `GET /api/users/{id}`,
no user update, and it never reads the `Authorization: Bearer` header the web sends.
The web (account page, /welcome after sign-up, nickname in the sidebar) hides the 404/405, so the
data the user types is silently not saved.

1. **`cart_item` table is not on Supabase yet.** The code has it (commit `9669b7a`). Restart or
   deploy the API once: `create_all` creates the missing table. Nothing to run by hand.
2. **`PATCH /api/users/{id}`**, body any of `display_name`, `full_name`, `phone`, `address`
   (`{line, district, province, postcode}`), returns the full `UserProfile`.
3. **Columns `full_name` and `phone` on `app_user`**, and the same two fields (optional strings) on
   `UserProfile` in `app/schemas.py`. `create_all` does not add columns: `ALTER TABLE` by hand or
   drop and recreate the table. Announce in the team chat first (schema is frozen).
4. **Read the Supabase JWT.** Verify `Authorization: Bearer <token>`, take `sub` as the user id, and
   create the `app_user` row on first sight. With no token keep serving the demo user (the web
   shows it as "ลูกค้า"). Without this every account shares one profile and one cart.
5. Update `docs/contract.md` for 2 to 4 in the same commit as the code.

Smaller: in Supabase `orders.checkout_session_id` has no UNIQUE but the model says unique. Harmless
now, fix it with the same `ALTER TABLE` run if you like.

## Part 1 problem: the bot loops on order status

Ask the bot "สถานะออเดอร์เป็นไงบ้าง" and it answers "คุณมิ้นท์ต้องการสอบถามสถานะคำสั่งซื้อใช่ไหมครับ".
Reply "ใช่" and it asks the same question again, forever.

Cause: `run_agent` (`api/app/ai/agent.py`) never receives the user's orders. The plan prompt only
knows search, checkout and "answer about products already shown", so the model has no data to answer
with and asks back.

## Part 1: bot reads order status (fixes the loop)

1. Routes load the user's orders and pass them into `run_agent` as a new argument, typed in
   `app/schemas.py` (for example `orders: list[OrderBrief]` with `order_id`, `title`, `status`,
   `delivery_date`, `tracking_number`, `shop_name`, `created_at`). The AI module must not open DB
   sessions (rule 4).
2. `Plan.action` gets a new value `order_status`. The plan prompt gets the orders block and the rule:
   asked about order status, delivery time or tracking -> `order_status`, answer from the data in
   one go, never ask "do you want to know the status?".
3. Answer with `message_delta` text. Optional: a new event `order_list` with the order ids so the web
   can draw the existing order cards.
4. No orders yet -> say so and offer to search products.
5. Add 3 cases to `api/evals/cases.json`: status with orders, status with no orders, "ของถึงเมื่อไหร่".
6. Update `docs/contract.md` and `api/app/ai/fixtures/chat_stream.json` in the same commit as the
   code.

## Part 2: calendar needs nothing from the backend

The web calendar (`/calendar`) already works from `GET /api/orders?user_id=` and the existing
`Order` fields. No new table or column. Reminders and an order event history are roadmap, do not
build them now.

## Part 3: one order with many products (done)

Done in `87c23dd`. Nothing left for the backend. The new `order_item` table is created by
`create_all` on the next API start.
