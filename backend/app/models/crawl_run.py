from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def utc_now() -> datetime:
    # Store UTC timezone-aware timestamps (LOCKED)
    return datetime.now(timezone.utc)


class CrawlRun(Base):
    __tablename__ = "crawl_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    task_name: Mapped[str] = mapped_column(String(255), nullable=False)
    page_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=200)
    month_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=12)

    status: Mapped[str] = mapped_column(String(32), nullable=False, default="queued")
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    cursors: Mapped[list["CrawlCursor"]] = relationship(back_populates="crawl_run", cascade="all,delete-orphan")
    commercial_links: Mapped[list["CommercialLink"]] = relationship(back_populates="crawl_run", cascade="all,delete-orphan")


class CrawlCursor(Base):
    """
    Persisted cursor state per (crawl_run, blog).
    Used for pause/resume and history reuse.
    """

    __tablename__ = "crawl_cursors"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    crawl_run_id: Mapped[str] = mapped_column(String(36), ForeignKey("crawl_runs.id"), nullable=False, index=True)
    blog_id: Mapped[str] = mapped_column(String(36), ForeignKey("blogs.id"), nullable=False, index=True)

    status: Mapped[str] = mapped_column(String(32), nullable=False, default="queued")
    reused_from_crawl_run_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    pages_crawled: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    pages_queued: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    commercial_links_found: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # JSON-encoded lightweight state (kept simple to avoid extra deps)
    state_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now)

    crawl_run: Mapped["CrawlRun"] = relationship(back_populates="cursors")
    blog: Mapped["Blog"] = relationship(back_populates="cursors")

    __table_args__ = (
        Index("ix_crawl_cursors_run_blog", "crawl_run_id", "blog_id", unique=True),
    )


class CommercialLink(Base):
    __tablename__ = "commercial_links"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    crawl_run_id: Mapped[str] = mapped_column(String(36), ForeignKey("crawl_runs.id"), nullable=False, index=True)
    blog_id: Mapped[str] = mapped_column(String(36), ForeignKey("blogs.id"), nullable=False, index=True)
    blog_page_id: Mapped[str] = mapped_column(String(36), ForeignKey("blog_pages.id"), nullable=False, index=True)
    commercial_site_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("commercial_sites.id"), nullable=False, index=True
    )

    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    target_url: Mapped[str] = mapped_column(Text, nullable=False)
    anchor_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    is_dofollow: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Monetization signals (frozen behavior later; stored for reporting)
    is_affiliate: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_paid: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_commercial: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)

    crawl_run: Mapped["CrawlRun"] = relationship(back_populates="commercial_links")
    blog: Mapped["Blog"] = relationship(back_populates="commercial_links")
    blog_page: Mapped["BlogPage"] = relationship(back_populates="commercial_links")
    commercial_site: Mapped["CommercialSite"] = relationship(back_populates="commercial_links")

