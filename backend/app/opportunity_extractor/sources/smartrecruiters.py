from __future__ import annotations

import hashlib
from datetime import datetime
from typing import Any, Optional

import httpx

from ..types import ExtractedOpportunity, ProfileSignals
from ..utils import safe_excerpt
from .base import OpportunitySource


class SmartRecruitersSource(OpportunitySource):
    """Fetch jobs from SmartRecruiters via their public API.

    Endpoint:
      https://api.smartrecruiters.com/v1/companies/{company}/postings

    Configure with a list of SmartRecruiters company identifiers.
    """

    name = "smartrecruiters"

    def __init__(self, companies: list[str], *, timeout_s: float = 12.0):
        self._companies = [c.strip() for c in companies if c.strip()]
        self._timeout_s = timeout_s

    async def fetch(self, profile: ProfileSignals) -> list[ExtractedOpportunity]:
        if not self._companies:
            return []

        results: list[ExtractedOpportunity] = []
        async with httpx.AsyncClient(timeout=self._timeout_s, follow_redirects=True) as client:
            for company in self._companies:
                url = f"https://api.smartrecruiters.com/v1/companies/{company}/postings"
                resp = await client.get(url)
                if resp.status_code >= 400:
                    continue
                payload = resp.json() if resp.content else {}
                for it in (payload.get("content") or []):
                    op = _to_op(company, it)
                    if op is not None:
                        results.append(op)
        return results


def _parse_dt(value: Any) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


def _to_op(company: str, it: dict) -> Optional[ExtractedOpportunity]:
    title = str(it.get("name") or "").strip()
    if not title:
        return None

    ref = it.get("ref")
    url = ""
    if isinstance(ref, str):
        url = ref

    # Some responses include a 'ref' path; build a usable link if needed.
    if url and url.startswith("/"):
        url = f"https://jobs.smartrecruiters.com{url}"

    if not url:
        # fallback: try id-based link
        pid = str(it.get("id") or "").strip()
        if pid:
            url = f"https://jobs.smartrecruiters.com/{company}/{pid}"

    if not url:
        return None

    location = ""
    loc = it.get("location")
    if isinstance(loc, dict):
        location = str(loc.get("city") or "").strip() or str(loc.get("country") or "").strip()

    department = ""
    dep = it.get("department")
    if isinstance(dep, dict):
        department = str(dep.get("label") or "").strip()

    kind = "Other"
    low = f"{title} {department}".lower()
    if "intern" in low:
        kind = "Internship"
    elif "hackathon" in low:
        kind = "Hackathon"
    elif any(k in low for k in ["workshop", "bootcamp", "training"]):
        kind = "Workshop"
    elif any(k in low for k in ["graduate", "junior", "entry", "fresher"]):
        kind = "Full-time"

    published_at = _parse_dt(it.get("releasedDate") or it.get("createdOn"))

    h = hashlib.sha1(url.encode("utf-8")).hexdigest()[:10]

    tags: list[str] = []
    if department:
        tags.append(department)

    return ExtractedOpportunity(
        id=f"sr-{company}-{h}",
        title=title,
        company=company,
        kind=kind,  # type: ignore[arg-type]
        location=location,
        source=f"Company Careers (SmartRecruiters:{company})",
        source_url=url,
        published_at=published_at,
        deadline=None,
        excerpt=safe_excerpt(str(it.get("jobAd") or ""), limit=220),
        tags=tags,
    )
