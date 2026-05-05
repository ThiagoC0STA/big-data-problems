"""Server-Sent Events helpers."""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator

from pydantic import BaseModel


def encode_event(data: BaseModel | dict, *, event: str | None = None) -> str:
    """Encode a Pydantic model or dict as an SSE message."""
    if isinstance(data, BaseModel):
        payload = data.model_dump(by_alias=True, exclude_none=True)
    else:
        payload = data
    body = json.dumps(payload, ensure_ascii=False)
    if event:
        return f"event: {event}\ndata: {body}\n\n"
    return f"data: {body}\n\n"


def encode_comment(text: str) -> str:
    """Encode a comment line (used for keepalives)."""
    return f": {text}\n\n"


async def with_heartbeat(
    stream: AsyncIterator[str], *, interval: float = 15.0
) -> AsyncIterator[str]:
    """Wrap a stream with periodic heartbeats."""
    queue: asyncio.Queue[str | None] = asyncio.Queue()

    async def feed():
        async for chunk in stream:
            await queue.put(chunk)
        await queue.put(None)

    task = asyncio.create_task(feed())
    try:
        while True:
            try:
                item = await asyncio.wait_for(queue.get(), timeout=interval)
            except asyncio.TimeoutError:
                yield encode_comment("ping")
                continue
            if item is None:
                break
            yield item
    finally:
        task.cancel()


SSE_HEADERS = {
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
    "Content-Type": "text/event-stream; charset=utf-8",
}
