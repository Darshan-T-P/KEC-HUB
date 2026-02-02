from __future__ import annotations

import hashlib
from datetime import datetime
from typing import Optional

import feedparser

from ..types import ExtractedOpportunity, ProfileSignals
from ..utils import looks_closed, parse_deadline, safe_excerpt
from .base import OpportunitySource


class RssSource(OpportunitySource):
    name = "rss"

    def __init__(self, feed_urls: list[str]):
        self._feed_urls = [u.strip() for u in feed_urls if u.strip()]

    async def fetch(self, profile: ProfileSignals) -> list[ExtractedOpportunity]:
        # feedparser is sync; keep it simple for now (feeds are small)
        results: list[ExtractedOpportunity] = []
        for url in self._feed_urls:
            parsed = feedparser.parse(url)
            for entry in parsed.entries or []:
                op = _entry_to_op(url, entry)
                if op is None:
                    continue
                text = f"{op.title} {op.excerpt}"
                if looks_closed(text):
                    continue
                results.append(op)
        return results


def _to_dt(entry) -> Optional[datetime]:
    # published_parsed / updated_parsed are time.struct_time
    st = getattr(entry, "published_parsed", None) or getattr(entry, "updated_parsed", None)
    if not st:
        return None
    try:
        return datetime(*st[:6])
    except Exception:
        return None


def _entry_to_op(feed_url: str, entry) -> Optional[ExtractedOpportunity]:
    title = str(getattr(entry, "title", "") or "").strip()
    link = str(getattr(entry, "link", "") or "").strip()
    if not title or not link:
        return None

    summary = str(getattr(entry, "summary", "") or "")
    excerpt = safe_excerpt(summary, limit=220)
    published_at = _to_dt(entry)

    deadline = parse_deadline(f"{title} {summary}")

    h = hashlib.sha1(link.encode("utf-8")).hexdigest()[:10]

    return ExtractedOpportunity(
        id=f"rss-{h}",
        title=title,
        company="",
        kind="Other",  # type: ignore[arg-type]
        location="",
        source=f"RSS:{feed_url}",
        source_url=link,
        published_at=published_at,
        deadline=deadline,
        excerpt=excerpt,
        tags=[],
    )
