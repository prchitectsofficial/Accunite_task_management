from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from playwright.async_api import Browser, Playwright, async_playwright
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.blog import Blog
from app.models.crawl_run import CrawlCursor, CrawlRun, utc_now
from app.utils.url_utils import extract_domain, normalize_url


@dataclass
class ActiveCrawl:
    run_id: str
    status: str  # queued|running|paused|completed|failed
    created_at: datetime


class CrawlerManager:
    """
    CRITICAL:
    - Crawl logic lives ONLY here.
    - In-memory state stored in crawler_manager.active_crawls
    """

    def __init__(self) -> None:
        self.active_crawls: dict[str, ActiveCrawl] = {}
        self._playwright: Playwright | None = None
        self._browser: Browser | None = None
        self._run_tasks: dict[str, asyncio.Task[None]] = {}

    async def startup(self) -> None:
        settings = get_settings()
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(headless=settings.PLAYWRIGHT_HEADLESS)

    async def shutdown(self) -> None:
        for t in list(self._run_tasks.values()):
            t.cancel()
        self._run_tasks.clear()
        if self._browser:
            await self._browser.close()
        if self._playwright:
            await self._playwright.stop()

    async def create_run(
        self,
        db: AsyncSession,
        *,
        task_name: str,
        blog_urls: list[str],
        page_limit: int,
        month_limit: int,
    ) -> CrawlRun:
        run = CrawlRun(task_name=task_name, page_limit=page_limit, month_limit=month_limit, status="queued")
        db.add(run)
        await db.flush()

        for raw_url in blog_urls:
            url = normalize_url(raw_url)
            domain = extract_domain(url)

            blog = await self._get_or_create_blog(db, url=url, domain=domain)

            cursor = CrawlCursor(
                crawl_run_id=run.id,
                blog_id=blog.id,
                status="queued",
                pages_crawled=0,
                pages_queued=0,
                commercial_links_found=0,
            )
            db.add(cursor)

        await db.commit()
        await db.refresh(run)

        self.active_crawls[run.id] = ActiveCrawl(run_id=run.id, status="queued", created_at=utc_now())
        return run

    async def start_run(self, db: AsyncSession, run_id: str) -> None:
        run = await db.get(CrawlRun, run_id)
        if not run:
            raise ValueError("crawl_run_not_found")
        if run.status in {"running", "completed"}:
            return

        run.status = "running"
        run.started_at = utc_now()
        await db.commit()

        self.active_crawls[run_id] = ActiveCrawl(run_id=run_id, status="running", created_at=utc_now())

        if run_id not in self._run_tasks:
            self._run_tasks[run_id] = asyncio.create_task(self._run_loop(run_id))

    async def pause_run(self, db: AsyncSession, run_id: str) -> None:
        run = await db.get(CrawlRun, run_id)
        if not run:
            raise ValueError("crawl_run_not_found")
        run.status = "paused"
        await db.commit()

        if run_id in self.active_crawls:
            self.active_crawls[run_id].status = "paused"

    async def resume_run(self, db: AsyncSession, run_id: str) -> None:
        run = await db.get(CrawlRun, run_id)
        if not run:
            raise ValueError("crawl_run_not_found")
        if run.status != "paused":
            return
        run.status = "running"
        await db.commit()

        if run_id in self.active_crawls:
            self.active_crawls[run_id].status = "running"
        else:
            self.active_crawls[run_id] = ActiveCrawl(run_id=run_id, status="running", created_at=utc_now())

        if run_id not in self._run_tasks:
            self._run_tasks[run_id] = asyncio.create_task(self._run_loop(run_id))

    async def get_run(self, db: AsyncSession, run_id: str) -> CrawlRun | None:
        return await db.get(CrawlRun, run_id)

    async def _get_or_create_blog(self, db: AsyncSession, *, url: str, domain: str) -> Blog:
        q = await db.execute(select(Blog).where(Blog.domain == domain))
        existing = q.scalar_one_or_none()
        if existing:
            return existing
        blog = Blog(url=url, domain=domain)
        db.add(blog)
        await db.flush()
        return blog

    def _utc_cutoff(self, month_limit: int) -> datetime:
        # Rough month window; stored/used as UTC cutoff
        now = datetime.now(timezone.utc)
        return now - timedelta(days=30 * month_limit)

    async def _run_loop(self, run_id: str) -> None:
        """
        Placeholder crawl loop.
        वास्तविक discovery/crawl/exports logic अगले step में यहीं implement होगा.
        """
        try:
            # Keep browser open; pause uses async sleep loops.
            while True:
                # If DB says paused, wait.
                await asyncio.sleep(0.5)
                # Exit early if removed from active state externally.
                active = self.active_crawls.get(run_id)
                if not active:
                    return
                if active.status == "paused":
                    continue
                # For now: mark completed immediately (will be replaced by real crawl).
                active.status = "completed"
                return
        except asyncio.CancelledError:
            return
        finally:
            self._run_tasks.pop(run_id, None)


crawler_manager = CrawlerManager()

