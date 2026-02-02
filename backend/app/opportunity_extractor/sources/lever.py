from __future__ import annotations

import hashlib
from datetime import datetime
from typing import Any, Optional

import httpx

from ..types import ExtractedOpportunity, ProfileSignals
from ..utils import safe_excerpt
from .base import OpportunitySource


class LeverSource(OpportunitySource):
    """Fetch jobs from Lever-hosted career pages via their public JSON API.

    Endpoint:
      https://api.lever.co/v0/postings/{company}?mode=json

    Configure with a list of Lever company shortnames.
    """

    name = "lever"

    def __init__(self, companies: list[str], *, timeout_s: float = 12.0):
        self._companies = [c.strip() for c in companies if c.strip()]
        self._timeout_s = timeout_s

    async def fetch(self, profile: ProfileSignals) -> list[ExtractedOpportunity]:
        if not self._companies:
            return []

        results: list[ExtractedOpportunity] = []
        async with httpx.AsyncClient(timeout=self._timeout_s, follow_redirects=True) as client:
            for company in self._companies:
                url = f"https://api.lever.co/v0/postings/{company}"
                resp = await client.get(url, params={"mode": "json"})
                if resp.status_code >= 400:
                    continue
                items = resp.json() if resp.content else []
                if not isinstance(items, list):
                    continue
                for it in items:
                    op = _to_op(company, it)
                    if op is not None:
                        results.append(op)
        return results


def _parse_dt(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    try:
        # Lever uses ms timestamps in some fields
        if isinstance(value, (int, float)):
            return datetime.utcfromtimestamp(float(value) / 1000.0)
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


def _to_op(company: str, it: dict) -> Optional[ExtractedOpportunity]:
    title = str(it.get("text") or it.get("title") or "").strip()
    if not title:
        return None

    host = str(it.get("hostedUrl") or it.get("hosted_url") or "").strip()
    apply_url = str(it.get("applyUrl") or it.get("apply_url") or "").strip()
    url = host or apply_url
    if not url:
        return None

    loc = it.get("categories", {}).get("location") if isinstance(it.get("categories"), dict) else ""
    location = str(loc or "").strip()

    team = it.get("categories", {}).get("team") if isinstance(it.get("categories"), dict) else ""
    category = str(team or "").strip()

    desc = str(it.get("descriptionPlain") or it.get("description") or "")

    kind = "Other"
    low = f"{title} {category}".lower()
    if "intern" in low:
        kind = "Internship"
    elif "hackathon" in low:
        kind = "Hackathon"
    elif any(k in low for k in ["workshop", "bootcamp", "training"]):
        kind = "Workshop"
    elif any(k in low for k in ["graduate", "junior", "entry", "fresher"]):
        kind = "Full-time"

    published_at = _parse_dt(it.get("createdAt") or it.get("created_at"))

    h = hashlib.sha1(url.encode("utf-8")).hexdigest()[:10]

    tags: list[str] = []
    if category:
        tags.append(category)

    return ExtractedOpportunity(
        id=f"lever-{company}-{h}",
        title=title,
        company=company,
        kind=kind,  # type: ignore[arg-type]
        location=location,
        source=f"Company Careers (Lever:{company})",
        source_url=url,
        published_at=published_at,
        deadline=None,
        excerpt=safe_excerpt(desc, limit=220),
        tags=tags,
    )
