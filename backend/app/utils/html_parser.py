from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable
from urllib.parse import urljoin

from bs4 import BeautifulSoup
from dateutil import parser as date_parser

from app.utils.url_utils import extract_domain


@dataclass(frozen=True)
class ExtractedLink:
    source_url: str
    target_url: str
    target_domain: str
    anchor_text: str | None
    rel: str | None

    @property
    def is_dofollow(self) -> bool:
        if not self.rel:
            return True
        rel = self.rel.lower()
        return "nofollow" not in rel

    @property
    def is_sponsored(self) -> bool:
        if not self.rel:
            return False
        rel = self.rel.lower()
        return "sponsored" in rel


def parse_meta_title_description(html: str) -> tuple[str | None, str | None]:
    soup = BeautifulSoup(html, "lxml")
    title = soup.title.get_text(strip=True) if soup.title else None
    desc_tag = soup.find("meta", attrs={"name": "description"}) or soup.find("meta", attrs={"property": "og:description"})
    desc = None
    if desc_tag and desc_tag.get("content"):
        desc = str(desc_tag.get("content")).strip()
    return title, desc


def extract_published_at_utc(html: str) -> datetime | None:
    soup = BeautifulSoup(html, "lxml")
    # Common meta tags
    for meta_key in ("article:published_time", "og:published_time"):
        tag = soup.find("meta", attrs={"property": meta_key})
        if tag and tag.get("content"):
            try:
                dt = date_parser.parse(str(tag.get("content")))
                return dt.astimezone(timezone.utc)
            except Exception:
                continue
    # <time datetime="...">
    time_tag = soup.find("time")
    if time_tag and time_tag.get("datetime"):
        try:
            dt = date_parser.parse(str(time_tag.get("datetime")))
            return dt.astimezone(timezone.utc)
        except Exception:
            return None
    return None


def _best_content_root(soup: BeautifulSoup) -> BeautifulSoup:
    article = soup.find("article")
    if article:
        return article
    # Heuristic: pick the element with the most text among common containers
    candidates: list[BeautifulSoup] = []
    for tag in ("main", "section", "div"):
        candidates.extend(soup.find_all(tag))
    if not candidates:
        return soup.body or soup
    best = max(candidates, key=lambda el: len(el.get_text(" ", strip=True)))
    return best


def extract_outbound_links_from_editorial_html(*, page_url: str, blog_domain: str, html: str) -> list[ExtractedLink]:
    soup = BeautifulSoup(html, "lxml")
    root = _best_content_root(soup)

    out: list[ExtractedLink] = []
    for a in root.find_all("a"):
        href = a.get("href")
        if not href:
            continue
        href = str(href).strip()
        if href.startswith(("#", "mailto:", "tel:", "javascript:")):
            continue
        target_url = urljoin(page_url, href)
        target_domain = extract_domain(target_url)
        if not target_domain:
            continue

        # Outbound only
        if target_domain == blog_domain or target_domain.endswith("." + blog_domain):
            continue

        anchor = a.get_text(" ", strip=True) or None
        rel = " ".join(a.get("rel") or []) if isinstance(a.get("rel"), list) else (a.get("rel") or None)
        out.append(
            ExtractedLink(
                source_url=page_url,
                target_url=target_url,
                target_domain=target_domain,
                anchor_text=anchor,
                rel=rel,
            )
        )
    return out


def iter_candidate_article_urls(*, base_url: str, html: str) -> Iterable[str]:
    soup = BeautifulSoup(html, "lxml")
    for a in soup.find_all("a"):
        href = a.get("href")
        if not href:
            continue
        href = str(href).strip()
        if href.startswith(("#", "mailto:", "tel:", "javascript:")):
            continue
        yield urljoin(base_url, href)

