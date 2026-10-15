from datetime import UTC, datetime

from sqlmodel import Field, SQLModel


# Example table so the DB wiring can be verified end to end.
# Replace or extend once the idea is decided.
class Note(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    text: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
