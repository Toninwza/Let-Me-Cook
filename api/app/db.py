from collections.abc import Iterator

from sqlmodel import Session, SQLModel, create_engine

from app.config import settings


def _normalize_url(url: str) -> str:
    # Supabase hands out postgresql:// URLs; SQLAlchemy needs the psycopg driver named.
    if url.startswith("postgres://"):
        url = "postgresql://" + url.removeprefix("postgres://")
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url.removeprefix("postgresql://")
    return url


_url = _normalize_url(settings.database_url)
_connect_args = {"check_same_thread": False} if _url.startswith("sqlite") else {}

engine = create_engine(_url, pool_pre_ping=True, connect_args=_connect_args)


def init_db() -> None:
    # Import models so their tables are registered before create_all.
    from app import models  # noqa: F401

    SQLModel.metadata.create_all(engine)


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session
