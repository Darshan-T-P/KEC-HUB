from __future__ import annotations

from datetime import datetime
from typing import Iterable

from ..settings import settings
from .scoring import score
from .types import ExtractedOpportunity, ProfileSignals
from .utils import is_active, looks_closed, looks_senior
from .sources.adzuna import AdzunaIndiaSource
from .groq_expander import GroqQueryExpander


def _location_ok(location: str) -> bool:
    mode = (settings.opp_country or "any").strip().upper()
    if mode == "ANY":
        return True

    loc = (location or "").lower()
    if not loc:
        return True

    # India heuristic: allow explicit India/cities, and optionally remote.
    india_tokens = {
        "india",
        "tamil nadu",
        "kerala",
        "karnataka",
        "telangana",
        "andhra",
        "maharashtra",
        "delhi",
        "chennai",
        "coimbatore",
        "erode",
        "salem",
        "bengaluru",
        "bangalore",
        "hyderabad",
        "pune",
        "mumbai",
        "noida",
        "gurgaon",
        "kolkata",
        "ahmedabad",
        "remote",
        "wfh",
        "work from home",
        "worldwide",
    }

    if any(tok in loc for tok in india_tokens):
        if ("remote" in loc or "wfh" in loc or "work from home" in loc or "worldwide" in loc) and not settings.opp_include_remote:
            return False
        return True

    # Not India, not remote
    return False


def _dedupe(items: Iterable[ExtractedOpportunity]) -> list[ExtractedOpportunity]:
    seen: set[str] = set()
    out: list[ExtractedOpportunity] = []
    for i in items:
        key = i.source_url.strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(i)
    return out


class OpportunityExtractor:
    def __init__(self) -> None:
        self._groq = GroqQueryExpander.from_settings()

        # Realtime discovery: Adzuna (India) + optional Groq query expansion.
        self._adzuna = AdzunaIndiaSource(
            app_id=settings.adzuna_app_id,
            app_key=settings.adzuna_app_key,
            results_per_page=min(50, int(settings.opp_max_results or 25)),
            query_expander=(self._groq.expand if self._groq else None),
        )

    @property
    def groq_enabled(self) -> bool:
        return self._groq is not None

    async def extract(self, profile: ProfileSignals) -> list[ExtractedOpportunity]:
        ops, _meta = await self.extract_with_meta(profile)
        return ops

    async def extract_with_meta(self, profile: ProfileSignals) -> tuple[list[ExtractedOpportunity], dict]:
        adzuna_ops = await self._adzuna.fetch(profile)

        combined = _dedupe([*adzuna_ops])

        # Filter closed/expired/old
        filtered: list[ExtractedOpportunity] = []
        for op in combined:
            if settings.opp_exclude_senior and looks_senior(op.title):
                continue

            if settings.opp_country.strip().upper() != "ANY" and not _location_ok(op.location):
                continue

            text = f"{op.title} {op.excerpt}"
            if looks_closed(text):
                continue
            if not is_active(op.deadline, op.published_at, max_age_days=settings.opp_max_age_days):
                continue

            if not settings.opp_include_remote:
                loc = (op.location or "").lower()
                if "remote" in loc or "work from home" in loc or "wfh" in loc:
                    continue

            filtered.append(op)

        # Rank
        ranked = [score(op, profile) for op in filtered]
        ranked.sort(key=lambda x: (x.score, x.deadline or datetime.max.date()), reverse=True)
        # Keep response compatibility (frontend expects webSearch* fields) but disable web search.
        web_meta = {"enabled": False, "provider": None, "used": False, "error": None}
        return ranked[: settings.opp_max_results], {"web": web_meta}
