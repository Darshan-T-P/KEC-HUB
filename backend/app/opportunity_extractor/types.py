from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import Literal, Optional


OpportunityKind = Literal["Internship", "Hackathon", "Workshop", "Competition", "Full-time", "Other"]


@dataclass(frozen=True)
class ProfileSignals:
    email: str
    department: str
    skills: list[str]
    interests: list[str]


@dataclass
class ExtractedOpportunity:
    id: str
    title: str
    company: str
    kind: OpportunityKind
    location: str
    source: str
    source_url: str

    # How this item was matched/found (e.g., base query vs Groq-expanded query).
    # This is not the same as `source` (Adzuna/Lever/RSS/etc.).
    match_method: Optional[str] = None

    published_at: Optional[datetime] = None
    deadline: Optional[date] = None
    excerpt: str = ""
    tags: list[str] = None  # type: ignore[assignment]

    score: float = 0.0
    reasons: list[str] = None  # type: ignore[assignment]

    def __post_init__(self) -> None:
        if self.tags is None:
            self.tags = []
        if self.reasons is None:
            self.reasons = []
