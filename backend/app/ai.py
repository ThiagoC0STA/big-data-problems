"""Anthropic SDK wrapper for product enrichment."""

from __future__ import annotations

import asyncio
import json
import logging

from anthropic import APIError, AsyncAnthropic
from pydantic import BaseModel

from .config import settings
from .schemas import Product
from .seed import CATEGORIES

log = logging.getLogger("granary.ai")


class EnrichmentResult(BaseModel):
    description: str | None = None
    tags: list[str] | None = None
    category: str | None = None


class EnrichmentError(RuntimeError):
    pass


_SYSTEM_PROMPT = """You are an expert e-commerce catalog editor. Given a product, you produce
clean, factual marketing-quality content that helps shoppers and search engines.

Constraints:
- Description: 1 to 2 sentences, 80-220 chars, no marketing fluff, no emojis, no exclamation marks.
- Tags: 3 to 6 short kebab-case tags relevant to the item. No duplicates.
- Category: must be one of the canonical categories provided.

Output strictly valid JSON with keys: description (string), tags (array of strings), category (string).
Do not include anything outside the JSON object."""


def _client() -> AsyncAnthropic:
    if not settings.anthropic_api_key:
        raise EnrichmentError("ANTHROPIC_API_KEY is not set")
    return AsyncAnthropic(api_key=settings.anthropic_api_key)


def _user_prompt(product: Product, fields: list[str]) -> str:
    cat_list = ", ".join(CATEGORIES)
    fields_text = ", ".join(fields)
    return (
        f"Product:\n"
        f"  name: {product.name}\n"
        f"  brand: {product.brand or '(missing)'}\n"
        f"  current category: {product.category}\n"
        f"  current subcategory: {product.subcategory or '(none)'}\n"
        f"  current description: {product.description or '(none)'}\n"
        f"  current tags: {', '.join(product.tags) if product.tags else '(none)'}\n\n"
        f"Canonical categories: {cat_list}\n\n"
        f"Enrich these fields: {fields_text}.\n"
        f"If a field is already good, you may copy it. Always respond with all three keys."
    )


async def enrich_product(
    product: Product,
    *,
    fields: list[str],
    max_attempts: int = 3,
) -> EnrichmentResult:
    """Call Claude to enrich a product. Retries on transient errors."""
    if not settings.anthropic_api_key:
        return _offline_enrichment(product)

    client = _client()
    last_error: Exception | None = None
    for attempt in range(1, max_attempts + 1):
        try:
            msg = await client.messages.create(
                model=settings.anthropic_model,
                max_tokens=400,
                system=[
                    {
                        "type": "text",
                        "text": _SYSTEM_PROMPT,
                        "cache_control": {"type": "ephemeral"},
                    }
                ],
                messages=[
                    {"role": "user", "content": _user_prompt(product, fields)}
                ],
            )
            text = "".join(
                block.text for block in msg.content if getattr(block, "type", None) == "text"
            ).strip()
            data = _extract_json(text)
            return EnrichmentResult.model_validate(data)
        except (APIError, json.JSONDecodeError, ValueError) as exc:
            last_error = exc
            log.warning("enrichment attempt %d failed: %s", attempt, exc)
            await asyncio.sleep(min(2**attempt, 8))
    raise EnrichmentError(f"enrichment failed after {max_attempts} attempts: {last_error}")


def _extract_json(text: str) -> dict:
    """Be lenient: trim code fences if the model wrapped them."""
    t = text.strip()
    if t.startswith("```"):
        t = t.strip("`")
        if t.lower().startswith("json"):
            t = t[4:]
    start = t.find("{")
    end = t.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("no JSON object in model response")
    return json.loads(t[start : end + 1])


def _offline_enrichment(product: Product) -> EnrichmentResult:
    cat = product.category if product.category in CATEGORIES else CATEGORIES[0]
    desc = (
        f"{product.brand or 'House brand'} {product.name.split(' - ', 1)[0].lower()}. "
        f"A staple from our {cat.lower()} aisle."
    )
    tags = ["everyday", cat.lower().replace(" ", "-"), "in-stock"]
    return EnrichmentResult(description=desc, tags=tags, category=cat)
