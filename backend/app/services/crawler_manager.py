from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from playwright.async_api import Browser, Playwright, async_playwright
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.crawlers.blog_crawler import crawl_blog
from app.models.blog import Blog
from app.models.crawl_run import CommercialLink, CrawlCursor, CrawlRun, utc_now
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
        try:
            async with SessionLocal() as db:
                run = await db.get(CrawlRun, run_id)
                if not run:
                    return

                cutoff = self._utc_cutoff(run.month_limit)

                # Process each blog cursor (bounded concurrency will be added next)
                q = await db.execute(select(CrawlCursor).where(CrawlCursor.crawl_run_id == run_id))
                cursors = q.scalars().all()

                for cursor in cursors:
                    # Pause loop keeps browser open
                    while self.active_crawls.get(run_id) and self.active_crawls[run_id].status == "paused":
                        await asyncio.sleep(0.5)

                    cursor.status = "running"
                    await db.commit()

                    blog = await db.get(Blog, cursor.blog_id)
                    if not blog:
                        cursor.status = "failed"
                        await db.commit()
                        continue

                    blog_domain = blog.domain
                    blog_url = blog.url

                    # Global history reuse: if domain previously completed, reuse (skip recrawl)
                    latest_success = await self._latest_success_run_for_blog(db, blog_id=blog.id)
                    if latest_success and latest_success != run_id:
                        await self._reuse_from_history(
                            db,
                            *,
                            cursor=cursor,
                            reused_from_run_id=latest_success,
                        )
                        cursor.status = "reused"
                        await db.commit()
                        continue

                    blog.last_attempted_at = utc_now()
                    await db.commit()

                    await crawl_blog(
                        browser=self._require_browser(),
                        db=db,
                        cursor=cursor,
                        blog_domain=blog_domain,
                        blog_url=blog_url,
                        page_limit=run.page_limit,
                        cutoff_utc=cutoff,
                        should_pause=lambda: (
                            self.active_crawls.get(run_id) is not None and self.active_crawls[run_id].status == "paused"
                        ),
                    )

                    blog.last_success_at = utc_now()
                    cursor.status = "completed"
                    await db.commit()

                run.status = "completed"
                run.finished_at = utc_now()
                await db.commit()

                if run_id in self.active_crawls:
                    self.active_crawls[run_id].status = "completed"
        except asyncio.CancelledError:
            return
        except Exception as e:
            async with SessionLocal() as db:
                run = await db.get(CrawlRun, run_id)
                if run:
                    run.status = "failed"
                    run.error_message = str(e)
                    run.finished_at = utc_now()
                    await db.commit()
            if run_id in self.active_crawls:
                self.active_crawls[run_id].status = "failed"
            return
        finally:
            self._run_tasks.pop(run_id, None)

    def _require_browser(self) -> Browser:
        if not self._browser:
            raise RuntimeError("browser_not_initialized")
        return self._browser

    async def _latest_success_run_for_blog(self, db: AsyncSession, *, blog_id: str) -> str | None:
        q = await db.execute(
            select(CrawlRun.id)
            .join(CrawlCursor, CrawlCursor.crawl_run_id == CrawlRun.id)
            .where(CrawlCursor.blog_id == blog_id, CrawlRun.status == "completed")
            .order_by(desc(CrawlRun.finished_at))
            .limit(1)
        )
        return q.scalar_one_or_none()

    async def _reuse_from_history(self, db: AsyncSession, *, cursor: CrawlCursor, reused_from_run_id: str) -> None:
        # Copy commercial_links from prior run into this run for same blog
        cursor.reused_from_crawl_run_id = reused_from_run_id

        q = await db.execute(
            select(CommercialLink).where(
                CommercialLink.crawl_run_id == reused_from_run_id,
                CommercialLink.blog_id == cursor.blog_id,
            )
        )
        prior_links = q.scalars().all()
        for pl in prior_links:
            db.add(
                CommercialLink(
                    crawl_run_id=cursor.crawl_run_id,
                    blog_id=pl.blog_id,
                    blog_page_id=pl.blog_page_id,
                    commercial_site_id=pl.commercial_site_id,
                    source_url=pl.source_url,
                    target_url=pl.target_url,
                    anchor_text=pl.anchor_text,
                    is_dofollow=pl.is_dofollow,
                    is_affiliate=pl.is_affiliate,
                    is_paid=pl.is_paid,
                    is_commercial=pl.is_commercial,
                )
            )
        cursor.commercial_links_found = len(prior_links)


crawler_manager = CrawlerManager()

