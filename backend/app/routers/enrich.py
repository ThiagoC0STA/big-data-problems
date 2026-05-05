"""Enrichment job endpoints with SSE streaming."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from secrets import token_urlsafe

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ..ai import EnrichmentError, enrich_product
from ..db import get_session, session_factory
from ..repository import ProductRepository
from ..schemas import EnrichmentJob, EnrichmentJobRequest, SSEEnrichmentEvent
from ..sse import SSE_HEADERS, encode_comment, encode_event

log = logging.getLogger("granary.enrich")

router = APIRouter(prefix="/enrich", tags=["enrich"])

_jobs: dict[str, EnrichmentJob] = {}
_queues: dict[str, asyncio.Queue[SSEEnrichmentEvent | None]] = {}
_lock = asyncio.Lock()


def _now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


@router.post("", response_model=EnrichmentJob)
async def create_job(
    request: EnrichmentJobRequest,
    session: AsyncSession = Depends(get_session),
) -> EnrichmentJob:
    repo = ProductRepository(session)
    valid_ids: list[str] = []
    for pid in request.product_ids:
        if await repo.get(pid) is not None:
            valid_ids.append(pid)
    if not valid_ids:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "no_valid_products",
                "message": "None of the requested products exist.",
                "retryable": False,
            },
        )

    job_id = f"job_{token_urlsafe(10)}"
    job = EnrichmentJob(
        id=job_id,
        product_ids=valid_ids,
        status="queued",
        total=len(valid_ids),
        processed=0,
        succeeded=0,
        failed=0,
        started_at=None,
        completed_at=None,
        error_message=None,
    )
    async with _lock:
        _jobs[job_id] = job
        _queues[job_id] = asyncio.Queue()

    asyncio.create_task(_run_job(job_id, request.fields))
    return job


@router.get("/{job_id}", response_model=EnrichmentJob)
async def get_job(job_id: str) -> EnrichmentJob:
    job = _jobs.get(job_id)
    if job is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "not_found", "message": "Job not found.", "retryable": False},
        )
    return job


@router.get("/{job_id}/stream")
async def stream_job(job_id: str):
    if job_id not in _jobs:
        raise HTTPException(
            status_code=404,
            detail={"code": "not_found", "message": "Job not found.", "retryable": False},
        )

    async def gen() -> AsyncIterator[bytes]:
        snapshot = _jobs.get(job_id)
        if snapshot is not None:
            yield encode_event(
                SSEEnrichmentEvent(
                    type="progress",
                    job_id=job_id,
                    processed=snapshot.processed,
                    total=snapshot.total,
                ),
                event="progress",
            ).encode()

        queue = _queues.get(job_id)
        if queue is None:
            return

        keepalive_secs = 15.0
        while True:
            try:
                ev = await asyncio.wait_for(queue.get(), timeout=keepalive_secs)
            except asyncio.TimeoutError:
                yield encode_comment("ping").encode()
                continue
            if ev is None:
                break
            yield encode_event(ev, event=ev.type).encode()

    return StreamingResponse(gen(), headers=SSE_HEADERS, media_type="text/event-stream")


# --------------------------------------------------------------------------- worker


async def _run_job(job_id: str, fields: list[str]) -> None:
    queue = _queues[job_id]
    job = _jobs[job_id].model_copy(update={"status": "running", "started_at": _now_iso()})
    _jobs[job_id] = job

    succeeded = 0
    failed = 0
    processed = 0
    error_message: str | None = None

    try:
        async with session_factory() as session:
            repo = ProductRepository(session)
            for pid in job.product_ids:
                product = await repo.get(pid)
                if product is None:
                    failed += 1
                    processed += 1
                    await queue.put(
                        SSEEnrichmentEvent(
                            type="error",
                            job_id=job_id,
                            product_id=pid,
                            message="Product missing.",
                        )
                    )
                    continue

                current = product.model_copy(update={"enrichment_status": "running"})
                await repo.replace(current)
                try:
                    result = await enrich_product(product, fields=fields)
                except EnrichmentError as exc:
                    failed += 1
                    processed += 1
                    await repo.replace(
                        product.model_copy(update={"enrichment_status": "failed"})
                    )
                    await queue.put(
                        SSEEnrichmentEvent(
                            type="error",
                            job_id=job_id,
                            product_id=pid,
                            message=str(exc),
                        )
                    )
                    _jobs[job_id] = _jobs[job_id].model_copy(
                        update={"failed": failed, "processed": processed}
                    )
                    continue

                update: dict = {"enrichment_status": "enriched"}
                if "description" in fields and result.description:
                    update["description"] = result.description
                if "tags" in fields and result.tags:
                    update["tags"] = result.tags
                if "category" in fields and result.category:
                    update["category"] = result.category

                new_product = product.model_copy(update=update)
                await repo.replace(new_product)

                succeeded += 1
                processed += 1
                _jobs[job_id] = _jobs[job_id].model_copy(
                    update={"succeeded": succeeded, "processed": processed}
                )
                await queue.put(
                    SSEEnrichmentEvent(
                        type="product_updated",
                        job_id=job_id,
                        product_id=pid,
                        product=new_product,
                        processed=processed,
                        total=job.total,
                    )
                )
                await asyncio.sleep(0.05)
    except Exception as exc:  # noqa: BLE001
        error_message = str(exc)
        log.exception("job %s crashed", job_id)
    finally:
        final_status = "completed" if error_message is None else "failed"
        _jobs[job_id] = _jobs[job_id].model_copy(
            update={
                "status": final_status,
                "completed_at": _now_iso(),
                "error_message": error_message,
                "succeeded": succeeded,
                "failed": failed,
                "processed": processed,
            }
        )
        await queue.put(
            SSEEnrichmentEvent(
                type="complete",
                job_id=job_id,
                processed=processed,
                total=job.total,
                message=error_message,
            )
        )
        await queue.put(None)
