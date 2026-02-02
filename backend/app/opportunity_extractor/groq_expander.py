from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from typing import Any

import httpx

from ..settings import settings
from .types import ProfileSignals


_JSON_OBJECT_RE = re.compile(r"\{[\s\S]*\}")


def _clean_query(q: str) -> str:
    q = (q or "").strip()
    if not q:
        return ""

    # Keep queries short and search-engine-friendly.
    q = q[:80]

    # Allow basic word characters + common separators.
    q = re.sub(r"[^a-zA-Z0-9\s\-_/+.]", " ", q)
    q = re.sub(r"\s+", " ", q).strip()

    # Avoid ultra-short noise.
    if len(q) < 3:
        return ""
    return q


def _extract_json_object(text: str) -> dict[str, Any] | None:
    if not text:
        return None

    # Remove common code fences.
    cleaned = text.strip()
    cleaned = cleaned.replace("```json", "").replace("```", "").strip()

    try:
        obj = json.loads(cleaned)
        if isinstance(obj, dict):
            return obj
    except Exception:
        pass

    m = _JSON_OBJECT_RE.search(cleaned)
    if not m:
        return None
    try:
        obj = json.loads(m.group(0))
        if isinstance(obj, dict):
            return obj
    except Exception:
        return None
    return None


@dataclass
class GroqQueryExpander:
    """AI-assisted query expansion using Groq.

    Notes:
    - This does NOT crawl/scrape websites.
    - It only generates short search queries which are then used against
      official/public sources (e.g., Adzuna API, ATS APIs, RSS feeds).
    """

    api_key: str
    model: str
    timeout_s: float = 8.0
    max_queries: int = 6

    @classmethod
    def from_settings(cls) -> GroqQueryExpander | None:
        api_key = (settings.groq_api_key or "").strip()
        if not api_key:
            return None

        model = (settings.groq_model or "").strip() or "llama-3.1-8b-instant"
        timeout_s = float(getattr(settings, "groq_timeout_s", 8.0) or 8.0)
        max_q = int(getattr(settings, "groq_max_queries", 6) or 6)
        max_q = max(1, min(12, max_q))

        return cls(api_key=api_key, model=model, timeout_s=timeout_s, max_queries=max_q)

    async def expand(self, profile: ProfileSignals) -> list[str]:
        log = logging.getLogger(__name__)

        dept = (profile.department or "").strip()
        skills = [s.strip() for s in (profile.skills or []) if s and s.strip()]
        interests = [i.strip() for i in (profile.interests or []) if i and i.strip()]

        # Keep prompt short and deterministic-ish.
        payload_context = {
            "location": "India",
            "level": "internship / fresher / entry-level",
            "department": dept,
            "skills": skills[:8],
            "interests": interests[:8],
        }

        system = (
            "You generate short search queries to find CURRENT open internships and entry-level jobs. "
            "Return STRICT JSON only. No prose."
        )
        user = (
            "Create a JSON object: {\"queries\": [ ... ]}. "
            "Rules: 2-6 words per query; focus India; avoid senior roles; include 'intern' or 'internship' in most queries; "
            "no markdown; no trailing comments. Context: "
            + json.dumps(payload_context, ensure_ascii=False)
        )

        req = {
            "model": self.model,
            "temperature": 0.2,
            "max_tokens": 256,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "response_format": {"type": "json_object"},
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        url = "https://api.groq.com/openai/v1/chat/completions"

        async with httpx.AsyncClient(timeout=self.timeout_s) as client:
            try:
                resp = await client.post(url, headers=headers, json=req)
                resp.raise_for_status()
                data = resp.json()
            except httpx.HTTPStatusError as e:
                # Common user error: invalid model name. Fall back to default model once.
                status = e.response.status_code if e.response is not None else None
                body = ""
                try:
                    body = (e.response.text or "")[:800]
                except Exception:
                    body = ""

                log.warning("Groq query expansion failed (status=%s, model=%s).", status, self.model)
                if body:
                    log.warning("Groq error body (truncated): %s", body)

                default_model = "llama-3.1-8b-instant"
                if self.model != default_model and status in {400, 404}:
                    try:
                        retry_req = dict(req)
                        retry_req["model"] = default_model
                        retry = await client.post(url, headers=headers, json=retry_req)
                        retry.raise_for_status()
                        data = retry.json()
                        log.info("Groq query expansion succeeded after fallback to %s.", default_model)
                    except Exception:
                        return []
                else:
                    return []
            except Exception as e:
                log.warning("Groq query expansion failed (%s).", type(e).__name__)
                return []

        content = ""
        try:
            choices = data.get("choices") or []
            msg = (choices[0] or {}).get("message") or {}
            content = (msg.get("content") or "").strip()
        except Exception:
            content = ""

        obj = _extract_json_object(content)
        if not obj:
            return []

        raw = obj.get("queries")
        if not isinstance(raw, list):
            return []

        out: list[str] = []
        seen: set[str] = set()

        for item in raw:
            if not isinstance(item, str):
                continue
            q = _clean_query(item)
            if not q:
                continue
            key = q.lower()
            if key in seen:
                continue
            seen.add(key)
            out.append(q)
            if len(out) >= self.max_queries:
                break

        return out
