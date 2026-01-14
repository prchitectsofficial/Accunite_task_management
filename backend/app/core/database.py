from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


def create_engine_from_database_url() -> AsyncEngine:
    settings = get_settings()
    # CRITICAL: DB connection created only from DATABASE_URL
    return create_async_engine(settings.DATABASE_URL, pool_pre_ping=True, future=True)


engine: AsyncEngine = create_engine_from_database_url()
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session

