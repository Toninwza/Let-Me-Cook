"""Shopping agent. One turn = Gemini reads the request, the catalog searches, Gemini ranks.

Events follow docs/contract.md "Chat events". Messages starting with "/" replay a fixture turn
(`/clarify`, `/no_results`, `/pick`, `/error`) so the web can be tested without a Gemini key.
The bot replies in the language of the user's latest message (Thai or English), see app.i18n.
"""

import asyncio
import json
import re
from collections.abc import AsyncIterator
from datetime import date
from pathlib import Path
from typing import Literal

from pydantic import Field

from app import catalog
from app.ai.llm import LLMOutput, generate
from app.i18n import NAME, VOICE, Lang, detect, short_date, t
from app.schemas import HistoryMessage, OrderBrief, ProductHit, ProductOption, SearchResult, UserProfile

_FIXTURE = Path(__file__).parent / "fixtures" / "chat_stream.json"
_TURNS: dict = json.loads(_FIXTURE.read_text(encoding="utf-8"))["turns"]
_REPLAY_DELAY = {"agent_step": 0.45, "message_delta": 0.12, "options": 0.3, "clarify": 0.3}

_WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
_HISTORY_TURNS = 12
_CANDIDATES = 10
_MAX_OPTIONS = 3
_ORDERS_SHOWN = 10
_MAX_ALL = 12  # "see everything": more cards, reasons built from real numbers instead of the model
_ALL_CANDIDATES = 60


# ---------- what Gemini returns ----------


class Plan(LLMOutput):
    action: Literal["search", "clarify", "checkout", "answer", "order_status"] = Field(
        description="search: find products. clarify: request too vague to search well. "
        "checkout: user picks a product shown before. answer: reply without searching "
        "(greeting, comparing products already shown, question about them). "
        "order_status: question about the user's own orders (status, delivery date, tracking)."
    )
    summary: str = Field(
        description="In the reply language, under 80 chars: what the user wants, e.g. "
        "'เก้าอี้ ergonomic, งบไม่เกิน 3,000 บาท' or 'Ergonomic chair under 3,000 baht'. "
        "A status line: no ครับ / ค่ะ."
    )
    keywords: list[str] = Field(
        default_factory=list,
        description="Short search words, Thai and English synonyms, 1 to 3 words each. "
        "Product type first. Never the whole sentence.",
    )
    category: str | None = Field(default=None, description="Exactly one of the given categories, or null")
    min_price: float | None = None
    max_price: float | None = Field(default=None, description="Budget per unit in baht")
    deliver_by: str | None = Field(default=None, description="YYYY-MM-DD latest delivery date, or null")
    scope: Literal["best", "all", "more"] = Field(
        default="best",
        description="For search. all: the user wants to see everything / every option ('ขอดูหมด', "
        "'ทั้งหมด', 'ทุกตัว', 'show me everything', 'all of them'). more: other options than those "
        "already shown ('มีตัวอื่นไหม', 'ขอดูเพิ่ม', 'any others?', 'show me more'). best: anything else.",
    )
    product_id: str | None = Field(default=None, description="For checkout: id from the products shown last turn")
    quantity: int = 1
    payment_method: Literal["promptpay", "card"] | None = Field(
        default=None,
        description="For checkout: how the user said they will pay. promptpay: 'พร้อมเพย์', 'สแกนจ่าย', "
        "'QR', 'โอน', 'PromptPay'. card: 'บัตร', 'บัตรเครดิต', 'เดบิต', 'card', 'Visa', 'Mastercard'. "
        "null when not said.",
    )
    question: str | None = Field(default=None, description="For clarify: one short question, in the reply language")
    choices: list[str] = Field(
        default_factory=list, description="For clarify: 2 to 4 short quick replies, in the reply language"
    )
    reply: str | None = Field(
        default=None, description="For answer and order_status: 1 to 3 sentences, in the reply language"
    )


class Pick(LLMOutput):
    product_id: str
    reason: str = Field(description="In the reply language, 1 or 2 short sentences with real numbers from the data")


class Ranking(LLMOutput):
    message: str = Field(
        description="In the reply language, 1 or 2 sentences introducing the picks, or explaining none fit"
    )
    picks: list[Pick] = Field(default_factory=list, description="Best first, at most 3, only ids from the candidates")
    no_result_reason: str | None = Field(
        default=None, description="In the reply language, why nothing fits. Required when picks is empty"
    )
    alternatives: list[str] = Field(
        default_factory=list,
        description="When picks is empty: 1 to 3 suggestions in the reply language the user can tap to search again",
    )


class Broaden(LLMOutput):
    keywords: list[str] = Field(
        default_factory=list,
        description="Wider search words: the generic product type, synonyms, related product types, Thai and English",
    )
    query: str | None = Field(default=None, description="The need restated in plain words for a meaning-based search")


# ---------- prompts ----------

_BROADEN_SYSTEM = """A product search in a Thai shop found nothing. Suggest wider search words that
could still satisfy the need: the generic product type, synonyms, and closely related product types
from the categories we sell. Do not drop the user's actual need (a user asking for shoes must not
get chairs). If no category we sell could fit, return the generic product type only. JSON only.
"""

_PLAN_SYSTEM = """You are the request reader of a shopping chat bot for a Thai platform. Users
write in Thai or English. Read the user's latest message with the chat so far and decide one
action. Reply in JSON only.

- Prefer "search" whenever the product type is clear, even without a budget.
- Use "clarify" only when the product type is missing or so broad that results would be random
  (e.g. "อยากได้หูฟังใหม่" or "I want new headphones" with no use case). Never clarify twice in a
  row; search instead.
- A described problem is a clear request: "ปวดคอเวลาดูจอโน้ตบุ๊ค", "my wrist hurts from typing",
  "แสงจอแยงตา" -> "search" for products that solve it (keywords for those product types).
- Paying: "เอาตัวแรก จ่ายด้วยบัตร", "ตัวที่สองสแกนจ่าย", "take the first one, pay by card" ->
  "checkout" with payment_method set. "จ่ายด้วยบัตรแทน" or "pay with PromptPay instead" right after a
  checkout -> "checkout" again for the same product (the bot named it in its last message) with the
  new payment_method. We only take PromptPay and cards: asking to pay with crypto, cash on delivery
  or another payment method -> "answer" saying so. This rule is only about how to pay.
- Any request for a product is "search", even one we seem not to sell ("เครื่องซักผ้า", "a washing
  machine"): never answer from the category list, the search checks the real catalog.
- "เอาตัวแรก", "เอาอันที่สอง", "สั่งเลย", "I'll take the second one" -> "checkout" with the
  matching product_id from the products shown last turn (numbered 1, 2, 3 and so on). Quantity
  from the message, default 1.
- Comparing or asking about products already shown -> "answer", using their data.
- Asking about their own orders ("สถานะออเดอร์เป็นไงบ้าง", "ของถึงเมื่อไหร่", "เลขพัสดุอะไร",
  "where is my order?", "when does it arrive?") -> "order_status". The reply answers right away
  from "your orders" (newest first): what it is, its status, the delivery date, and the tracking
  number when there is one. Never ask whether they want to know the status: they just asked. With
  several orders, cover the newest few. With no orders, say there are none yet and offer to help
  find a product. A "yes" after the bot asked about orders also means "order_status".
- Resolve relative dates ("พรุ่งนี้", "by Sunday", "this week") from today's date.
- "งบ 3000" or "under 3000" means max_price 3000. Prices are in baht.
- Keywords are matched as substrings of Thai product titles and a product needs only one match,
  so search wide: always include the generic product type in Thai and English, then the specific
  words. E.g. "iPad Pro" -> ["ipad", "แท็บเล็ต", "tablet", "pro"]; "ergonomic office chair" ->
  ["เก้าอี้", "chair", "ergonomic"]. Never a whole sentence. Color or style words go in keywords.
- Set category only when it is clearly one of the given categories.
- "ขอดูหมด", "show me everything" -> "search" with scope "all". With no product type named (e.g.
  after "มีอะไรให้ซื้อบ้าง" / "what do you sell?"), leave keywords empty to list everything.
  "มีตัวอื่นไหม", "any others?" -> "search" with scope "more" and the same keywords as before.
- "มีอะไรให้ซื้อบ้าง" / "what do you sell?" alone -> "clarify", with the categories we sell as
  choices (at most 4, in the reply language).
- Write summary, question, choices and reply in {language} only, as a {voice}
  (the summary is a status line: no polite particle). Product titles stay as they are, even when
  they are Thai and the reply is English.
"""

_RANK_SYSTEM = """You pick products for a shopping chat bot on a Thai platform. You get the user's
request, their profile (U-Tag) and candidate products that already passed stock, budget and
delivery filters. Reply in JSON only.

- Pick at most 3 candidates that truly fit the request, best first. Fewer is fine. Never invent ids.
- When the user names a product type, only that type fits. An accessory or a different product
  (a stylus for "iPad", a case for "laptop") is not a pick; mention it in alternatives instead.
- Each reason is 1 or 2 short sentences, concrete: rating and review count, price after discount,
  delivery day, or a match with the user's interests. No generic praise.
- If nothing fits, return no picks, a no_result_reason and 1 to 3 alternatives the user can tap.
  Base the reason only on the search facts given (no match, out of stock, over budget, late
  delivery). Never claim something the facts do not show, such as "sold out" when nothing matched.
- message: 1 or 2 sentences. No greeting, do not use the user's name, no emoji. Middle of a chat.
- Write message, every reason, no_result_reason and alternatives in {language} only, as a {voice}.
  The product data below is partly Thai; that does not change the reply language. Product titles
  may be quoted as they are.
"""


def _fmt_product(n: int, p: ProductHit) -> str:
    sale = f" ({p.discount_percent}% off {p.original_price:,.0f})" if p.discount_percent else ""
    return (
        f"{n}. id={p.product_id} | {p.title} | category {p.category} | {p.price:,.2f} baht{sale} | "
        f"rating {p.rating} from {p.review_count} reviews | stock {p.stock} | arrives {p.delivery_date.isoformat()} | "
        f"shop {p.shop.name} (shop rating {p.shop.rating}) | tags: {', '.join(p.tags)} | {p.description}"
    )


def _fmt_profile(user: UserProfile) -> str:
    bought = ", ".join(f"{h.title} ({h.category})" for h in user.purchase_history[:5]) or "-"
    return (
        f"name: {user.display_name}; delivers to: {user.address.district} {user.address.province}; "
        f"interests: {', '.join(user.interests) or '-'}; bought before: {bought}; "
        f"U-Tag discount at checkout: {user.discount_percent}%"
    )


_STATUS_MEANING = {
    "pending_confirm": "not confirmed yet",
    "awaiting_payment": "waiting for payment",
    "payment_failed": "payment failed, can pay again",
    "paid": "paid, the shop is preparing it",
    "shipped": "shipped, on the way",
    "delivered": "delivered",
    "cancelled": "cancelled",
}


def _fmt_orders(orders: list[OrderBrief]) -> str:
    lines = [
        f"- {o.title} | {_STATUS_MEANING[o.status]} | arrives {o.delivery_date.isoformat()} | "
        f"tracking {o.tracking_number or '-'} | shop {o.shop_name} | total {_baht(o.total)} baht | "
        f"ordered {o.created_at.date().isoformat()}"
        for o in orders[:_ORDERS_SHOWN]
    ]
    return "\n".join(lines) or "(no orders yet)"


def _orders_text(orders: list[OrderBrief], lang: Lang) -> str:
    """Plain answer from the data, used when the model returns order_status without a reply."""
    if not orders:
        return t(lang, "no_orders")
    lines = []
    for o in orders[:3]:
        status = t(lang, f"status_{o.status}")
        line = t(lang, "order_line", title=o.title, status=status, date=short_date(o.delivery_date, lang))
        if o.tracking_number:
            line += t(lang, "tracking", number=o.tracking_number)
        lines.append(line)
    return "\n".join(lines)


def _fmt_history(history: list[HistoryMessage]) -> str:
    lines = [f"{m.role}: {m.text}" for m in history[-_HISTORY_TURNS:]]
    return "\n".join(lines) or "(first message)"


def _baht(value: float) -> str:
    return f"{value:,.0f}"


def _parse_date(value: str | None) -> date | None:
    try:
        return date.fromisoformat(value) if value else None
    except ValueError:
        return None


def _step(step_id: str, label: str, status: str = "running", detail: str | None = None) -> dict:
    return {"type": "agent_step", "step_id": step_id, "label": label, "status": status, "detail": detail}


def _chunks(text: str) -> list[str]:
    # Split after sentence ends so the web shows the reply arriving in pieces.
    parts = re.split(r"(?<=ครับ)\s*|(?<=[.!?])\s+", text.strip())
    return [p + " " for p in parts if p]


def _fact_reason(p: ProductHit, lang: Lang) -> str:
    price = (
        t(lang, "fact_discount", pct=p.discount_percent, price=_baht(p.price))
        if p.discount_percent
        else t(lang, "fact_price", price=_baht(p.price))
    )
    return t(
        lang, "fact", rating=p.rating, reviews=f"{p.review_count:,}", price=price,
        date=short_date(p.delivery_date, lang), shop=p.shop.name,
    )


def _mix_categories(items: list[ProductHit]) -> list[ProductHit]:
    """Round-robin across categories, so 'show me everything' is not 12 chairs."""
    groups: dict[str, list[ProductHit]] = {}
    for p in items:
        groups.setdefault(p.category, []).append(p)
    mixed: list[ProductHit] = []
    while any(groups.values()):
        for bucket in groups.values():
            if bucket:
                mixed.append(bucket.pop(0))
    return mixed


def _reply_language(text: str, history: list[HistoryMessage]) -> Lang:
    """The latest message decides; a message with no letters keeps the previous user language."""
    previous: Lang = "th"
    for message in reversed(history):
        if message.role == "user":
            previous = detect(message.text)
            break
    return detect(text, fallback=previous)


async def _last_options(history: list[HistoryMessage]) -> list[ProductHit]:
    for message in reversed(history):
        if message.role == "bot" and message.option_ids:
            hits = await asyncio.gather(*(catalog.get_product(pid) for pid in message.option_ids))
            return [h for h in hits if h is not None]
    return []


# ---------- the turn ----------


async def _replay(name: str) -> AsyncIterator[dict]:
    for event in _TURNS[name]["events"]:
        await asyncio.sleep(_REPLAY_DELAY.get(event["type"], 0))
        yield dict(event)


async def run_agent(
    session_id: str,
    text: str,
    user_profile: UserProfile,
    history: list[HistoryMessage],
    today: date,
    orders: list[OrderBrief] | None = None,
) -> AsyncIterator[dict]:
    replay = text[1:].split(maxsplit=1)[0] if text.startswith("/") and len(text) > 1 else ""
    if replay in _TURNS:
        async for event in _replay(replay):
            yield event
        return

    lang = _reply_language(text, history)
    # Said in the system prompt and again last in the user prompt: the Thai catalog data otherwise
    # pulls English replies into Thai (seen in evals).
    reply_in = f"reply language: {NAME[lang]}"
    write_in = f"\n\nWrite every text field in {NAME[lang]} only."
    plan_system = _PLAN_SYSTEM.format(voice=VOICE[lang], language=NAME[lang])
    rank_system = _RANK_SYSTEM.format(voice=VOICE[lang], language=NAME[lang])

    step_id, label = "parse", t(lang, "parse")
    try:
        yield _step(step_id, label)
        categories, shown = await asyncio.gather(catalog.list_categories(), _last_options(history))
        plan = await generate(
            plan_system,
            f"{reply_in}\ntoday: {today.isoformat()} ({_WEEKDAYS[today.weekday()]})\n"
            f"categories: {json.dumps(categories, ensure_ascii=False)}\n"
            f"user profile: {_fmt_profile(user_profile)}\n"
            f"your orders (newest first):\n{_fmt_orders(orders or [])}\n"
            f"products shown last turn:\n"
            + ("\n".join(_fmt_product(i + 1, p) for i, p in enumerate(shown)) or "(none)")
            + f"\n\nchat so far:\n{_fmt_history(history)}\n\nlatest user message: {text}"
            + write_in,
            Plan,
        )
        yield _step(step_id, label, "done", plan.summary)

        if plan.action == "clarify" and plan.question:
            yield {"type": "clarify", "question": plan.question, "choices": plan.choices[:4]}
            return

        if plan.action == "order_status":
            for chunk in _chunks(plan.reply or _orders_text(orders or [], lang)):
                yield {"type": "message_delta", "text": chunk}
            return

        if plan.action == "answer" and plan.reply:
            for chunk in _chunks(plan.reply):
                yield {"type": "message_delta", "text": chunk}
            return

        if plan.action == "checkout":
            step_id, label = "resolve", t(lang, "resolve")
            yield _step(step_id, label)
            chosen = next((p for p in shown if p.product_id == plan.product_id), None)
            if chosen is None:
                yield _step(step_id, label, "error", t(lang, "resolve_failed"))
                yield {"type": "message_delta", "text": t(lang, "which_one")}
                return
            yield _step(step_id, label, "done", chosen.title)
            pay = t(lang, f"pay_{plan.payment_method}") if plan.payment_method else ""
            # Name the product so the next turn ("pay by card instead") can find it in the history.
            message = t(
                lang, "checkout", pay=pay, title=chosen.title,
                next=t(lang, "next_pay" if plan.payment_method else "next_review"),
            )
            yield {"type": "message_delta", "text": message}
            yield {
                "type": "checkout_request",
                "product_id": chosen.product_id,
                "quantity": max(1, min(plan.quantity, chosen.stock or 1)),
                "payment_method": plan.payment_method,
            }
            return

        # search (also the fallback when clarify/answer came back without text)
        step_id, label = "profile", t(lang, "profile")
        yield _step(step_id, label)
        yield _step(step_id, label, "done", f"{user_profile.address.district} {user_profile.address.province}")

        step_id, label = "search", t(lang, "search")
        yield _step(step_id, label)
        category = plan.category if plan.category in categories else None
        deliver_by = _parse_date(plan.deliver_by)
        seen = {pid for m in history if m.role == "bot" for pid in m.option_ids}
        wanted = {"all": _ALL_CANDIDATES, "more": _CANDIDATES + len(seen)}.get(plan.scope, _CANDIDATES)
        filters = dict(min_price=plan.min_price, max_price=plan.max_price, deliver_by=deliver_by, limit=wanted)
        browse_everything = plan.scope == "all" and not plan.keywords and category is None
        result: SearchResult = await catalog.search_products(
            plan.keywords,
            category=category,
            # Listing everything: a meaning-based query would narrow the list instead.
            query=None if browse_everything else plan.summary,
            **filters,
        )
        yield _step(step_id, label, "done", t(lang, "found", n=result.matched))

        if result.matched == 0:
            # Nothing matched at all (not even before budget/stock filters): try once with wider words.
            step_id, label = "retry", t(lang, "retry")
            yield _step(step_id, label)
            try:
                wider = await generate(
                    _BROADEN_SYSTEM,
                    f"request: {text}\nunderstood as: {plan.summary}\nkeywords that found nothing: "
                    f"{json.dumps(plan.keywords, ensure_ascii=False)}\n"
                    f"categories we sell: {json.dumps(categories, ensure_ascii=False)}",
                    Broaden,
                )
            except Exception:
                # The retry is a bonus: on failure, answer with the first (empty) search.
                yield _step(step_id, label, "error", t(lang, "retry_failed"))
            else:
                result = await catalog.search_products(wider.keywords, query=wider.query or plan.summary, **filters)
                tried = ", ".join(wider.keywords[:4]) or t(lang, "retry_words")
                yield _step(step_id, label, "done", t(lang, "retry_done", words=tried, n=result.matched))

        late = (
            t(lang, "late_by", n=result.excluded_late_delivery, date=short_date(deliver_by, lang))
            if deliver_by
            else t(lang, "late", n=result.excluded_late_delivery)
        )
        excluded = [
            (result.excluded_out_of_stock, t(lang, "out_of_stock", n=result.excluded_out_of_stock)),
            (
                result.excluded_price,
                t(lang, "over_budget" if plan.min_price is None else "out_of_range", n=result.excluded_price),
            ),
            (result.excluded_late_delivery, late),
        ]
        if any(n for n, _ in excluded):
            step_id, label = "filter", t(lang, "filter")
            yield _step(step_id, label)
            yield _step(step_id, label, "done", ", ".join(why for n, why in excluded if n))

        if plan.scope == "more":
            result.items = [p for p in result.items if p.product_id not in seen]

        if plan.scope == "all" and result.items:
            # Many cards: order is relevance then rating (from the catalog), reasons are real numbers.
            step_id, label = "rank", t(lang, "rank_all")
            yield _step(step_id, label)
            shown_items = _mix_categories(result.items) if browse_everything else result.items
            options = [ProductOption(**p.model_dump(), reason=_fact_reason(p, lang)) for p in shown_items[:_MAX_ALL]]
            total = len(result.items)
            yield _step(step_id, label, "done", t(lang, "showing", shown=len(options), total=total))
            what = t(lang, "everything") if browse_everything else plan.summary
            more = t(lang, "all_more", shown=len(options)) if total > len(options) else ""
            yield {"type": "message_delta", "text": t(lang, "all_count", what=what, total=total) + more}
            yield {"type": "options", "items": [o.model_dump(mode="json") for o in options], "reason": None, "alternatives": []}
            return

        step_id, label = "rank", t(lang, "rank")
        yield _step(step_id, label)
        by_id = {p.product_id: p for p in result.items}
        ranking = await generate(
            rank_system,
            f"{reply_in}\ntoday: {today.isoformat()}\nrequest: {text}\nunderstood as: {plan.summary}\n"
            f"user profile: {_fmt_profile(user_profile)}\n"
            f"search facts: matched {result.matched}, out of stock {result.excluded_out_of_stock}, "
            f"outside budget {result.excluded_price}, late delivery {result.excluded_late_delivery}\n"
            f"candidates:\n" + ("\n".join(_fmt_product(i + 1, p) for i, p in enumerate(result.items)) or "(none)")
            + write_in,
            Ranking,
        )
        options: list[ProductOption] = []
        for pick in ranking.picks:
            hit = by_id.get(pick.product_id)
            if hit and all(o.product_id != hit.product_id for o in options):
                options.append(ProductOption(**hit.model_dump(), reason=pick.reason))
        options = options[:_MAX_OPTIONS]
        yield _step(step_id, label, "done", t(lang, "left", n=len(options)))

        for chunk in _chunks(ranking.message):
            yield {"type": "message_delta", "text": chunk}

        if options:
            items = [o.model_dump(mode="json") for o in options]
            yield {"type": "options", "items": items, "reason": None, "alternatives": []}
        else:
            budget = t(lang, "budget", amount=_baht(plan.max_price)) if plan.max_price else ""
            fallback = t(lang, "no_more") if plan.scope == "more" else t(lang, "no_match", what=plan.summary, budget=budget)
            yield {
                "type": "options",
                "items": [],
                "reason": ranking.no_result_reason or fallback,
                "alternatives": ranking.alternatives[:3] or [t(lang, "alt_default")],
            }
    except Exception:
        # Close the running line in the web, then let the route send `error` and `done`.
        yield _step(step_id, label, "error", t(lang, "step_failed"))
        raise
