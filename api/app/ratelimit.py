"""Per-IP limits for endpoints that cost money per call (Gemini, ElevenLabs, Stripe).

In memory, per process: good enough to stop someone draining credits during the demo. With several
Cloud Run instances each keeps its own count, so the real ceiling is limit x instances.
"""

import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

_hits: dict[tuple[str, str], deque[float]] = defaultdict(deque)
_MAX_KEYS = 10_000


def client_ip(request: Request) -> str:
    # The Next rewrite and Cloud Run both put the caller first in X-Forwarded-For.
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def limit(name: str, per_minute: int):
    """Route dependency: `dependencies=[Depends(limit("speak", 30))]`."""
    window = 60.0

    def check(request: Request) -> None:
        now = time.monotonic()
        if len(_hits) > _MAX_KEYS:
            _hits.clear()  # crude cap so a flood of spoofed IPs cannot grow memory forever
        hits = _hits[(name, client_ip(request))]
        while hits and now - hits[0] > window:
            hits.popleft()
        if len(hits) >= per_minute:
            retry = int(window - (now - hits[0])) + 1
            raise HTTPException(
                429,
                "ใช้งานถี่เกินไป รอสักครู่แล้วลองใหม่ครับ",
                headers={"Retry-After": str(retry)},
            )
        hits.append(now)

    return check
