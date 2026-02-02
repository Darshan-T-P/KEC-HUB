from __future__ import annotations

from abc import ABC, abstractmethod

from ..types import ExtractedOpportunity, ProfileSignals


class OpportunitySource(ABC):
    name: str

    @abstractmethod
    async def fetch(self, profile: ProfileSignals) -> list[ExtractedOpportunity]:
        raise NotImplementedError
