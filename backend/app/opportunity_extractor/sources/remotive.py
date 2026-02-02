from __future__ import annotations

import hashlib
from datetime import datetime
from typing import Any, Optional

import httpx

from ..types import ExtractedOpportunity, ProfileSignals
from ..utils import safe_excerpt
from .base import OpportunitySource


class RemotiveSource(OpportunitySource):
    """Uses Remotive public API (no key) for remote jobs.

    API: https://remotive.com/api/remote-jobs
    """

    name = "remotive"

    def __init__(self, *, timeout_s: float = 12.0):
        self._timeout_s = timeout_s

    async def fetch(self, profile: ProfileSignals) -> list[ExtractedOpportunity]:
        # Use a deterministic query based on profile signals.
        base = " ".join([profile.department] + profile.skills[:5] + profile.interests[:5]).strip()
        hints = "intern junior entry graduate"
        query = f"{base} {hints}".strip() if base else hints
        params = {"search": query} if query else None

        async with httpx.AsyncClient(timeout=self._timeout_s, follow_redirects=True) as client:
            resp = await client.get("https://remotive.com/api/remote-jobs", params=params)
            resp.raise_for_status()
            payload = resp.json()

        jobs = payload.get("jobs") or []
        results: list[ExtractedOpportunity] = []
        for job in jobs:
            op = _to_op(job)
            if op is not None:
                results.append(op)
        return results


def _parse_dt(value: Any) -> Optional[datetime]:
    if not value:
        return None
    # Remotive: "2025-01-05T12:00:00"
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


def _to_op(job: dict) -> Optional[ExtractedOpportunity]:
    title = str(job.get("title") or "").strip()
    if not title:
        return None

    company = str(job.get("company_name") or "").strip() or "Unknown"
    url = str(job.get("url") or "").strip()
    if not url:
        return None

    location = str(job.get("candidate_required_location") or "Remote").strip()
    category = str(job.get("category") or "Other").strip()

    kind = "Other"
    low = f"{title} {category}".lower()
    if "intern" in low:
        kind = "Internship"
    elif "hackathon" in low:
        kind = "Hackathon"
    elif any(k in low for k in ["graduate", "junior", "entry", "fresher"]):
        kind = "Full-time"

    published_at = _parse_dt(job.get("publication_date"))

    # Stable-ish id
    h = hashlib.sha1(url.encode("utf-8")).hexdigest()[:10]

    excerpt = safe_excerpt(str(job.get("description") or ""), limit=220)

    tags = []
    if job.get("job_type"):
        tags.append(str(job.get("job_type")))
    if category:
        tags.append(category)

    return ExtractedOpportunity(
        id=f"remotive-{h}",
        title=title,
        company=company,
        kind=kind,  # type: ignore[arg-type]
        location=location,
        source="Remotive",
        source_url=url,
        published_at=published_at,
        deadline=None,
        excerpt=excerpt,
        tags=tags,
    )
