"""Thin Gemini wrapper: one call in, one validated pydantic object out."""

import asyncio
from typing import Any, TypeVar

from google.genai import types
from pydantic import BaseModel, ValidationError, model_validator

from app.config import settings
from app.gemini import client


class LLMOutput(BaseModel):
    """Base for Gemini response schemas: a null for a field with a default means "use the default"."""

    @model_validator(mode="before")
    @classmethod
    def _nulls_to_defaults(cls, data: Any) -> Any:
        if isinstance(data, dict):
            fields = cls.model_fields
            return {k: v for k, v in data.items() if v is not None or k not in fields or fields[k].is_required()}
        return data


T = TypeVar("T", bound=BaseModel)


# Outer guard only; app.gemini sets the per-request timeout and retries for slow or failing calls.
_TIMEOUT_S = 45
# Our JSON answers are a few hundred tokens; the cap bounds the worst case.
_MAX_OUTPUT_TOKENS = 2048
# A second try when the JSON comes back invalid (seen once in evals).
_ATTEMPTS = 2


async def generate(system: str, prompt: str, schema: type[T], temperature: float = 0.2) -> T:
    config = types.GenerateContentConfig(
        system_instruction=system,
        temperature=temperature,
        max_output_tokens=_MAX_OUTPUT_TOKENS,
        response_mime_type="application/json",
        response_json_schema=schema.model_json_schema(),
        # The calls per turn are extraction and ranking; thinking adds seconds, not quality.
        thinking_config=types.ThinkingConfig(thinking_budget=0),
    )
    for attempt in range(_ATTEMPTS):
        try:
            response = await asyncio.wait_for(
                client().aio.models.generate_content(model=settings.gemini_model, contents=prompt, config=config),
                _TIMEOUT_S,
            )
            return schema.model_validate_json(response.text or "")
        except (TimeoutError, ValidationError):
            if attempt == _ATTEMPTS - 1:
                raise
    raise AssertionError("unreachable")
