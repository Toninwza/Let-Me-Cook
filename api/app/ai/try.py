"""Run the agent from the terminal: uv run python -m app.ai.try "หาเก้าอี้ทำงาน งบ 3000"

Uses the demo user from api/seed/data.json, no web or API server needed.
Needs the DB seeded (uv run python -m app.seed) once the agent calls app.catalog.
"""

import asyncio
import json
import sys
from pathlib import Path

from app.ai import run_agent
from app.catalog import today
from app.schemas import UserProfile

_SEED = Path(__file__).resolve().parents[2] / "seed" / "data.json"


def _demo_profile() -> UserProfile:
    user = json.loads(_SEED.read_text(encoding="utf-8"))["users"][0]
    return UserProfile(user_id=user.pop("id"), **user)


async def main(text: str) -> None:
    async for event in run_agent("s_try", text, _demo_profile(), [], today()):
        print(json.dumps(event, ensure_ascii=False))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    asyncio.run(main(" ".join(sys.argv[1:]) or "หาเก้าอี้ทำงาน ergonomic งบ 3000"))
