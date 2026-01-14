from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.crawl_run import utc_now


class Blog(Base):
    __tablename__ = "blogs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    url: Mapped[str] = mapped_column(Text, nullable=False)
    domain: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    last_attempted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_success_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    pages: Mapped[list["BlogPage"]] = relationship(back_populates="blog", cascade="all,delete-orphan")
    cursors: Mapped[list["CrawlCursor"]] = relationship(back_populates="blog", cascade="all,delete-orphan")
    commercial_links: Mapped[list["CommercialLink"]] = relationship(back_populates="blog", cascade="all,delete-orphan")

    __table_args__ = (
        Index("ix_blogs_domain_url", "domain", "url"),
    )

