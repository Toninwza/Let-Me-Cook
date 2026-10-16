"""Product embeddings for semantic search (Postgres + pgvector only).

Build or refresh after seeding: uv run python -m app.embeddings
On SQLite, or without GEMINI_API_KEY, everything here is a no-op and search stays keyword only.
"""

import asyncio
import hashlib
import logging

from sqlmodel import Session, select, text

from app import gemini
from app.db import engine
from app.models import Product, ProductEmbedding

log = logging.getLogger(__name__)

_BATCH = 50


def enabled() -> bool:
    return engine.dialect.name == "postgresql"


def product_text(p: Product) -> str:
    return f"{p.title}\nหมวด: {p.category}\n{p.description}\nแท็ก: {', '.join(p.tags)}"


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:16]


async def sync() -> int:
    """Embed products that have no vector yet or whose text changed. Returns how many were embedded."""
    if not enabled():
        return 0

    def stale() -> list[tuple[str, str, str]]:
        with Session(engine) as session:
            known = {e.product_id: e.content_hash for e in session.exec(select(ProductEmbedding)).all()}
            out = []
            for p in session.exec(select(Product)).all():
                body = product_text(p)
                if known.get(p.id) != _hash(body):
                    out.append((p.id, body, _hash(body)))
            return out

    todo = await asyncio.to_thread(stale)
    for start in range(0, len(todo), _BATCH):
        batch = todo[start : start + _BATCH]
        vectors = await gemini.embed([body for _, body, _ in batch], "RETRIEVAL_DOCUMENT")

        def store(batch=batch, vectors=vectors) -> None:
            with Session(engine) as session:
                for (pid, _, digest), vector in zip(batch, vectors):
                    session.merge(ProductEmbedding(product_id=pid, content_hash=digest, embedding=vector))
                session.commit()

        await asyncio.to_thread(store)
    return len(todo)


async def similarities(query: str) -> dict[str, float]:
    """Cosine similarity (0 to 1, higher = closer) of the query to every embedded product.
    Empty dict when semantic search is unavailable, so callers fall back to keywords."""
    if not enabled() or not query.strip():
        return {}
    try:
        [vector] = await gemini.embed([query], "RETRIEVAL_QUERY")
    except Exception:
        log.exception("query embedding failed, falling back to keyword search")
        return {}

    def load() -> dict[str, float]:
        with Session(engine) as session:
            rows = session.exec(
                text("select product_id, 1 - (embedding <=> cast(:q as vector)) from product_embedding"),
                params={"q": str(vector)},
            ).all()
            return {pid: float(sim) for pid, sim in rows}

    return await asyncio.to_thread(load)


if __name__ == "__main__":
    from app.db import init_db

    init_db()
    print(f"embedded {asyncio.run(sync())} products")
