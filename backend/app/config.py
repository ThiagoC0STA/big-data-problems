"""Runtime configuration. Read once at module import."""

from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    database_url: str
    anthropic_api_key: str | None
    anthropic_model: str
    cors_origins: list[str]
    seed: int
    catalog_size: int
    defect_rate: float
    log_level: str

    @classmethod
    def from_env(cls) -> "Settings":
        origins_raw = os.getenv(
            "CORS_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000",
        )
        return cls(
            database_url=os.getenv(
                "DATABASE_URL",
                "postgresql+asyncpg://granary:granary@localhost:5432/granary",
            ),
            anthropic_api_key=os.getenv("ANTHROPIC_API_KEY"),
            anthropic_model=os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-5"),
            cors_origins=[o.strip() for o in origins_raw.split(",") if o.strip()],
            seed=int(os.getenv("CATALOG_SEED", "1337")),
            catalog_size=int(os.getenv("CATALOG_SIZE", "100000")),
            defect_rate=float(os.getenv("CATALOG_DEFECT_RATE", "0.18")),
            log_level=os.getenv("LOG_LEVEL", "INFO"),
        )


settings = Settings.from_env()


def sync_database_url(url: str) -> str:
    """Convert an asyncpg URL into a sync (psycopg2) URL for Alembic."""
    if url.startswith("postgresql+asyncpg://"):
        return url.replace("postgresql+asyncpg://", "postgresql+psycopg2://", 1)
    return url
