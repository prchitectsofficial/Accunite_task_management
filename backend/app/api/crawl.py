from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.crawler_manager import crawler_manager


AllowedPageLimit = Literal[30, 50, 80, 100, 140, 170, 200]
AllowedMonthLimit = Literal[1, 3, 6, 9, 12]


class CrawlStartRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    task_name: str = Field(..., description="Task Name (mandatory)")
    blog_urls: list[str] = Field(..., min_length=1, description="List of blog URLs/domains")

    # UI is mandatory; backend fallback defaults if omitted.
    page_limit: AllowedPageLimit = 200
    month_limit: AllowedMonthLimit = 12

    @field_validator("task_name")
    @classmethod
    def _task_name_not_empty(cls, v: str) -> str:
        if v is None:
            raise ValueError("task_name_required")
        if v == "":
            raise ValueError("task_name_required")
        if v.strip() == "":
            raise ValueError("task_name_required")
        return v  # saved exactly as entered


class CrawlStartResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    crawl_run_id: str


class SimpleStatusResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    status: str


router = APIRouter(prefix="/crawl", tags=["crawl"])


@router.post("/start", response_model=CrawlStartResponse)
async def start_crawl(payload: CrawlStartRequest, db: AsyncSession = Depends(get_db)) -> CrawlStartResponse:
    run = await crawler_manager.create_run(
        db,
        task_name=payload.task_name,
        blog_urls=payload.blog_urls,
        page_limit=payload.page_limit,
        month_limit=payload.month_limit,
    )
    await crawler_manager.start_run(db, run.id)
    return CrawlStartResponse(crawl_run_id=run.id)


@router.post("/{crawl_run_id}/pause", response_model=SimpleStatusResponse)
async def pause_crawl(crawl_run_id: str, db: AsyncSession = Depends(get_db)) -> SimpleStatusResponse:
    try:
        await crawler_manager.pause_run(db, crawl_run_id)
        return SimpleStatusResponse(status="paused")
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.post("/{crawl_run_id}/resume", response_model=SimpleStatusResponse)
async def resume_crawl(crawl_run_id: str, db: AsyncSession = Depends(get_db)) -> SimpleStatusResponse:
    try:
        await crawler_manager.resume_run(db, crawl_run_id)
        return SimpleStatusResponse(status="running")
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.get("/{crawl_run_id}", response_model=SimpleStatusResponse)
async def get_crawl_status(crawl_run_id: str, db: AsyncSession = Depends(get_db)) -> SimpleStatusResponse:
    run = await crawler_manager.get_run(db, crawl_run_id)
    if not run:
        raise HTTPException(status_code=404, detail="crawl_run_not_found")
    return SimpleStatusResponse(status=run.status)

