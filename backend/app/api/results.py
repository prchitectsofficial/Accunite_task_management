from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.crawl_run import CommercialLink, CrawlCursor, CrawlRun


class RunSummaryResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    crawl_run_id: str
    task_name: str
    status: str
    page_limit: int
    month_limit: int
    blogs_total: int
    blogs_reused_from_history: int
    pages_crawled_total: int
    commercial_links_total: int


router = APIRouter(prefix="/results", tags=["results"])


@router.get("/{crawl_run_id}/summary", response_model=RunSummaryResponse)
async def run_summary(crawl_run_id: str, db: AsyncSession = Depends(get_db)) -> RunSummaryResponse:
    run = await db.get(CrawlRun, crawl_run_id)
    if not run:
        raise HTTPException(status_code=404, detail="crawl_run_not_found")

    q1 = await db.execute(select(func.count()).select_from(CrawlCursor).where(CrawlCursor.crawl_run_id == crawl_run_id))
    blogs_total = int(q1.scalar_one())

    q2 = await db.execute(
        select(func.count())
        .select_from(CrawlCursor)
        .where(CrawlCursor.crawl_run_id == crawl_run_id, CrawlCursor.reused_from_crawl_run_id.is_not(None))
    )
    blogs_reused = int(q2.scalar_one())

    q3 = await db.execute(
        select(func.coalesce(func.sum(CrawlCursor.pages_crawled), 0)).where(CrawlCursor.crawl_run_id == crawl_run_id)
    )
    pages_crawled_total = int(q3.scalar_one())

    q4 = await db.execute(
        select(func.count()).select_from(CommercialLink).where(CommercialLink.crawl_run_id == crawl_run_id)
    )
    commercial_links_total = int(q4.scalar_one())

    return RunSummaryResponse(
        crawl_run_id=run.id,
        task_name=run.task_name,
        status=run.status,
        page_limit=run.page_limit,
        month_limit=run.month_limit,
        blogs_total=blogs_total,
        blogs_reused_from_history=blogs_reused,
        pages_crawled_total=pages_crawled_total,
        commercial_links_total=commercial_links_total,
    )

