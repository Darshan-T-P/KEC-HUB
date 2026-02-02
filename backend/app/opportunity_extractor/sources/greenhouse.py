from __future__ import annotations

import hashlib
from datetime import datetime
from typing import Any, Optional

import httpx

from ..types import ExtractedOpportunity, ProfileSignals
from ..utils import safe_excerpt
from .base import OpportunitySource


class GreenhouseSource(OpportunitySource):
    """Fetch jobs from Greenhouse boards via their public API.

    Endpoint:
      https://boards-api.greenhouse.io/v1/boards/{board}/jobs?content=true

    Configure with a list of Greenhouse board tokens.
    """

    name = "greenhouse"

    def __init__(self, boards: list[str], *, timeout_s: float = 12.0):
        self._boards = [b.strip() for b in boards if b.strip()]
        self._timeout_s = timeout_s

    async def fetch(self, profile: ProfileSignals) -> list[ExtractedOpportunity]:
        if not self._boards:
            return []

        results: list[ExtractedOpportunity] = []
        async with httpx.AsyncClient(timeout=self._timeout_s, follow_redirects=True) as client:
            for board in self._boards:
                url = f"https://boards-api.greenhouse.io/v1/boards/{board}/jobs"
                resp = await client.get(url, params={"content": "true"})
                if resp.status_code >= 400:
                    continue
                payload = resp.json() if resp.content else {}
                for it in (payload.get("jobs") or []):
                    op = _to_op(board, it)
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


def _to_op(board: str, it: dict) -> Optional[ExtractedOpportunity]:
    title = str(it.get("title") or "").strip()
    if not title:
        return None

    url = str(it.get("absolute_url") or "").strip()
    if not url:
        return None

    location = ""
    loc = it.get("location")
    if isinstance(loc, dict):
        location = str(loc.get("name") or "").strip()

    departments = []
    for d in (it.get("departments") or []):
        if isinstance(d, dict) and d.get("name"):
            departments.append(str(d.get("name")))

    content = ""
    if it.get("content"):
        content = str(it.get("content") or "")

    kind = "Other"
    low = f"{title} {' '.join(departments)}".lower()
    if "intern" in low:
        kind = "Internship"
    elif "hackathon" in low:
        kind = "Hackathon"
    elif any(k in low for k in ["workshop", "bootcamp", "training"]):
        kind = "Workshop"
    elif any(k in low for k in ["graduate", "junior", "entry", "fresher"]):
        kind = "Full-time"

    published_at = _parse_dt(it.get("updated_at") or it.get("created_at"))

    h = hashlib.sha1(url.encode("utf-8")).hexdigest()[:10]

    tags: list[str] = [t for t in departments if t]

    return ExtractedOpportunity(
        id=f"gh-{board}-{h}",
        title=title,
        company=board,
        kind=kind,  # type: ignore[arg-type]
        location=location,
        source=f"Company Careers (Greenhouse:{board})",
        source_url=url,
        published_at=published_at,
        deadline=None,
        excerpt=safe_excerpt(content, limit=220),
        tags=tags,
    )
