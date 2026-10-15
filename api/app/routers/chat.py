import asyncio
import json
import logging
from contextlib import aclosing
from datetime import date, datetime

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.ai import run_agent
from app.db import engine
from app.models import AppUser, ChatSession, Message
from app.schemas import HistoryMessage, UserProfile

log = logging.getLogger(__name__)
router = APIRouter(tags=["chat"])

DEMO_USER_ID = "u_demo"
AGENT_TIMEOUT_S = 90


class SessionIn(BaseModel):
    user_id: str | None = None


class SessionOut(BaseModel):
    session_id: str
    user: UserProfile


class MessageIn(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


def profile_of(user: AppUser) -> UserProfile:
    return UserProfile(
        user_id=user.id,
        display_name=user.display_name,
        address=user.address,
        interests=user.interests,
        purchase_history=user.purchase_history,
        discount_percent=user.discount_percent,
    )


def _history(session: Session, session_id: str) -> list[HistoryMessage]:
    rows = session.exec(
        select(Message).where(Message.session_id == session_id).order_by(Message.id)
    ).all()
    return [
        HistoryMessage(role=m.role, text=m.text, option_ids=m.option_ids, created_at=m.created_at)
        for m in rows
    ]


@router.post("/sessions")
def create_session(body: SessionIn) -> SessionOut:
    with Session(engine) as session:
        user = session.get(AppUser, body.user_id or DEMO_USER_ID)
        if user is None:
            raise HTTPException(404, "user not found, run: uv run python -m app.seed")
        chat = ChatSession(user_id=user.id)
        session.add(chat)
        session.commit()
        return SessionOut(session_id=chat.id, user=profile_of(user))


@router.get("/sessions/{session_id}/messages")
def list_messages(session_id: str) -> list[HistoryMessage]:
    with Session(engine) as session:
        if session.get(ChatSession, session_id) is None:
            raise HTTPException(404, "session not found")
        return _history(session, session_id)


def _turn_context(session_id: str, text: str) -> tuple[UserProfile, list[HistoryMessage]]:
    """Loads profile and history, then stores the user's message (history excludes it)."""
    with Session(engine) as session:
        chat = session.get(ChatSession, session_id)
        if chat is None:
            raise HTTPException(404, "session not found")
        profile = profile_of(session.get(AppUser, chat.user_id))
        history = _history(session, session_id)
        session.add(Message(session_id=session_id, role="user", text=text))
        session.commit()
        return profile, history


def _save_bot_turn(session_id: str, text: str, option_ids: list[str]) -> None:
    with Session(engine) as session:
        session.add(Message(session_id=session_id, role="bot", text=text, option_ids=option_ids))
        session.commit()


def _json_default(value):
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, BaseModel):
        return value.model_dump(mode="json")
    raise TypeError(f"not JSON serializable: {type(value).__name__}")


def _sse(event: dict) -> str:
    data = json.dumps(event, ensure_ascii=False, default=_json_default)
    return f"event: {event.get('type', 'message')}\ndata: {data}\n\n"


async def _stream(session_id: str, text: str, profile: UserProfile, history: list[HistoryMessage]):
    bot_text: list[str] = []
    option_ids: list[str] = []
    try:
        async with asyncio.timeout(AGENT_TIMEOUT_S):
            async with aclosing(run_agent(session_id, text, profile, history)) as events:
                async for event in events:
                    kind = event.get("type")
                    if kind == "done":
                        break
                    if kind == "message_delta":
                        bot_text.append(event.get("text", ""))
                    elif kind == "clarify":
                        bot_text.append(event.get("question", ""))
                    elif kind == "options":
                        option_ids = [item["product_id"] for item in event.get("items", [])]
                    yield _sse(event)
    except TimeoutError:
        yield _sse({"type": "error", "code": "timeout", "message": "bot ใช้เวลานานเกินไป ลองส่งใหม่อีกครั้งครับ"})
    except Exception:
        log.exception("run_agent failed")
        yield _sse({"type": "error", "code": "agent_failed", "message": "bot ขัดข้องชั่วคราว ลองส่งข้อความใหม่อีกครั้งครับ"})

    if bot_text or option_ids:
        try:
            await asyncio.to_thread(_save_bot_turn, session_id, "".join(bot_text), option_ids)
        except Exception:
            log.exception("saving bot turn failed")
    yield _sse({"type": "done"})


@router.post("/sessions/{session_id}/messages")
async def post_message(session_id: str, body: MessageIn) -> StreamingResponse:
    text = body.text.strip()
    if not text:
        raise HTTPException(422, "text is empty")
    profile, history = await asyncio.to_thread(_turn_context, session_id, text)
    return StreamingResponse(
        _stream(session_id, text, profile, history),
        media_type="text/event-stream",
        # no-transform: stops proxies (Next rewrite, Cloud Run front end) from compressing/buffering.
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
    )
