"""Shopping agent. One turn = Gemini reads the request, the catalog searches, Gemini ranks.

Events follow docs/contract.md "Chat events". Messages starting with "/" replay a fixture turn
(`/clarify`, `/no_results`, `/pick`, `/error`) so the web can be tested without a Gemini key.
"""

import asyncio
import json
import re
from collections.abc import AsyncIterator
from datetime import date
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field

from app import catalog
from app.ai.llm import LLMOutput, generate
from app.schemas import HistoryMessage, ProductHit, ProductOption, SearchResult, UserProfile

_FIXTURE = Path(__file__).parent / "fixtures" / "chat_stream.json"
_TURNS: dict = json.loads(_FIXTURE.read_text(encoding="utf-8"))["turns"]
_REPLAY_DELAY = {"agent_step": 0.45, "message_delta": 0.12, "options": 0.3, "clarify": 0.3}

_WEEKDAYS = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"]
_HISTORY_TURNS = 12
_CANDIDATES = 10
_MAX_OPTIONS = 3
_MAX_ALL = 12  # "ขอดูทั้งหมด": more cards, reasons built from real numbers instead of the model
_ALL_CANDIDATES = 60


# ---------- what Gemini returns ----------


class Plan(LLMOutput):
    action: Literal["search", "clarify", "checkout", "answer"] = Field(
        description="search: find products. clarify: request too vague to search well. "
        "checkout: user picks a product shown before. answer: reply without searching "
        "(greeting, comparing products already shown, question about them)."
    )
    summary: str = Field(description="Thai, under 80 chars: what the user wants, e.g. 'เก้าอี้ ergonomic, งบไม่เกิน 3,000 บาท'")
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
        "'ทั้งหมด', 'ทุกตัว', 'มีอะไรบ้าง'). more: other options than those already shown "
        "('มีตัวอื่นไหม', 'ขอดูเพิ่ม'). best: anything else.",
    )
    product_id: str | None = Field(default=None, description="For checkout: id from the products shown last turn")
    quantity: int = 1
    question: str | None = Field(default=None, description="For clarify: one short Thai question")
    choices: list[str] = Field(default_factory=list, description="For clarify: 2 to 4 short Thai quick replies")
    reply: str | None = Field(default=None, description="For answer: Thai reply, 1 to 3 sentences")


class Pick(LLMOutput):
    product_id: str
    reason: str = Field(description="Thai, 1 or 2 short sentences with real numbers from the data")


class Ranking(LLMOutput):
    message: str = Field(description="Thai, 1 or 2 sentences introducing the picks, or explaining none fit")
    picks: list[Pick] = Field(default_factory=list, description="Best first, at most 3, only ids from the candidates")
    no_result_reason: str | None = Field(default=None, description="Thai, why nothing fits. Required when picks is empty")
    alternatives: list[str] = Field(
        default_factory=list,
        description="When picks is empty: 1 to 3 Thai suggestions the user can tap to search again",
    )


class Broaden(LLMOutput):
    keywords: list[str] = Field(
        default_factory=list,
        description="Wider search words: the generic product type, synonyms, related product types, Thai and English",
    )
    query: str | None = Field(default=None, description="The need restated in plain Thai for a meaning-based search")


# ---------- prompts ----------

_BROADEN_SYSTEM = """A product search in a Thai shop found nothing. Suggest wider search words that
could still satisfy the need: the generic product type, synonyms, and closely related product types
from the categories we sell. Do not drop the user's actual need (a user asking for shoes must not
get chairs). If no category we sell could fit, return the generic product type only. JSON only.
"""



_PLAN_SYSTEM = """You are the request reader of a Thai shopping chat bot. Read the user's latest
message with the chat so far and decide one action. Reply in JSON only.

- Prefer "search" whenever the product type is clear, even without a budget.
- Use "clarify" only when the product type is missing or so broad that results would be random
  (e.g. "อยากได้หูฟังใหม่" with no use case). Never clarify twice in a row; search instead.
- A described problem is a clear request: "ปวดคอเวลาดูจอโน้ตบุ๊ค", "ปวดข้อมือ", "แสงจอแยงตา" ->
  "search" for products that solve it (keywords for those product types), never "clarify".
- "เอาตัวแรก", "เอาอันที่สอง", "สั่งเลย" -> "checkout" with the matching product_id from the
  products shown last turn (numbered 1, 2, 3 and so on). Quantity from the message, default 1.
- Comparing or asking about products already shown -> "answer", using their data.
- Resolve relative dates ("พรุ่งนี้", "วันอาทิตย์", "ภายในสัปดาห์นี้") from today's date.
- "งบ 3000" means max_price 3000. Prices are in baht.
- Keywords are matched as substrings and a product needs only one match, so search wide: always
  include the generic product type in Thai and English, then the specific words. E.g. "iPad Pro"
  -> ["ipad", "แท็บเล็ต", "tablet", "pro"]; "เก้าอี้ทำงาน ergonomic" -> ["เก้าอี้", "ergonomic"].
  Never a whole sentence. Color or style words go in keywords too.
- Set category only when it is clearly one of the given categories.
- "ขอดูหมด", "ดูทั้งหมด", "ทุกตัว" -> "search" with scope "all". With no product type named (e.g.
  after "มีอะไรให้ซื้อบ้าง"), leave keywords empty to list everything. "มีตัวอื่นไหม", "ขอดูเพิ่ม"
  -> "search" with scope "more" and the same keywords as the last search.
- "มีอะไรให้ซื้อบ้าง" alone -> "clarify", with the categories we sell as choices (at most 4).
- Every Thai text you write (question, choices, reply) is a polite male voice: end with "ครับ",
  never "ค่ะ" or "คะ".
"""

_RANK_SYSTEM = """You pick products for a Thai shopping chat bot. You get the user's request, their
profile (U-Tag) and candidate products that already passed stock, budget and delivery filters.
Reply in JSON only.

- Pick at most 3 candidates that truly fit the request, best first. Fewer is fine. Never invent ids.
- When the user names a product type, only that type fits. An accessory or a different product
  (a stylus for "iPad", a case for "laptop") is not a pick; mention it in alternatives instead.
- Each reason is Thai, 1 or 2 short sentences, concrete: rating and review count, price after
  discount, delivery day, or a match with the user's interests. No generic praise.
- If nothing fits, return no picks, a no_result_reason and 1 to 3 alternatives the user can tap.
  Base the reason only on the search facts given (no match, out of stock, over budget, late
  delivery). Never claim something the facts do not show, such as "sold out" when nothing matched.
- message: Thai, 1 or 2 sentences, polite male bot voice ending with "ครับ". No greeting, do not use
  the user's name, no emoji. This is the middle of a chat.
"""


def _fmt_product(n: int, p: ProductHit) -> str:
    sale = f" (ลด {p.discount_percent}% จาก {p.original_price:,.0f})" if p.discount_percent else ""
    return (
        f"{n}. id={p.product_id} | {p.title} | หมวด {p.category} | {p.price:,.2f} บาท{sale} | "
        f"รีวิว {p.rating} จาก {p.review_count} | สต็อก {p.stock} | ส่งถึง {p.delivery_date.isoformat()} | "
        f"ร้าน {p.shop.name} (คะแนนร้าน {p.shop.rating}) | tags: {', '.join(p.tags)} | {p.description}"
    )


def _fmt_profile(user: UserProfile) -> str:
    bought = ", ".join(f"{h.title} ({h.category})" for h in user.purchase_history[:5]) or "-"
    return (
        f"name: {user.display_name}; delivers to: {user.address.district} {user.address.province}; "
        f"interests: {', '.join(user.interests) or '-'}; bought before: {bought}; "
        f"U-Tag discount at checkout: {user.discount_percent}%"
    )


def _fmt_history(history: list[HistoryMessage]) -> str:
    lines = [f"{m.role}: {m.text}" for m in history[-_HISTORY_TURNS:]]
    return "\n".join(lines) or "(first message)"


def _baht(value: float) -> str:
    return f"{value:,.0f}"


def _thai_date(d: date) -> str:
    months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]
    return f"{d.day} {months[d.month - 1]}"


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


def _fact_reason(p: ProductHit) -> str:
    price = (
        f"ลด {p.discount_percent}% เหลือ {_baht(p.price)} บาท" if p.discount_percent else f"ราคา {_baht(p.price)} บาท"
    )
    return f"รีวิว {p.rating} จาก {p.review_count:,} รีวิว {price} ส่งถึง {_thai_date(p.delivery_date)} จากร้าน {p.shop.name}"


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
) -> AsyncIterator[dict]:
    replay = text[1:].split(maxsplit=1)[0] if text.startswith("/") and len(text) > 1 else ""
    if replay in _TURNS:
        async for event in _replay(replay):
            yield event
        return

    step_id, label = "parse", "อ่านความต้องการ"
    try:
        yield _step(step_id, label)
        categories, shown = await asyncio.gather(catalog.list_categories(), _last_options(history))
        plan = await generate(
            _PLAN_SYSTEM,
            f"today: {today.isoformat()} (วัน{_WEEKDAYS[today.weekday()]})\n"
            f"categories: {json.dumps(categories, ensure_ascii=False)}\n"
            f"user profile: {_fmt_profile(user_profile)}\n"
            f"products shown last turn:\n"
            + ("\n".join(_fmt_product(i + 1, p) for i, p in enumerate(shown)) or "(none)")
            + f"\n\nchat so far:\n{_fmt_history(history)}\n\nlatest user message: {text}",
            Plan,
        )
        yield _step(step_id, label, "done", plan.summary)

        if plan.action == "clarify" and plan.question:
            yield {"type": "clarify", "question": plan.question, "choices": plan.choices[:4]}
            return

        if plan.action == "answer" and plan.reply:
            for chunk in _chunks(plan.reply):
                yield {"type": "message_delta", "text": chunk}
            return

        if plan.action == "checkout":
            step_id, label = "resolve", "หาสินค้าที่เลือกจากรอบก่อน"
            yield _step(step_id, label)
            chosen = next((p for p in shown if p.product_id == plan.product_id), None)
            if chosen is None:
                yield _step(step_id, label, "error", "ไม่พบสินค้าที่เลือกในรอบก่อน")
                yield {"type": "message_delta", "text": "ยังไม่แน่ใจว่าหมายถึงสินค้าตัวไหนครับ บอกชื่อหรือลำดับในการ์ดได้เลย"}
                return
            yield _step(step_id, label, "done", chosen.title)
            yield {"type": "message_delta", "text": "เปิดหน้า U-Pay ให้แล้วครับ ตรวจยอดก่อนกดยืนยันได้เลย"}
            yield {
                "type": "checkout_request",
                "product_id": chosen.product_id,
                "quantity": max(1, min(plan.quantity, chosen.stock or 1)),
            }
            return

        # search (also the fallback when clarify/answer came back without text)
        step_id, label = "profile", "ดึงที่อยู่จัดส่งจาก U-Tag"
        yield _step(step_id, label)
        yield _step(step_id, label, "done", f"{user_profile.address.district} {user_profile.address.province}")

        step_id, label = "search", "ค้นสินค้าจากร้านบนแพลตฟอร์ม"
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
        yield _step(step_id, label, "done", f"เจอ {result.matched} รายการที่ตรงคำค้น")

        if result.matched == 0:
            # Nothing matched at all (not even before budget/stock filters): try once with wider words.
            step_id, label = "retry", "ค้นใหม่ด้วยคำที่กว้างขึ้น"
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
                yield _step(step_id, label, "error", "ค้นซ้ำไม่สำเร็จ ใช้ผลรอบแรก")
            else:
                result = await catalog.search_products(wider.keywords, query=wider.query or plan.summary, **filters)
                tried = ", ".join(wider.keywords[:4]) or "คำทั่วไป"
                yield _step(step_id, label, "done", f"ลองคำว่า {tried}: เจอ {result.matched} รายการ")

        excluded = [
            (result.excluded_out_of_stock, "ตัดของหมดสต็อก"),
            (result.excluded_price, "เกินงบ" if plan.min_price is None else "ราคาไม่อยู่ในช่วง"),
            (result.excluded_late_delivery, f"ส่งไม่ทัน {_thai_date(deliver_by)}" if deliver_by else "ส่งไม่ทัน"),
        ]
        if any(n for n, _ in excluded):
            step_id, label = "filter", "คัดสินค้าที่ส่งไม่ได้หรือเกินงบออก"
            yield _step(step_id, label)
            yield _step(step_id, label, "done", ", ".join(f"{why} {n} รายการ" for n, why in excluded if n))

        if plan.scope == "more":
            result.items = [p for p in result.items if p.product_id not in seen]

        if plan.scope == "all" and result.items:
            # Many cards: order is relevance then rating (from the catalog), reasons are real numbers.
            step_id, label = "rank", "เรียงตามความตรง รีวิว และจำนวนรีวิว"
            yield _step(step_id, label)
            shown_items = _mix_categories(result.items) if browse_everything else result.items
            options = [ProductOption(**p.model_dump(), reason=_fact_reason(p)) for p in shown_items[:_MAX_ALL]]
            total = len(result.items)
            yield _step(step_id, label, "done", f"แสดง {len(options)} จาก {total} รายการ")
            what = "สินค้าทั้งหมดบนแพลตฟอร์ม" if browse_everything else plan.summary
            more = f" แสดง {len(options)} รายการที่ตรงและรีวิวดีที่สุดก่อน บอกหมวดหรืองบเพิ่มได้เลยครับ" if total > len(options) else ""
            yield {"type": "message_delta", "text": f"{what} มี {total} รายการครับ{more}"}
            yield {"type": "options", "items": [o.model_dump(mode="json") for o in options], "reason": None, "alternatives": []}
            return

        step_id, label = "rank", "จัดอันดับจากรีวิว ราคา และวันส่ง"
        yield _step(step_id, label)
        by_id = {p.product_id: p for p in result.items}
        ranking = await generate(
            _RANK_SYSTEM,
            f"today: {today.isoformat()}\nrequest: {text}\nunderstood as: {plan.summary}\n"
            f"user profile: {_fmt_profile(user_profile)}\n"
            f"search facts: matched {result.matched}, out of stock {result.excluded_out_of_stock}, "
            f"outside budget {result.excluded_price}, late delivery {result.excluded_late_delivery}\n"
            f"candidates:\n" + ("\n".join(_fmt_product(i + 1, p) for i, p in enumerate(result.items)) or "(none)"),
            Ranking,
        )
        options: list[ProductOption] = []
        for pick in ranking.picks:
            hit = by_id.get(pick.product_id)
            if hit and all(o.product_id != hit.product_id for o in options):
                options.append(ProductOption(**hit.model_dump(), reason=pick.reason))
        options = options[:_MAX_OPTIONS]
        yield _step(step_id, label, "done", f"เหลือ {len(options)} ตัวเลือก")

        for chunk in _chunks(ranking.message):
            yield {"type": "message_delta", "text": chunk}

        if options:
            items = [o.model_dump(mode="json") for o in options]
            yield {"type": "options", "items": items, "reason": None, "alternatives": []}
        else:
            budget = f" ในงบ {_baht(plan.max_price)} บาท" if plan.max_price else ""
            fallback = (
                "ไม่มีตัวเลือกอื่นนอกจากที่แสดงไปแล้วครับ"
                if plan.scope == "more"
                else f"ยังไม่มีสินค้าที่ตรงกับ {plan.summary}{budget}"
            )
            yield {
                "type": "options",
                "items": [],
                "reason": ranking.no_result_reason or fallback,
                "alternatives": ranking.alternatives[:3] or ["ดูสินค้าทั้งหมดในหมวดนี้"],
            }
    except Exception:
        # Close the running line in the web, then let the route send `error` and `done`.
        yield _step(step_id, label, "error", "ขั้นตอนนี้ขัดข้อง")
        raise
