"""Async database engine and session factory.

The engine is module-scoped: created once at import, disposed in main.py's
shutdown hook. Sessions are short-lived and request-scoped via FastAPI DI.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

import ssl
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from .config import settings


def _build_engine_args(url: str) -> tuple[str, dict]:
    parsed = urlparse(url)
    params = parse_qs(parsed.query)
    sslmode = params.pop("sslmode", ["disable"])[0]
    params.pop("ssl", None)
    clean_query = urlencode({k: v[0] for k, v in params.items()})
    clean_url = urlunparse(parsed._replace(query=clean_query))
    connect_args = {"ssl": ssl.create_default_context()} if sslmode in ("require", "verify-ca", "verify-full") else {}
    return clean_url, connect_args


_db_url, _connect_args = _build_engine_args(settings.database_url)

engine = create_async_engine(
    _db_url,
    connect_args=_connect_args,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    echo=False,
    future=True,
)

session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_session() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency that yields a session and rolls back on errors."""
    async with session_factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
