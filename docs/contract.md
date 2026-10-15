# Contract

Source of truth for every boundary between `web/`, `api/` and `api/app/ai/`.
Change this file first (and `api/app/ai/fixtures/chat_stream.json` in the same commit), then the code.
The fixture lives inside the api package so the stub agent also works in the deployed image.

Status tags: **[P0]** built tonight, **[P2]** checkout (by 02:00), **[P3]** Friday morning.

## Conventions

- Money: THB as a JSON number, at most 2 decimals. `price` is what the user pays per unit after the
  product discount.
- Dates: `YYYY-MM-DD`. Timestamps: ISO 8601 UTC.
- IDs are strings with a prefix: `u_` user, `s_` session, `shop_` shop, `p_` product, `o_` order.
- JSON keys are `snake_case` everywhere, including the web.
- Python types live in `api/app/schemas.py` (pydantic). The tables below mirror them.

## Types

### UserProfile (U-Tag)

| field | type | notes |
|---|---|---|
| `user_id` | str | |
| `display_name` | str | |
| `address` | Address | default delivery address |
| `interests` | list[str] | free tags, e.g. `["work from home", "minimal"]` |
| `purchase_history` | list[PastPurchase] | newest first |
| `discount_percent` | int | U-Tag discount applied at checkout, 0 to 100 |

`Address`: `{ "line": str, "district": str, "province": str, "postcode": str }`

`PastPurchase`: `{ "product_id": str, "title": str, "category": str, "price": number, "purchased_at": str }`

### ShopInfo

| field | type | notes |
|---|---|---|
| `shop_id` | str | |
| `name` | str | |
| `rating` | number | 0 to 5 |
| `ship_days` | int | days from order to delivery |

The shop's PromptPay ID is never sent to the agent or the chat. Only checkout uses it.

### ProductHit (what `catalog` returns)

| field | type | notes |
|---|---|---|
| `product_id` | str | |
| `title` | str | |
| `description` | str | |
| `category` | str | |
| `tags` | list[str] | |
| `image_url` | str or null | |
| `price` | number | after product discount |
| `original_price` | number | before discount |
| `discount_percent` | int | 0 when none |
| `rating` | number | 0 to 5 |
| `review_count` | int | |
| `stock` | int | |
| `delivery_date` | str | today + `shop.ship_days` |
| `shop` | ShopInfo | |

### ProductOption (one card in the chat)

`ProductHit` plus:

| field | type | notes |
|---|---|---|
| `reason` | str | why the bot picked it, 1 or 2 short sentences, Thai |

### SearchResult

| field | type | notes |
|---|---|---|
| `items` | list[ProductHit] | ranked, at most `limit` |
| `matched` | int | products matching the keywords before filters |
| `excluded_out_of_stock` | int | |
| `excluded_price` | int | outside `min_price` / `max_price` |
| `excluded_late_delivery` | int | delivers after `deliver_by` |

Each excluded product is counted once, in the first reason that applies, in the order above.
These numbers exist so `agent_step` labels can state real facts ("ตัดสินค้าที่หมดสต็อกออก 3 รายการ").

### HistoryMessage

| field | type | notes |
|---|---|---|
| `role` | `"user"` or `"bot"` | |
| `text` | str | for a bot turn: all `message_delta` text joined, plus the `clarify` question |
| `option_ids` | list[str] | product ids shown as cards in that bot turn, in order. Empty otherwise |
| `created_at` | str | |

`option_ids` is how the agent resolves "เอาตัวแรก" or "ตัวแรกกับตัวที่สอง อันไหนดีกว่า".

### SlipCheck

`{ "ok": bool, "amount": number or null, "reason": str }`. `reason` is Thai and shown to the user
when `ok` is false.

### Order [P2]

| field | type | notes |
|---|---|---|
| `order_id` | str | |
| `session_id` | str or null | |
| `user_id` | str | |
| `product_id` | str | |
| `title` | str | snapshot at order time |
| `shop` | ShopInfo | |
| `quantity` | int | |
| `unit_price` | number | `ProductHit.price` at order time |
| `subtotal` | number | `unit_price * quantity` |
| `utag_discount_percent` | int | |
| `utag_discount` | number | `round(subtotal * percent / 100, 2)` |
| `total` | number | `subtotal - utag_discount` |
| `delivery_date` | str | |
| `address` | Address | |
| `payment_method` | `"promptpay"` or `"avax_escrow"` | `avax_escrow` is [P3], returns 400 until built |
| `status` | see below | |
| `promptpay_payload` | str or null | EMVCo string, the web renders it as a QR. Set after confirm |
| `slip_check` | SlipCheck or null | result of the last slip upload |
| `created_at` | str | |
| `paid_at` | str or null | |

Status flow:

```
pending_confirm --confirm--> awaiting_payment --slip ok--> paid
                                   ^    |
                                   |    slip not ok
                                   +-- slip_rejected (upload again)
pending_confirm / awaiting_payment --cancel--> cancelled
```

## AI module interface (Python, `app.ai`)

The AI module is pure Python. It never touches HTTP or the DB directly.

```python
async def run_agent(
    session_id: str,
    text: str,
    user_profile: UserProfile,
    history: list[HistoryMessage],   # oldest first, excludes the current `text`
) -> AsyncIterator[dict]: ...

async def transcribe(audio_bytes: bytes, mime_type: str) -> str: ...          # ElevenLabs Scribe [P3]

async def verify_slip(
    image_bytes: bytes,
    expected_amount: float,
    receiver: Receiver,              # { "name": str, "promptpay_id": str }
) -> SlipCheck: ...                  # [P2]
```

`run_agent` yields event dicts exactly as in "Chat events" below. It may end with `done` itself; if
it does not, the route adds one. If it raises, the route sends `error` then `done`.

`verify_slip` only checks what is on the slip image (amount, receiver). It does not confirm the
transfer with a bank. In the UI and pitch call it "AI ตรวจสลิป", never "ยืนยันการโอนแล้ว".

## Catalog interface (Python, `app.catalog`)

The only way the AI module reads product data. All functions are async.

```python
async def search_products(
    keywords: list[str],             # extracted by the agent, Thai or English. Empty = everything
    *,
    category: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    deliver_by: date | None = None,
    in_stock_only: bool = True,
    limit: int = 10,
) -> SearchResult: ...

async def get_product(product_id: str) -> ProductHit | None: ...

async def list_categories() -> list[str]: ...
```

Matching: a product matches when any keyword is a case-insensitive substring of its title,
description, category or tags. Thai has no spaces, so pass short keywords (`["เก้าอี้", "ergonomic"]`),
not the whole sentence. Ranking: number of keywords matched, then rating, then review count.

## Chat events (SSE) [P0]

`POST /api/sessions/{session_id}/messages` answers with `text/event-stream`. Each event is:

```
event: <type>
data: <the event dict as JSON, including "type">

```

| type | fields | used in demo step |
|---|---|---|
| `agent_step` | `step_id`: str, `label`: str (Thai), `status`: `"running"` / `"done"` / `"error"`, `detail`: str or null | 3, must not break |
| `message_delta` | `text`: str | bot text, appended in order |
| `clarify` | `question`: str, `choices`: list[str] (0 to 4 quick replies) | 2 (vague request) |
| `options` | `items`: list[ProductOption] (0 to 3), `reason`: str or null, `alternatives`: list[str] | 4, must not break |
| `checkout_request` | `product_id`: str, `quantity`: int | user typed "เอาตัวแรก": web opens U-Pay |
| `error` | `code`: `"agent_failed"` / `"timeout"` / `"bad_input"` / `"internal"`, `message`: str (Thai, shown to user) | any |
| `done` | nothing | ends every stream |

Rules:

1. `agent_step`: send `running` when the work starts and `done` (or `error`) with the same `step_id`
   when it ends. The web updates that line in place. Labels describe work that really happened,
   with real numbers from `SearchResult` where possible.
2. `options` with 0 items **must** have `reason` (why nothing fits) and at least one entry in
   `alternatives` (Thai suggestions the user can tap, sent back as the next message).
3. `options` with items: `reason` may be null; every item has its own `reason`.
4. At most one `options`, one `clarify` and one `checkout_request` per turn.
5. Exactly one `done`, always last. After `error` comes `done`.
6. The agent never sends payment or order data. Checkout is REST (below), started by the user
   tapping a card or by `checkout_request`.

## HTTP endpoints

All under `/api`. Errors use FastAPI's default `{ "detail": str }` with a 4xx/5xx code.

### [P0]

| method | path | body | response |
|---|---|---|---|
| GET | `/api/health` | | `{ "status": "ok", "db": "ok" }` |
| POST | `/api/sessions` | `{ "user_id": str or null }` | `{ "session_id": str, "user": UserProfile }`. Null user_id = the demo user `u_demo` |
| GET | `/api/sessions/{id}/messages` | | `list[HistoryMessage]` |
| POST | `/api/sessions/{id}/messages` | `{ "text": str }` (1 to 2000 chars) | SSE stream, see above |
| GET | `/api/products` | query `shop_id` optional | `list[ProductHit]` |
| GET | `/api/users/{id}` | | `UserProfile` |

### [P2] checkout (U-Pay)

| method | path | body | response |
|---|---|---|---|
| POST | `/api/orders` | `{ "session_id": str or null, "user_id": str, "product_id": str, "quantity": int, "payment_method": "promptpay" }` | `Order` with status `pending_confirm` (the summary step) |
| POST | `/api/orders/{id}/confirm` | | `Order` with status `awaiting_payment` and `promptpay_payload` |
| POST | `/api/orders/{id}/slip` | multipart `file` (image) | `Order`, status `paid` or `slip_rejected` |
| POST | `/api/orders/{id}/cancel` | | `Order` |
| GET | `/api/orders/{id}` | | `Order` |
| GET | `/api/orders` | query `shop_id` | `list[Order]`, newest first. The shop page polls this every 3 s |

### [P3]

| method | path | body | response |
|---|---|---|---|
| POST | `/api/voice/transcribe` | multipart `file` (audio) | `{ "text": str }` |
