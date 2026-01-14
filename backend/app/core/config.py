from __future__ import annotations

from functools import lru_cache

from pydantic import ConfigDict
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_config = ConfigDict(
        extra="forbid",
        strict=True,
        case_sensitive=True,
        env_file=".env",
        env_file_encoding="utf-8",
    )

    # DB (LOCKED): DATABASE_URL is the only DB config
    DATABASE_URL: str

    # Playwright
    PLAYWRIGHT_HEADLESS: bool = True
    PLAYWRIGHT_NAV_TIMEOUT_MS: int = 45_000

    # Crawling / resource limits
    CRAWLER_MAX_BLOG_CONCURRENCY: int = 2
    CRAWLER_MAX_PAGE_CONCURRENCY: int = 6
    CRAWLER_SITEMAP_MAX_URLS: int = 5_000
    CRAWLER_SITEMAP_MAX_FILES: int = 8


@lru_cache
def get_settings() -> Settings:
    return Settings()

