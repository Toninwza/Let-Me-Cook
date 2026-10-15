"""AI module. Public surface is exactly these two functions.

Rules (AGENTS.md): pure Python, no FastAPI, no HTTP to our own API, no direct DB access.
Read products through `app.catalog`, use types from `app.schemas`.
"""

from app.ai.agent import run_agent
from app.ai.speech import transcribe

__all__ = ["run_agent", "transcribe"]
