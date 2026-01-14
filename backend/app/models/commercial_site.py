from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.crawl_run import utc_now


class CommercialSite(Base):
    __tablename__ = "commercial_sites"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    domain: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)

    meta_title: Mapped[str | None] = mapped_column(Text, nullable=True)
    meta_description: Mapped[str | None] = mapped_column(Text, nullable=True)

    is_casino: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)

    commercial_links: Mapped[list["CommercialLink"]] = relationship(back_populates="commercial_site", cascade="all,delete-orphan")

    __table_args__ = (
        Index("ix_commercial_sites_domain", "domain"),
    )

