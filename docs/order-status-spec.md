# Backend to-do from the web

For anupat2046. Asked by Kiratikorn (web). Only what the demo needs now. Contract first, code after
(hard rule 2), and `docs/contract.md` and the fixture change in the same commit as the code.

## 1. Restart the API once

Supabase has no `cart_item` table yet and will not have `order_item` either. `create_all` makes
missing tables on start, so restart or deploy the API. Nothing to run by hand.

## 2. Save the profile the user types (`PATCH /api/users/{id}`)

The web (account page, /welcome after sign-up, nickname in the sidebar) calls
`PATCH /api/users/{id}` and the API does not have it, so what the user types is not saved.

- Body: any of `display_name`, `full_name`, `phone`, `address` (`{line, district, province, postcode}`).
  Returns the full `UserProfile`.
- Add `full_name` and `phone` (optional strings) to `app_user` and to `UserProfile`.
  `create_all` does not add columns: `ALTER TABLE app_user ADD COLUMN ...` by hand or drop and
  recreate the table. Announce in the team chat first (schema is frozen).

## 3. The bot loops on "สถานะออเดอร์"

Ask the bot "สถานะออเดอร์เป็นไงบ้าง": it asks "ต้องการสอบถามสถานะใช่ไหม", and after "ใช่" it asks the
same again, forever. Cause: `run_agent` (`api/app/ai/agent.py`) never receives the user's orders,
so the model has no data to answer with.

1. Routes load the user's orders and pass them to `run_agent` as a new typed argument from
   `app/schemas.py` (`order_id`, `title`, `status`, `delivery_date`, `tracking_number`). The AI
   module still does not open DB sessions (rule 4).
2. `Plan.action` gets `order_status`. Put the orders in the plan prompt with the rule: asked about
   status, delivery time or tracking, answer from that data in one go, never ask back. No orders:
   say so.
3. Answer as `message_delta` text. No new event.
4. Add 2 cases to `api/evals/cases.json`: status with orders, status with no orders.
