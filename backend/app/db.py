"""Async database engine and session factory.

The engine is module-scoped: created once at import, disposed in main.py's
shutdown hook. Sessions are short-lived and request-scoped via FastAPI DI.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from .config import settings

engine = create_async_engine(
    settings.database_url,
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
