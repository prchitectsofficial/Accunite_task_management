from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Callable, Iterable
from urllib.parse import parse_qs, urlparse

import httpx
from playwright.async_api import Browser, Page
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.blog_page import BlogPage
from app.models.commercial_site import CommercialSite
from app.models.crawl_run import CommercialLink, CrawlCursor, utc_now
from app.utils.html_parser import (
    ExtractedLink,
    extract_outbound_links_from_editorial_html,
    extract_published_at_utc,
    iter_candidate_article_urls,
    parse_meta_title_description,
)
from app.utils.url_utils import extract_domain, normalize_url


NON_COMMERCIAL_DOMAINS = {
    "facebook.com",
    "twitter.com",
    "x.com",
    "instagram.com",
    "youtube.com",
    "tiktok.com",
    "linkedin.com",
    "pinterest.com",
    "wikipedia.org",
    "github.com",
    "medium.com",
    "substack.com",
    "apple.com",
    "google.com",
}

AFFILIATE_NETWORK_DOMAINS = {
    "impact.com",
    "linksynergy.com",
    "awin1.com",
    "shareasale.com",
    "cj.com",
    "anrdoezrs.net",
    "partnerize.com",
    "rakutenadvertising.com",
}

CASINO_KEYWORDS = ("casino", "bet", "poker", "sportsbook", "slot", "roulette", "blackjack")
COMMERCIAL_KEYWORDS = (
    "buy",
    "pricing",
    "plans",
    "shop",
    "order",
    "sale",
    "coupon",
    "discount",
    "deal",
    "official site",
    "subscribe",
    "trial",
)


@dataclass(frozen=True)
class DiscoveryResult:
    urls: list[str]
    discovered_via: str
    homepage_failed: bool


def _is_likely_article_url(blog_domain: str, url: str) -> bool:
    try:
        p = urlparse(url)
    except Exception:
        return False
    if not p.scheme.startswith("http"):
        return False
    d = extract_domain(url)
    if d != blog_domain and not d.endswith("." + blog_domain):
        return False

    path = (p.path or "").lower()
    if path in ("", "/"):
        return False

    # Common non-article sections
    bad_parts = (
        "/tag/",
        "/tags/",
        "/category/",
        "/categories/",
        "/author/",
        "/about",
        "/contact",
        "/privacy",
        "/terms",
        "/login",
        "/signup",
        "/subscribe",
        "/newsletter",
        "/feed",
        "/wp-admin",
        "/wp-login",
        "/search",
    )
    if any(part in path for part in bad_parts):
        return False

    # WordPress common patterns /yyyy/mm/dd/slug
    if re.search(r"/20\d{2}/\d{2}/\d{2}/", path):
        return True
    if re.search(r"/20\d{2}/\d{2}/", path):
        return True

    # Slug-like paths (at least 2 segments, not too short)
    segs = [s for s in path.split("/") if s]
    if len(segs) >= 2 and len(segs[-1]) >= 6:
        return True
    return False


async def _page_goto(page: Page, url: str, *, wait_until: str, timeout_ms: int) -> str:
    await page.goto(url, wait_until=wait_until, timeout=timeout_ms)
    return await page.content()


async def discover_article_urls(browser: Browser, *, blog_url: str, blog_domain: str) -> DiscoveryResult:
    settings = get_settings()
    homepage_failed = False

    # 1) Homepage discovery
    try:
        context = await browser.new_context()
        page = await context.new_page()
        html = await _page_goto(page, blog_url, wait_until="domcontentloaded", timeout_ms=settings.PLAYWRIGHT_NAV_TIMEOUT_MS)
        await context.close()

        candidates = list(iter_candidate_article_urls(base_url=blog_url, html=html))
        urls = [normalize_url(u) for u in candidates if _is_likely_article_url(blog_domain, u)]
        # If homepage yields too few, attempt fallback as well (sitemap-only sites)
        if len(urls) >= 5:
            return DiscoveryResult(urls=_dedupe_keep_order(urls), discovered_via="homepage", homepage_failed=False)
    except Exception:
        homepage_failed = True

    # 2) Fallback discovery MUST run if homepage fetch fails
    # 2a) JS-settled extraction
    js_urls: list[str] = []
    try:
        context = await browser.new_context()
        page = await context.new_page()
        html = await _page_goto(page, blog_url, wait_until="networkidle", timeout_ms=settings.PLAYWRIGHT_NAV_TIMEOUT_MS)
        # small settle
        await asyncio.sleep(1.0)
        await context.close()
        candidates = list(iter_candidate_article_urls(base_url=blog_url, html=html))
        js_urls = [normalize_url(u) for u in candidates if _is_likely_article_url(blog_domain, u)]
    except Exception:
        js_urls = []

    # 2b) Sitemap discovery
    sitemap_urls = await discover_from_sitemaps(blog_url=blog_url, blog_domain=blog_domain)

    merged = _dedupe_keep_order(js_urls + sitemap_urls)
    return DiscoveryResult(urls=merged, discovered_via="fallback", homepage_failed=homepage_failed)


async def discover_from_sitemaps(*, blog_url: str, blog_domain: str) -> list[str]:
    settings = get_settings()
    base = normalize_url(blog_url)
    p = urlparse(base)
    root = f"{p.scheme}://{p.netloc}"

    candidates = [
        f"{root}/sitemap.xml",
        f"{root}/sitemap_index.xml",
        f"{root}/sitemap-index.xml",
        f"{root}/sitemap/news.xml",
        f"{root}/sitemap-news.xml",
    ]

    out: list[str] = []
    seen_sitemaps: set[str] = set()
    to_fetch = candidates[:]

    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True, headers={"User-Agent": "BlogLeadIntel/1.0"}) as client:
        while to_fetch and len(seen_sitemaps) < settings.CRAWLER_SITEMAP_MAX_FILES and len(out) < settings.CRAWLER_SITEMAP_MAX_URLS:
            sm_url = to_fetch.pop(0)
            if sm_url in seen_sitemaps:
                continue
            seen_sitemaps.add(sm_url)
            try:
                resp = await client.get(sm_url)
                if resp.status_code >= 400:
                    continue
                xml = resp.text
            except Exception:
                continue

            # Parse sitemap (index or urlset)
            from bs4 import BeautifulSoup

            soup = BeautifulSoup(xml, "xml")
            locs = [loc.get_text(strip=True) for loc in soup.find_all("loc")]
            # If looks like sitemap index, enqueue nested sitemaps
            if any(l.endswith(".xml") for l in locs) and soup.find("sitemapindex"):
                for l in locs:
                    if l.endswith(".xml") and l not in seen_sitemaps:
                        to_fetch.append(l)
                continue

            # URL set
            for l in locs:
                u = normalize_url(l)
                if _is_likely_article_url(blog_domain, u):
                    out.append(u)
                if len(out) >= settings.CRAWLER_SITEMAP_MAX_URLS:
                    break

    return _dedupe_keep_order(out)


def _dedupe_keep_order(urls: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for u in urls:
        if not u or u in seen:
            continue
        seen.add(u)
        out.append(u)
    return out


def _affiliate_signal(link: ExtractedLink) -> bool:
    d = link.target_domain
    if d in AFFILIATE_NETWORK_DOMAINS or any(d.endswith("." + x) for x in AFFILIATE_NETWORK_DOMAINS):
        return True
    qs = parse_qs(urlparse(link.target_url).query)
    keys = {k.lower() for k in qs.keys()}
    affiliate_keys = {"aff", "affiliate", "ref", "refid", "tag", "subid", "clickid", "irclickid", "utm_source"}
    return any(k in keys for k in affiliate_keys)


def _is_non_commercial_domain(domain: str) -> bool:
    return domain in NON_COMMERCIAL_DOMAINS or any(domain.endswith("." + d) for d in NON_COMMERCIAL_DOMAINS)


def _casino_signal(domain: str, title: str | None, desc: str | None) -> bool:
    hay = " ".join([domain, title or "", desc or ""]).lower()
    return any(k in hay for k in CASINO_KEYWORDS)


def _commercial_signal(domain: str, title: str | None, desc: str | None) -> bool:
    hay = " ".join([domain, title or "", desc or ""]).lower()
    return any(k in hay for k in COMMERCIAL_KEYWORDS)


async def _fetch_site_meta(domain: str) -> tuple[str | None, str | None]:
    url = f"https://{domain}/"
    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True, headers={"User-Agent": "BlogLeadIntel/1.0"}) as client:
        try:
            resp = await client.get(url)
            if resp.status_code >= 400:
                return None, None
            return parse_meta_title_description(resp.text)
        except Exception:
            return None, None


async def get_or_create_commercial_site(db: AsyncSession, domain: str) -> CommercialSite:
    q = await db.execute(select(CommercialSite).where(CommercialSite.domain == domain))
    existing = q.scalar_one_or_none()
    if existing:
        return existing
    title, desc = await _fetch_site_meta(domain)
    site = CommercialSite(domain=domain, meta_title=title, meta_description=desc, is_casino=_casino_signal(domain, title, desc))
    db.add(site)
    await db.flush()
    return site


async def get_or_create_blog_page(
    db: AsyncSession,
    *,
    blog_id: str,
    url: str,
    discovered_via: str,
) -> BlogPage:
    q = await db.execute(select(BlogPage).where(BlogPage.blog_id == blog_id, BlogPage.url == url))
    existing = q.scalar_one_or_none()
    if existing:
        return existing
    page = BlogPage(blog_id=blog_id, url=url, discovered_via=discovered_via, discovered_at=utc_now(), fetch_status="queued")
    db.add(page)
    await db.flush()
    return page


async def crawl_blog(
    *,
    browser: Browser,
    db: AsyncSession,
    cursor: CrawlCursor,
    blog_domain: str,
    blog_url: str,
    page_limit: int,
    cutoff_utc: datetime,
    should_pause: Callable[[], bool],
) -> None:
    """
    Crawl a single blog within one crawl run.
    Enforces page_limit and skips pages older than cutoff_utc if published date is known.
    """
    settings = get_settings()

    # Restore queue from cursor state_json if present
    queue: list[str] = []
    processed = 0
    if cursor.state_json:
        try:
            import json

            state = json.loads(cursor.state_json)
            queue = [str(u) for u in state.get("queue", []) if u]
            processed = int(state.get("processed", 0))
        except Exception:
            queue = []
            processed = 0

    if not queue:
        discovery = await discover_article_urls(browser, blog_url=blog_url, blog_domain=blog_domain)
        queue = discovery.urls[: max(page_limit, 0)]
        processed = 0
        cursor.pages_queued = len(queue)
        cursor.state_json = _dump_state(queue=queue, processed=processed)
        await db.commit()

    sem = asyncio.Semaphore(settings.CRAWLER_MAX_PAGE_CONCURRENCY)

    async def _process_one(url: str) -> None:
        nonlocal cursor
        async with sem:
            # Pause loop keeps browser open
            while should_pause():
                await asyncio.sleep(0.5)

            context = await browser.new_context()
            page = await context.new_page()
            try:
                html = await _page_goto(page, url, wait_until="domcontentloaded", timeout_ms=settings.PLAYWRIGHT_NAV_TIMEOUT_MS)
                published_at = extract_published_at_utc(html)
                if published_at and published_at < cutoff_utc:
                    await context.close()
                    return

                title, desc = parse_meta_title_description(html)
                blog_page = await get_or_create_blog_page(db, blog_id=cursor.blog_id, url=url, discovered_via="discovered")
                blog_page.fetched_at = utc_now()
                blog_page.fetch_status = "fetched"
                blog_page.is_article = True
                blog_page.title = title
                blog_page.meta_description = desc
                blog_page.published_at = published_at

                links = extract_outbound_links_from_editorial_html(page_url=url, blog_domain=blog_domain, html=html)
                for link in links:
                    if _is_non_commercial_domain(link.target_domain):
                        continue
                    is_aff = _affiliate_signal(link)
                    is_paid = link.is_sponsored

                    site = await get_or_create_commercial_site(db, link.target_domain)
                    is_commercial = is_aff or is_paid or _commercial_signal(site.domain, site.meta_title, site.meta_description)

                    if not is_commercial:
                        continue

                    cl = CommercialLink(
                        crawl_run_id=cursor.crawl_run_id,
                        blog_id=cursor.blog_id,
                        blog_page_id=blog_page.id,
                        commercial_site_id=site.id,
                        source_url=link.source_url,
                        target_url=link.target_url,
                        anchor_text=link.anchor_text,
                        is_dofollow=link.is_dofollow,
                        is_affiliate=is_aff,
                        is_paid=is_paid,
                        is_commercial=is_commercial,
                    )
                    db.add(cl)
                    cursor.commercial_links_found += 1

                cursor.pages_crawled += 1
                await db.commit()
            finally:
                await context.close()

    # Process in chunks while respecting page_limit
    urls_to_process = queue[processed : processed + max(0, page_limit - cursor.pages_crawled)]
    for url in urls_to_process:
        # Pause-aware scheduling
        while should_pause():
            await asyncio.sleep(0.5)
        await _process_one(url)
        processed += 1
        cursor.state_json = _dump_state(queue=queue, processed=processed)
        await db.commit()
        if cursor.pages_crawled >= page_limit:
            break


def _dump_state(*, queue: list[str], processed: int) -> str:
    import json

    return json.dumps({"queue": queue, "processed": processed}, separators=(",", ":"))

