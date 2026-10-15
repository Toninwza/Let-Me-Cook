"""STUB. Replays one turn of fixtures/chat_stream.json. Replace the body of run_agent, keep the signature."""

import asyncio
import json
from collections.abc import AsyncIterator
from pathlib import Path

from app.schemas import HistoryMessage, UserProfile

_FIXTURE = Path(__file__).parent / "fixtures" / "chat_stream.json"
_TURNS: dict = json.loads(_FIXTURE.read_text(encoding="utf-8"))["turns"]

_DELAY = {"agent_step": 0.45, "message_delta": 0.12, "options": 0.3, "clarify": 0.3}


def _pick_turn(text: str) -> str:
    # "/clarify", "/no_results", "/pick", "/error" play that turn so the web can render every event.
    if text.startswith("/"):
        name = text[1:].split(maxsplit=1)[0] if len(text) > 1 else ""
        if name in _TURNS:
            return name
    return "search"


async def run_agent(
    session_id: str,
    text: str,
    user_profile: UserProfile,
    history: list[HistoryMessage],
) -> AsyncIterator[dict]:
    for event in _TURNS[_pick_turn(text.strip())]["events"]:
        await asyncio.sleep(_DELAY.get(event["type"], 0))
        yield dict(event)
