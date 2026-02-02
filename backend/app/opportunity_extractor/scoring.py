from __future__ import annotations

import re
from typing import Iterable

from .types import ExtractedOpportunity, ProfileSignals


def _tokenize(values: Iterable[str]) -> set[str]:
    tokens: set[str] = set()
    for v in values:
        v = (v or "").lower()
        for t in re.split(r"[^a-z0-9+#\.]+", v):
            t = t.strip()
            if len(t) >= 2:
                tokens.add(t)
    return tokens


def score(opportunity: ExtractedOpportunity, profile: ProfileSignals) -> ExtractedOpportunity:
    title_tokens = _tokenize([opportunity.title, opportunity.company, opportunity.location] + (opportunity.tags or []))
    profile_tokens = _tokenize([profile.department] + profile.skills + profile.interests)

    overlap = title_tokens.intersection(profile_tokens)

    s = 0.0
    reasons: list[str] = []

    if overlap:
        s += min(6.0, len(overlap) * 1.2)
        reasons.append(f"keyword match: {', '.join(sorted(list(overlap))[:6])}")

    # Light boosts
    if opportunity.kind in {"Internship", "Hackathon"}:
        s += 1.0

    title_low = (opportunity.title or "").lower()
    if any(w in title_low for w in ["intern", "fresher", "graduate", "entry", "junior"]):
        s += 0.8
        reasons.append("fresher/intern friendly")

    if any(w in title_low for w in ["staff", "principal", "sr", "senior", "lead", "manager", "director"]):
        s -= 1.5
        reasons.append("seniority down-rank")

    if opportunity.deadline is not None:
        s += 1.0
        reasons.append("has deadline")

    opportunity.score = s
    opportunity.reasons = reasons
    return opportunity
