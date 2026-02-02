from __future__ import annotations

import hashlib
import logging
from datetime import datetime
from typing import Any, Awaitable, Callable, Optional

import httpx

from ..types import ExtractedOpportunity, ProfileSignals
from ..utils import safe_excerpt
from .base import OpportunitySource


class AdzunaIndiaSource(OpportunitySource):
    """Adzuna Jobs API (country=IN).

    Requires app_id + app_key.
    Docs: https://developer.adzuna.com/
    """

    name = "adzuna-in"

    def __init__(
        self,
        *,
        app_id: str,
        app_key: str,
        results_per_page: int = 30,
        timeout_s: float = 12.0,
        query_expander: Callable[[ProfileSignals], Awaitable[list[str]]] | None = None,
    ) -> None:
        self._app_id = app_id.strip()
        self._app_key = app_key.strip()
        self._results_per_page = max(1, min(50, int(results_per_page)))
        self._timeout_s = timeout_s
        self._query_expander = query_expander

    async def fetch(self, profile: ProfileSignals) -> list[ExtractedOpportunity]:
        if not self._app_id or not self._app_key:
            return []

        # We'll fetch multiple pages (bounded) per query.
        base_url = "https://api.adzuna.com/v1/api/jobs/in/search/{page}"
        base_params = {
            "app_id": self._app_id,
            "app_key": self._app_key,
            "results_per_page": str(self._results_per_page),
            # Prefer newest jobs to make repeated scans change over time.
            "sort_by": "date",
        }

        base_queries = _build_queries(profile)

        expanded: list[str] = []
        if self._query_expander is not None:
            try:
                expanded = await self._query_expander(profile)
            except Exception:
                expanded = []

        # Build queries with provenance (base vs groq). Keep order: base primary, groq, base fallbacks.
        query_items: list[tuple[str, str]] = []
        if base_queries:
            query_items.append((base_queries[0], "base"))
        query_items.extend([(q, "groq") for q in expanded])
        if len(base_queries) > 1:
            query_items.extend([(q, "base") for q in base_queries[1:]])

        log = logging.getLogger(__name__)
        if self._query_expander is None:
            log.info("Adzuna: Groq expander disabled (no GROQ_API_KEY).")
        else:
            log.info("Adzuna: Groq expander produced %d queries.", len(expanded))

        # Dedupe and cap to keep API calls bounded. Keep first occurrence so base wins over groq duplicates.
        seen_q: set[str] = set()
        queries: list[tuple[str, str]] = []
        for q, method in query_items:
            k = (q or "").strip().lower()
            if not k or k in seen_q:
                continue
            seen_q.add(k)
            queries.append((q, method))
            if len(queries) >= 10:
                break

        collected: list[ExtractedOpportunity] = []
        seen: set[str] = set()

        # Keep API calls bounded. With up to 10 queries, max_pages=2 => at most 20 calls.
        max_pages = 2
        max_total = self._results_per_page
        # Prevent the first query from consuming the entire budget.
        per_query_cap = max(3, max_total // max(1, min(len(queries), 4)))

        groq_query_available = any(m == "groq" for _, m in queries)
        groq_used = False

        # If we have groq queries, reserve some slots so we don't fill everything with the first base query.
        reserve_for_groq = max(3, max_total // 3) if groq_query_available else 0
        first_groq_index: int | None = None
        for i, (_q, m) in enumerate(queries):
            if m == "groq":
                first_groq_index = i
                break
        base_before_groq_cap = max_total - reserve_for_groq
        base_before_groq_count = 0

        async with httpx.AsyncClient(timeout=self._timeout_s, follow_redirects=True) as client:
            for qi, (q, match_method) in enumerate(queries):
                added_for_query = 0
                for page in range(1, max_pages + 1):
                    url = base_url.format(page=page)
                    params = dict(base_params)
                    params["what"] = q

                    resp = await client.get(url, params=params)
                    resp.raise_for_status()
                    payload = resp.json() if resp.content else {}
                    items = payload.get("results") or []

                    log.info("Adzuna: query='%s' page=%d -> %d items", q, page, len(items))

                    # If a page yields nothing, stop paging for this query.
                    if not items:
                        break

                    for item in items:
                        op = _to_op(item, match_method=match_method)
                        if op is None:
                            continue
                        key = (op.source_url or "").strip().lower()
                        if not key or key in seen:
                            continue

                        # Before we reach the first groq query, cap base items so groq can contribute.
                        if (
                            match_method == "base"
                            and first_groq_index is not None
                            and qi < first_groq_index
                            and base_before_groq_count >= base_before_groq_cap
                        ):
                            break

                        seen.add(key)
                        collected.append(op)
                        added_for_query += 1

                        if match_method == "base" and first_groq_index is not None and qi < first_groq_index:
                            base_before_groq_count += 1

                        if match_method == "groq":
                            groq_used = True

                        if len(collected) >= max_total:
                            break

                        # Limit per query so groq queries get a chance to contribute.
                        if added_for_query >= per_query_cap:
                            break

                    if len(collected) >= max_total:
                        break

                    # Stop paging for this query once we have enough items from it.
                    if added_for_query >= per_query_cap:
                        break

                # Only stop early once groq had a chance (when available).
                if len(collected) >= max_total and (not groq_query_available or groq_used):
                    break

        return collected[:max_total]


def _build_queries(profile: ProfileSignals) -> list[str]:
    """Adzuna search can be surprisingly sensitive to long queries.

    Prefer short, student-friendly queries and fall back to generic ones.
    """
    dept = (profile.department or "").strip()
    skills = [s.strip() for s in (profile.skills or []) if s and s.strip()]

    # Use department only when it is meaningful (avoid noisy "Computer Science").
    dept_hint = ""
    if dept and dept.lower() not in {"computer science", "cse", "cs", "computer"}:
        dept_hint = dept

    # Keep it short: top 2 skills max.
    skill_hint = " ".join(skills[:2]).strip()

    # Primary: software + intern + a couple skills
    q1 = " ".join(["software", "intern", skill_hint, dept_hint]).strip()

    # Fallbacks
    q2 = "software intern"
    q3 = "internship"
    q4 = "graduate trainee"

    return [q for q in [q1, q2, q3, q4] if q]


def _parse_dt(value: Any) -> Optional[datetime]:
    if not value:
        return None
    try:
        # Adzuna often returns ISO timestamps
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


def _to_op(item: dict, *, match_method: str | None = None) -> Optional[ExtractedOpportunity]:
    title = str(item.get("title") or "").strip()
    if not title:
        return None

    redirect_url = str(item.get("redirect_url") or "").strip() or str(item.get("redirectUrl") or "").strip()
    if not redirect_url:
        return None

    company = ""
    comp = item.get("company")
    if isinstance(comp, dict):
        company = str(comp.get("display_name") or "").strip()

    location = ""
    loc = item.get("location")
    if isinstance(loc, dict):
        location = str(loc.get("display_name") or "").strip()

    category = ""
    cat = item.get("category")
    if isinstance(cat, dict):
        category = str(cat.get("label") or "").strip()

    description = str(item.get("description") or "")

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

    published_at = _parse_dt(item.get("created"))

    # Stable-ish id
    base = str(item.get("id") or "") or redirect_url
    h = hashlib.sha1(base.encode("utf-8")).hexdigest()[:10]

    tags: list[str] = []
    if category:
        tags.append(category)

    return ExtractedOpportunity(
        id=f"adzuna-{h}",
        title=title,
        company=company or "",
        kind=kind,  # type: ignore[arg-type]
        location=location or "India",
        source="Adzuna (India)",
        source_url=redirect_url,
        match_method=match_method,
        published_at=published_at,
        deadline=None,
        excerpt=safe_excerpt(description, limit=220),
        tags=tags,
    )
