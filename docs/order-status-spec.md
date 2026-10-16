# Spec: bot answers order status, then order calendar data

For anupat2046. Asked by Kiratikorn (web). Contract first, code after (hard rule 2).

## Problem

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

## Part 2: data for the calendar

The web calendar (`/calendar`) already works from `GET /api/orders?user_id=` and these `Order`
fields: `delivery_date`, `status`, `paid_at`, `shipped_at`, `delivered_at`, `tracking_number`.
Nothing new is needed for it to ship.

Later, announce in the team chat before touching `models.py` (the schema is frozen):

| Add | Why |
|---|---|
| `order_event` (order_id, type, at, note) | full timeline per order instead of three timestamps |
| `reminder` (user_id, order_id, remind_at, sent) | "arrives tomorrow", "pay within 15 minutes" |
| `eta_updated_at` on `Order` | new delivery date when a shop ships late |

`create_all` does not add columns, so drop and recreate the table in Supabase after the change.
