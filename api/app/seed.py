"""Load api/seed/data.json into the DB. Idempotent: rows are upserted by id.

uv run python -m app.seed [path/to/data.json]
"""

import json
import sys
from pathlib import Path

from sqlmodel import Session

from app.db import engine, init_db
from app.models import AppUser, Product, Shop

_DEFAULT = Path(__file__).resolve().parents[1] / "seed" / "data.json"


def seed(path: Path) -> None:
    data = json.loads(path.read_text(encoding="utf-8"))
    init_db()
    with Session(engine) as session:
        for row in data["shops"]:
            session.merge(Shop(**row))
        session.flush()
        for row in data["products"]:
            session.merge(Product(**row))
        for row in data["users"]:
            session.merge(AppUser(**row))
        session.commit()
    print(f"seeded {len(data['shops'])} shops, {len(data['products'])} products, {len(data['users'])} users")


if __name__ == "__main__":
    seed(Path(sys.argv[1]) if len(sys.argv) > 1 else _DEFAULT)
