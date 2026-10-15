from collections.abc import Iterator

from sqlmodel import Session, SQLModel, create_engine, text

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

    if engine.dialect.name == "postgresql":
        # Supabase exposes public tables over its REST API. RLS with no policies
        # blocks that path; this API connects as the table owner, which RLS
        # doesn't apply to. Idempotent, so it runs on every start.
        with engine.begin() as conn:
            for table in SQLModel.metadata.sorted_tables:
                conn.execute(text(f'ALTER TABLE "{table.name}" ENABLE ROW LEVEL SECURITY'))


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session
