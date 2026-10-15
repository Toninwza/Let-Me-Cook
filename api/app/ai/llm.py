"""Thin Gemini wrapper: one call in, one validated pydantic object out."""

from functools import cache
from typing import TypeVar

from google import genai
from google.genai import types
from pydantic import BaseModel

from app.config import settings

T = TypeVar("T", bound=BaseModel)


class LLMNotConfigured(RuntimeError):
    pass


@cache
def _client() -> genai.Client:
    if not settings.gemini_api_key:
        raise LLMNotConfigured("GEMINI_API_KEY is not set in api/.env")
    return genai.Client(api_key=settings.gemini_api_key)


async def generate(system: str, prompt: str, schema: type[T], temperature: float = 0.2) -> T:
    response = await _client().aio.models.generate_content(
        model=settings.gemini_model,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=system,
            temperature=temperature,
            response_mime_type="application/json",
            response_json_schema=schema.model_json_schema(),
            # The two calls per turn are extraction and ranking; thinking adds seconds, not quality.
            thinking_config=types.ThinkingConfig(thinking_budget=0),
        ),
    )
    return schema.model_validate_json(response.text)
