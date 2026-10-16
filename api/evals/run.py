"""Run the agent eval set: cd api && uv run python -m evals.run [case_id ...]

Calls run_agent directly (no HTTP, no chat rows written) against the catalog in DATABASE_URL.
Needs GEMINI_API_KEY. Semantic cases only pass on Postgres with embeddings (python -m app.embeddings).
"""

import asyncio
import json
import re
import sys
import time
from datetime import UTC, datetime, timedelta
from pathlib import Path

from app import catalog
from app.ai import run_agent
from app.schemas import HistoryMessage, UserProfile

_HERE = Path(__file__).parent
_SEED = _HERE.parent / "seed" / "data.json"
_CONCURRENCY = 3
_TITLES: list[str] = []  # product titles stay Thai in English replies; filled in main()
_THAI = re.compile(r"[฀-๿]")


def _profile() -> UserProfile:
    user = json.loads(_SEED.read_text(encoding="utf-8"))["users"][0]
    return UserProfile(user_id=user.pop("id"), **user)


async def _turn(text: str, history: list[HistoryMessage]) -> list[dict]:
    return [e async for e in run_agent("s_eval", text, _profile(), history, catalog.today())]


def _bot_message(events: list[dict]) -> HistoryMessage:
    text = "".join(e.get("text", "") for e in events if e["type"] == "message_delta")
    text += "".join(e.get("question", "") for e in events if e["type"] == "clarify")
    ids = next((([i["product_id"] for i in e["items"]]) for e in events if e["type"] == "options"), [])
    return HistoryMessage(role="bot", text=text, option_ids=ids, created_at=datetime.now(UTC))


def _contract_problems(events: list[dict]) -> list[str]:
    """Rules from docs/contract.md that every turn must follow."""
    problems = []
    if any(e["type"] == "error" for e in events):
        problems.append("error event")
    running = {e["step_id"] for e in events if e["type"] == "agent_step" and e["status"] == "running"}
    closed = {e["step_id"] for e in events if e["type"] == "agent_step" and e["status"] != "running"}
    if running - closed:
        problems.append(f"steps left running: {sorted(running - closed)}")
    for kind in ("options", "clarify", "checkout_request"):
        if sum(e["type"] == kind for e in events) > 1:
            problems.append(f"more than one {kind}")
    for e in events:
        if e["type"] == "options":
            if len(e["items"]) > 12:
                problems.append("more than 12 options")
            if not e["items"] and (not e.get("reason") or not e.get("alternatives")):
                problems.append("empty options without reason/alternatives")
            if any(i["stock"] <= 0 for i in e["items"]):
                problems.append("out-of-stock option")
            if any(not i.get("reason") for i in e["items"]):
                problems.append("option without reason")
    said = " ".join(e.get("text", "") or e.get("question", "") for e in events if e["type"] in ("message_delta", "clarify"))
    said += " ".join(c for e in events if e["type"] == "clarify" for c in e.get("choices", []))
    if "ค่ะ" in said or "คะ" in said.replace("คะแนน", ""):
        problems.append("female particle ค่ะ/คะ in bot text (bot is male, says ครับ)")
    return problems


def _thai_in_bot_text(events: list[dict]) -> list[str]:
    """Bot-written text that still contains Thai, ignoring product titles and the user's address."""
    texts = []
    for e in events:
        if e["type"] == "agent_step" and e["step_id"] not in ("profile", "resolve"):
            texts += [e["label"], e.get("detail") or ""]
        elif e["type"] == "message_delta":
            texts.append(e["text"])
        elif e["type"] == "clarify":
            texts += [e["question"], *e.get("choices", [])]
        elif e["type"] == "options":
            texts += [e.get("reason") or "", *e.get("alternatives", []), *(i["reason"] for i in e["items"])]
    found = []
    for text in texts:
        for title in _TITLES:
            text = text.replace(title, "")
        text = re.sub(r'"[^"]*"', "", text)  # a quoted (part of a) product title is allowed
        if _THAI.search(text):
            found.append(text.strip()[:60])
    return found


def _check(expect: dict, events: list[dict], prev_options: list[str], prev_shown: list[str]) -> list[str]:
    kinds = {e["type"] for e in events}
    options = next((e for e in events if e["type"] == "options"), None)
    items = options["items"] if options else []
    ids = [i["product_id"] for i in items]
    checkout = next((e for e in events if e["type"] == "checkout_request"), None)
    want = expect["event"]
    problems = []

    if want == "options" and not options:
        problems.append(f"expected options, got {sorted(kinds - {'agent_step', 'message_delta'})}")
    if want == "clarify" and "clarify" not in kinds:
        problems.append("expected clarify")
    if expect.get("lang") == "en" and not options and (thai := _thai_in_bot_text(events)):
        problems.append(f"Thai text in an English reply: {thai[:3]}")
    if want == "clarify_or_options" and "clarify" not in kinds and not items:
        problems.append("expected clarify or product options")
    if want == "answer" and (options or checkout or "message_delta" not in kinds):
        problems.append("expected a text answer only")
    if want == "answer_or_clarify" and (options and items or checkout):
        problems.append("expected answer or clarify")
    if want == "no_checkout" and checkout:
        problems.append("checkout_request was sent")
    if want == "checkout_request":
        if not checkout:
            problems.append("expected checkout_request")
        else:
            n = expect["checkout_option"]
            if len(prev_options) < n or checkout["product_id"] != prev_options[n - 1]:
                problems.append(f"picked {checkout['product_id']}, expected option {n} of {prev_options}")
            if checkout["quantity"] != expect.get("quantity", 1):
                problems.append(f"quantity {checkout['quantity']}")
            if "payment_method" in expect and checkout.get("payment_method") != expect["payment_method"]:
                problems.append(f"payment_method {checkout.get('payment_method')!r}, expected {expect['payment_method']!r}")

    if options:
        if "min_items" in expect and len(items) < expect["min_items"]:
            problems.append(f"{len(items)} items < {expect['min_items']}")
        if "max_items" in expect and len(items) > expect["max_items"]:
            problems.append(f"{len(items)} items > {expect['max_items']}: {ids}")
        if "include_any" in expect and not set(ids) & set(expect["include_any"]):
            problems.append(f"none of {expect['include_any']} in {ids}")
        if bad := set(ids) & set(expect.get("exclude", [])):
            problems.append(f"excluded shown: {sorted(bad)}")
        if "max_price" in expect and (over := [i["product_id"] for i in items if i["price"] > expect["max_price"]]):
            problems.append(f"over budget: {over}")
        if expect.get("no_repeat") and (again := set(ids) & set(prev_shown)):
            problems.append(f"repeated products already shown: {sorted(again)}")
        if expect.get("lang") == "en" and (thai := _thai_in_bot_text(events)):
            problems.append(f"Thai text in an English reply: {thai[:3]}")
        if "deliver_within_days" in expect:
            limit = (catalog.today() + timedelta(days=expect["deliver_within_days"])).isoformat()
            if late := [i["product_id"] for i in items if i["delivery_date"] > limit]:
                problems.append(f"late: {late}")
    return problems


async def _run_case(case: dict, gate: asyncio.Semaphore) -> dict:
    async with gate:
        history: list[HistoryMessage] = []
        prev_options: list[str] = []
        prev_shown: list[str] = []
        events: list[dict] = []
        started = 0.0
        try:
            for i, text in enumerate(case["turns"]):
                started = time.perf_counter()
                events = await _turn(text, history)
                if i < len(case["turns"]) - 1:
                    bot = _bot_message(events)
                    prev_options = bot.option_ids or prev_options
                    prev_shown += bot.option_ids
                    history += [HistoryMessage(role="user", text=text, created_at=datetime.now(UTC)), bot]
            seconds = time.perf_counter() - started
            problems = _contract_problems(events) + _check(case["expect"], events, prev_options, prev_shown)
        except Exception as exc:
            seconds, problems = time.perf_counter() - started, [f"raised {type(exc).__name__}: {exc}"]
        steps = [e["step_id"] for e in events if e.get("type") == "agent_step" and e["status"] == "done"]
        shown = next(([i["product_id"] for i in e["items"]] for e in events if e.get("type") == "options"), None)
        return {"id": case["id"], "ok": not problems, "problems": problems, "seconds": seconds, "steps": steps, "shown": shown}


async def main(only: list[str]) -> int:
    _TITLES[:] = sorted((p.title for p in await catalog.list_products()), key=len, reverse=True)
    cases = json.loads((_HERE / "cases.json").read_text(encoding="utf-8"))["cases"]
    cases = [c for c in cases if not only or c["id"] in only]
    gate = asyncio.Semaphore(_CONCURRENCY)
    results = await asyncio.gather(*(_run_case(c, gate) for c in cases))
    for r in results:
        mark = "PASS" if r["ok"] else "FAIL"
        print(f"{mark}  {r['id']:<26} {r['seconds']:5.1f}s  steps={','.join(r['steps'])}  shown={r['shown']}")
        for p in r["problems"]:
            print(f"        - {p}")
    passed = sum(r["ok"] for r in results)
    avg = sum(r["seconds"] for r in results) / max(len(results), 1)
    print(f"\n{passed}/{len(results)} passed, average last-turn time {avg:.1f}s")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(asyncio.run(main(sys.argv[1:])))
