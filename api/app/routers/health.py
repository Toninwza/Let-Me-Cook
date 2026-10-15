from fastapi import APIRouter, Depends
from sqlmodel import Session, text

from app.db import get_session

router = APIRouter(tags=["health"])


@router.get("/health")
def health(session: Session = Depends(get_session)) -> dict:
    try:
        session.exec(text("SELECT 1"))
        db = "ok"
    except Exception as exc:  # report, don't crash, so deploy checks stay readable
        db = f"error: {exc.__class__.__name__}"
    return {"status": "ok", "db": db}
