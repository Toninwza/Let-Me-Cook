"""Thin Gemini wrapper: one call in, one validated pydantic object out."""

from typing import Any, TypeVar

from google.genai import types
from pydantic import BaseModel, model_validator

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


async def generate(system: str, prompt: str, schema: type[T], temperature: float = 0.2) -> T:
    response = await client().aio.models.generate_content(
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
