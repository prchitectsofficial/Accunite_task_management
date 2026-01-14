from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.crawl_run import CrawlRun


class CrawlRunListItem(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    id: str
    task_name: str
    status: str
    page_limit: int
    month_limit: int
    created_at: str
    started_at: str | None
    finished_at: str | None


class CrawlRunListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    items: list[CrawlRunListItem]


router = APIRouter(prefix="/history", tags=["history"])


@router.get("/runs", response_model=CrawlRunListResponse)
async def list_runs(db: AsyncSession = Depends(get_db)) -> CrawlRunListResponse:
    q = await db.execute(select(CrawlRun).order_by(desc(CrawlRun.created_at)).limit(200))
    runs = q.scalars().all()
    return CrawlRunListResponse(
        items=[
            CrawlRunListItem(
                id=r.id,
                task_name=r.task_name,
                status=r.status,
                page_limit=r.page_limit,
                month_limit=r.month_limit,
                created_at=r.created_at.isoformat(),
                started_at=r.started_at.isoformat() if r.started_at else None,
                finished_at=r.finished_at.isoformat() if r.finished_at else None,
            )
            for r in runs
        ]
    )

