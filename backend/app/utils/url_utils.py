from __future__ import annotations

from urllib.parse import urlparse, urlunparse


def normalize_url(url: str) -> str:
    raw = (url or "").strip()
    if not raw:
        return raw
    if not raw.startswith(("http://", "https://")):
        raw = "https://" + raw
    p = urlparse(raw)
    # Drop fragments; keep query (can matter for tracking/affiliate, detection later)
    normalized = p._replace(fragment="")
    return urlunparse(normalized)


def extract_domain(url: str) -> str:
    p = urlparse(url)
    host = (p.hostname or "").lower()
    if host.startswith("www."):
        host = host[4:]
    return host

