from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.crawl_run import utc_now


class BlogPage(Base):
    __tablename__ = "blog_pages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    blog_id: Mapped[str] = mapped_column(String(36), ForeignKey("blogs.id"), nullable=False, index=True)

    url: Mapped[str] = mapped_column(Text, nullable=False)
    canonical_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    discovered_via: Mapped[str] = mapped_column(String(32), nullable=False, default="unknown")
    discovered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)

    # Optional recency filter input (UTC)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    fetch_status: Mapped[str] = mapped_column(String(32), nullable=False, default="queued")
    http_status: Mapped[int | None] = mapped_column(Integer, nullable=True)

    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    meta_description: Mapped[str | None] = mapped_column(Text, nullable=True)

    is_article: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    fetched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    blog: Mapped["Blog"] = relationship(back_populates="pages")
    commercial_links: Mapped[list["CommercialLink"]] = relationship(back_populates="blog_page", cascade="all,delete-orphan")

    __table_args__ = (
        Index("ix_blog_pages_blog_url", "blog_id", "url", unique=True),
    )

