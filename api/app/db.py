from collections.abc import Iterator

from sqlalchemy import inspect
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

    if engine.dialect.name == "postgresql":
        # pgvector, for product_embedding. Supabase keeps extensions in the "extensions" schema,
        # which is on its default search_path; plain Postgres has no such schema.
        with engine.begin() as conn:
            has_schema = conn.execute(
                text("select 1 from pg_namespace where nspname = 'extensions'")
            ).first()
            schema = " with schema extensions" if has_schema else ""
            conn.execute(text(f"create extension if not exists vector{schema}"))

    SQLModel.metadata.create_all(engine)
    _add_missing_columns()

    if engine.dialect.name == "postgresql":
        # Supabase exposes public tables over its REST API. RLS with no policies
        # blocks that path; this API connects as the table owner, which RLS
        # doesn't apply to. Idempotent, so it runs on every start.
        with engine.begin() as conn:
            for table in SQLModel.metadata.sorted_tables:
                conn.execute(text(f'ALTER TABLE "{table.name}" ENABLE ROW LEVEL SECURITY'))


def _add_missing_columns() -> None:
    """create_all never alters existing tables. Add new *nullable* model columns to them, so a model
    change does not need a manual ALTER TABLE. Never drops or changes columns; unique and not-null
    constraints on added columns are left out (add those by hand if needed)."""
    existing = inspect(engine)
    with engine.begin() as conn:
        for table in SQLModel.metadata.sorted_tables:
            if not existing.has_table(table.name):
                continue
            have = {c["name"] for c in existing.get_columns(table.name)}
            for column in table.columns:
                if column.name in have or not column.nullable:
                    continue
                kind = column.type.compile(dialect=engine.dialect)
                conn.execute(text(f'ALTER TABLE "{table.name}" ADD COLUMN "{column.name}" {kind}'))


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session
