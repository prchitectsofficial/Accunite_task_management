from __future__ import annotations

from fastapi import FastAPI

from app.api.crawl import router as crawl_router
from app.api.history import router as history_router
from app.api.results import router as results_router
from app.core.database import Base, engine
from app.models import blog  # noqa: F401
from app.models import blog_page  # noqa: F401
from app.models import commercial_site  # noqa: F401
from app.models import crawl_run  # noqa: F401
from app.services.crawler_manager import crawler_manager


app = FastAPI(title="Blog Lead Intelligence", version="1.0.0")


@app.on_event("startup")
async def _startup() -> None:
    # Create tables (MySQL) if missing; migrations can be added later.
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await crawler_manager.startup()


@app.on_event("shutdown")
async def _shutdown() -> None:
    await crawler_manager.shutdown()


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(crawl_router, prefix="/api")
app.include_router(history_router, prefix="/api")
app.include_router(results_router, prefix="/api")

