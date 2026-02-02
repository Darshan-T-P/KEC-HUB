from __future__ import annotations

import re
from datetime import date, datetime
from typing import Optional

import dateparser


_CLOSED_RE = re.compile(r"\b(closed|expired|ended|no longer accepting|applications? closed)\b", re.I)
_SENIOR_RE = re.compile(r"\b(sr\.?|senior|staff|lead|principal|manager|director|head|architect)\b", re.I)


def looks_closed(text: str) -> bool:
    return bool(_CLOSED_RE.search(text or ""))


def looks_senior(title: str) -> bool:
    return bool(_SENIOR_RE.search(title or ""))


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip())


def safe_excerpt(text: str, limit: int = 280) -> str:
    text = normalize_text(text)
    if len(text) <= limit:
        return text
    return text[: max(0, limit - 1)].rstrip() + "…"


def parse_deadline(text: str) -> Optional[date]:
    """Try to parse a deadline date from free text.

    Heuristics only; returns None when uncertain.
    """
    if not text:
        return None

    # Common patterns like "Deadline: 2026-03-10"
    m = re.search(r"\b(\d{4}-\d{2}-\d{2})\b", text)
    if m:
        try:
            return date.fromisoformat(m.group(1))
        except ValueError:
            pass

    # Fallback to dateparser
    dt = dateparser.parse(
        text,
        settings={"PREFER_DATES_FROM": "future", "RELATIVE_BASE": datetime.utcnow()},
    )
    if dt is None:
        return None
    return dt.date()


def is_active(deadline: Optional[date], published_at: Optional[datetime], *, max_age_days: int) -> bool:
    today = date.today()
    if deadline is not None:
        return deadline >= today

    # If no deadline, treat as active only if it's fresh and not obviously closed.
    if published_at is None:
        return False

    age_days = (datetime.utcnow() - published_at.replace(tzinfo=None)).days
    return age_days <= max_age_days
