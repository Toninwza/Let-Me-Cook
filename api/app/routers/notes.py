from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, select

from app.db import get_session
from app.models import Note

router = APIRouter(prefix="/notes", tags=["notes"])


class NoteIn(BaseModel):
    text: str


@router.get("")
def list_notes(session: Session = Depends(get_session)) -> list[Note]:
    return list(session.exec(select(Note).order_by(Note.id.desc())).all())


@router.post("", status_code=201)
def create_note(body: NoteIn, session: Session = Depends(get_session)) -> Note:
    note = Note(text=body.text)
    session.add(note)
    session.commit()
    session.refresh(note)
    return note
