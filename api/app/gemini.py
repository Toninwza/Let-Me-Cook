"""Gemini client shared by the AI module (chat) and the catalog (embeddings)."""

import asyncio
from typing import Literal

from google import genai
from google.genai import types

from app.config import settings

EMBED_MODEL = "gemini-embedding-001"
EMBED_DIM = 768


class GeminiNotConfigured(RuntimeError):
    pass


# One client per event loop: the async client's connections belong to the loop that opened them.
_clients: dict[int, genai.Client] = {}


def client() -> genai.Client:
    if not settings.gemini_api_key:
        raise GeminiNotConfigured("GEMINI_API_KEY is not set in api/.env")
    loop = id(asyncio.get_running_loop())
    if loop not in _clients:
        _clients[loop] = genai.Client(
            api_key=settings.gemini_api_key,
            # SDK default is 5 attempts with backoff up to 60 s: one overloaded moment (429/5xx) can
            # stall a chat turn for minutes (seen in evals: 134 s on one call). Fail fast instead.
            http_options=types.HttpOptions(
                timeout=20_000,  # ms, per attempt
                retry_options=types.HttpRetryOptions(attempts=3, initial_delay=0.5, max_delay=2.0),
            ),
        )
    return _clients[loop]


async def embed(texts: list[str], task: Literal["RETRIEVAL_DOCUMENT", "RETRIEVAL_QUERY"]) -> list[list[float]]:
    response = await client().aio.models.embed_content(
        model=EMBED_MODEL,
        contents=texts,
        config=types.EmbedContentConfig(task_type=task, output_dimensionality=EMBED_DIM),
    )
    return [e.values for e in response.embeddings]
