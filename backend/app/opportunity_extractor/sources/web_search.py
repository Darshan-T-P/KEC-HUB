from __future__ import annotations

import hashlib
import json
import logging
import re
from datetime import datetime, timezone
from dataclasses import dataclass
from typing import Any, Callable
from urllib.parse import urlparse

import httpx

from ...settings import settings
from ..types import ExtractedOpportunity, ProfileSignals
from .base import OpportunitySource


log = logging.getLogger(__name__)


_JSON_OBJECT_RE = re.compile(r"\{[\s\S]*\}")


def _extract_json_object(text: str) -> dict[str, Any] | None:
    if not text:
        return None
    cleaned = text.strip().replace("```json", "").replace("```", "").strip()
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


def _host(url: str) -> str:
    try:
        return (urlparse(url).hostname or "").lower()
    except Exception:
        return ""


def _base_domain(hostname: str) -> str:
    # Very small heuristic (no public suffix list) but good enough for allowlisting.
    parts = [p for p in (hostname or "").split(".") if p]
    if len(parts) <= 2:
        return hostname
    return ".".join(parts[-2:])


def _hash_id(prefix: str, value: str) -> str:
    h = hashlib.sha1((value or "").encode("utf-8")).hexdigest()[:16]
    return f"{prefix}-{h}"


def _clean_text(s: str) -> str:
    s = (s or "").strip()
    s = re.sub(r"\s+", " ", s)
    return s[:500]


def _looks_like_job(title: str, snippet: str, url: str) -> bool:
    t = f"{title} {snippet}".lower()
    if any(x in t for x in ["job alert", "salary", "glassdoor", "quora", "reddit"]):
        return False

    # Common job tokens.
    if any(k in t for k in ["intern", "internship", "fresher", "graduate", "entry level", "campus", "trainee"]):
        return True
    if any(k in t for k in ["software engineer", "developer", "data analyst", "data scientist", "ml engineer"]):
        return True

    # Job-like URLs.
    u = (url or "").lower()
    if any(p in u for p in ["/jobs/", "/careers/", "/career/", "greenhouse.io", "lever.co", "smartrecruiters.com", "workdayjobs", "myworkdayjobs"]):
        return True

    return False


def _infer_kind(title: str) -> str:
    t = (title or "").lower()
    if "intern" in t:
        return "Internship"
    if any(x in t for x in ["full time", "full-time", "fte"]):
        return "Full-time"
    return "Other"


def _infer_company(title: str, display_host: str) -> str:
    # Prefer host-based company guess.
    host = _base_domain(display_host)
    if host:
        guess = host.split(".")[0]
        if guess and guess not in {"www", "jobs", "careers"}:
            return guess.replace("-", " ").title()

    # Fallback: split on separators.
    for sep in [" - ", " | ", " — ", " – "]:
        if sep in (title or ""):
            right = title.split(sep)[-1].strip()
            if 2 <= len(right) <= 60:
                return right

    return ""


@dataclass
class _WebResult:
    title: str
    link: str
    snippet: str
    display_host: str


@dataclass
class WebSearchSource(OpportunitySource):
    """Web search provider for discovering exact job links.

    This is optional and only runs when a provider is configured.

    Providers supported:
    - SerpAPI (Google engine)
    - Google Custom Search (CSE)

    This source does not scrape pages; it only returns the discovered links.
    """

    name: str = "web-search"
    query_expander: Callable[[ProfileSignals], Any] | None = None

    @property
    def provider(self) -> str:
        return self._provider()

    @property
    def enabled(self) -> bool:
        return self._enabled()

    def _provider(self) -> str:
        return (settings.web_search_provider or "none").strip().lower()

    def _enabled(self) -> bool:
        p = self._provider()
        if p == "serpapi":
            return bool((settings.serpapi_api_key or "").strip())
        if p == "google_cse":
            return bool((settings.google_cse_api_key or "").strip()) and bool((settings.google_cse_cx or "").strip())
        return False

    def _groq_enabled(self) -> bool:
        return bool((settings.groq_api_key or "").strip())

    def _allowed_domains(self) -> set[str]:
        return set(settings.opp_web_search_allowed_domain_list())

    def _domain_allowed(self, url: str) -> bool:
        allow = self._allowed_domains()
        if not allow:
            return True
        h = _host(url)
        if not h:
            return False
        return h in allow or _base_domain(h) in allow

    def _build_queries(self, profile: ProfileSignals) -> list[tuple[str, str]]:
        # Return (query, method) where method explains how it was generated.
        skills = [s.strip() for s in (profile.skills or []) if s and s.strip()]
        interests = [s.strip() for s in (profile.interests or []) if s and s.strip()]

        seed_terms = (skills + interests)[:6]
        if not seed_terms:
            seed_terms = [profile.department or "engineering"]

        base: list[tuple[str, str]] = []
        for term in seed_terms[:3]:
            base.append((f"{term} internship India apply", "base"))
        base.append(("fresher software engineer India apply", "base"))

        expanded: list[tuple[str, str]] = []
        if self.query_expander is not None:
            try:
                # We keep the number small because each query triggers external calls.
                # The expander already returns short queries.
                # We add "apply" to bias toward real job links.
                exp = self.query_expander(profile)
                # exp may be coroutine
                expanded_raw = exp
            except Exception:
                expanded_raw = None

            # Async expansion is handled by fetch() to avoid event loop issues.
            # Here we just provide base; expanded will be appended later.

        # Deduplicate while preserving order.
        out: list[tuple[str, str]] = []
        seen: set[str] = set()
        for q, m in base + expanded:
            key = q.strip().lower()
            if not key or key in seen:
                continue
            seen.add(key)
            out.append((q, m))

        max_q = max(1, min(8, int(getattr(settings, "opp_web_search_max_queries", 3) or 3)))
        return out[:max_q]

    async def _expand_queries_async(self, profile: ProfileSignals) -> list[str]:
        if self.query_expander is None:
            return []
        try:
            res = self.query_expander(profile)
            if hasattr(res, "__await__"):
                res = await res  # type: ignore[misc]
            if not isinstance(res, list):
                return []
            out: list[str] = []
            for q in res:
                if isinstance(q, str) and q.strip():
                    out.append(f"{q.strip()} apply")
            return out
        except Exception:
            return []

    async def _search_serpapi(self, client: httpx.AsyncClient, query: str) -> list[_WebResult]:
        url = "https://serpapi.com/search.json"
        params = {
            "engine": "google",
            "q": query,
            "api_key": (settings.serpapi_api_key or "").strip(),
            "num": int(getattr(settings, "opp_web_search_results_per_query", 8) or 8),
            "hl": "en",
            "gl": "in",
        }
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()

        out: list[_WebResult] = []
        for it in (data.get("organic_results") or [])[:20]:
            link = (it.get("link") or "").strip()
            title = _clean_text(it.get("title") or "")
            snippet = _clean_text(it.get("snippet") or "")
            disp = _clean_text(it.get("displayed_link") or "")
            host = _host(link) or _host("https://" + disp)  # displayed_link may be domain-ish
            if not link or not title:
                continue
            out.append(_WebResult(title=title, link=link, snippet=snippet, display_host=host))
        return out

    async def _search_google_cse(self, client: httpx.AsyncClient, query: str) -> list[_WebResult]:
        url = "https://www.googleapis.com/customsearch/v1"
        params = {
            "key": (settings.google_cse_api_key or "").strip(),
            "cx": (settings.google_cse_cx or "").strip(),
            "q": query,
            "num": min(10, int(getattr(settings, "opp_web_search_results_per_query", 8) or 8)),
        }
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()

        out: list[_WebResult] = []
        for it in (data.get("items") or [])[:20]:
            link = (it.get("link") or "").strip()
            title = _clean_text(it.get("title") or "")
            snippet = _clean_text(it.get("snippet") or "")
            disp = _clean_text(it.get("displayLink") or "")
            host = _host(link) or (disp.lower() if disp else "")
            if not link or not title:
                continue
            out.append(_WebResult(title=title, link=link, snippet=snippet, display_host=host))
        return out

    async def _search(self, client: httpx.AsyncClient, query: str) -> list[_WebResult]:
        p = self._provider()
        if p == "serpapi":
            return await self._search_serpapi(client, query)
        if p == "google_cse":
            return await self._search_google_cse(client, query)
        return []

    async def _groq_filter_keep_urls(self, candidates: list[_WebResult], profile: ProfileSignals) -> set[str] | None:
        if not self._groq_enabled():
            return None

        api_key = (settings.groq_api_key or "").strip()
        model = (settings.groq_model or "").strip() or "llama-3.1-8b-instant"
        timeout_s = float(getattr(settings, "groq_timeout_s", 8.0) or 8.0)

        context = {
            "location": "India / Remote",
            "department": (profile.department or "").strip(),
            "skills": [s.strip() for s in (profile.skills or []) if s and s.strip()][:10],
            "interests": [s.strip() for s in (profile.interests or []) if s and s.strip()][:10],
        }

        payload_candidates = [
            {
                "title": c.title,
                "url": c.link,
                "snippet": c.snippet,
                "host": c.display_host,
            }
            for c in candidates[:18]
        ]

        system = (
            "You are a link filter for job opportunities. "
            "Return STRICT JSON only. No prose."
        )
        user = (
            "Select only real job posting/apply links for internships or entry-level roles (India or Remote). "
            "Prefer official company career pages and common ATS pages (Greenhouse/Lever/SmartRecruiters/Workday). "
            "Avoid unrelated pages, blogs, salary pages, newsletters, and low-quality aggregators. "
            "Return: {\"keep\": [\"https://...\", ...]}. "
            "Context: "
            + json.dumps(context, ensure_ascii=False)
            + "\nCandidates: "
            + json.dumps(payload_candidates, ensure_ascii=False)
        )

        req = {
            "model": model,
            "temperature": 0.1,
            "max_tokens": 256,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "response_format": {"type": "json_object"},
        }

        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        url = "https://api.groq.com/openai/v1/chat/completions"

        async with httpx.AsyncClient(timeout=timeout_s) as client:
            try:
                resp = await client.post(url, headers=headers, json=req)
                resp.raise_for_status()
                data = resp.json()
            except Exception as e:
                log.info("Groq web-filter failed (%s)", type(e).__name__)
                return None

        content = ""
        try:
            choices = data.get("choices") or []
            msg = (choices[0] or {}).get("message") or {}
            content = (msg.get("content") or "").strip()
        except Exception:
            content = ""

        obj = _extract_json_object(content)
        if not obj:
            return None

        keep = obj.get("keep")
        if not isinstance(keep, list):
            return None

        out: set[str] = set()
        for u in keep:
            if isinstance(u, str) and u.strip().startswith("http"):
                out.add(u.strip())
        return out or None

    async def fetch(self, profile: ProfileSignals) -> list[ExtractedOpportunity]:
        if not self._enabled():
            return []

        # Expand (optional) and build query list.
        base = self._build_queries(profile)
        groq_queries = await self._expand_queries_async(profile)

        queries: list[tuple[str, str]] = list(base)
        for q in groq_queries:
            queries.append((q, "groq"))

        # Deduplicate and cap.
        seen_q: set[str] = set()
        uniq: list[tuple[str, str]] = []
        for q, m in queries:
            key = (q or "").strip().lower()
            if not key or key in seen_q:
                continue
            seen_q.add(key)
            uniq.append((q.strip(), m))

        max_q = max(1, min(8, int(getattr(settings, "opp_web_search_max_queries", 3) or 3)))
        uniq = uniq[:max_q]

        timeout = httpx.Timeout(6.0, connect=3.0)
        headers = {"User-Agent": "KEC-Opportunities-Hub/1.0"}

        all_results: list[tuple[_WebResult, str]] = []
        first_http_error: httpx.HTTPStatusError | None = None
        async with httpx.AsyncClient(timeout=timeout, headers=headers, follow_redirects=True) as client:
            for q, method in uniq:
                try:
                    results = await self._search(client, q)
                except httpx.HTTPStatusError as e:
                    # Configuration/permission issues (403, 400 invalid key/cx, quota) should be surfaced.
                    first_http_error = first_http_error or e
                    break
                except Exception as e:
                    log.info("Web search failed for query='%s' (%s)", q, type(e).__name__)
                    continue

                for r in results:
                    all_results.append((r, method))

        # If the provider returned an HTTP error and we couldn't fetch anything, bubble it up so
        # fetch_with_meta can include a helpful diagnostic in the API response.
        if first_http_error is not None and not all_results:
            raise first_http_error

        # Filter & dedupe by URL.
        out: list[ExtractedOpportunity] = []
        seen_url: set[str] = set()

        for r, method in all_results:
            url = r.link.strip()
            key = url.lower()
            if not url or key in seen_url:
                continue

            if not self._domain_allowed(url):
                continue

            if not _looks_like_job(r.title, r.snippet, url):
                continue

            seen_url.add(key)

            company = _clean_text(_infer_company(r.title, r.display_host))
            kind = _infer_kind(r.title)

            op = ExtractedOpportunity(
                id=_hash_id("web", url),
                title=_clean_text(r.title),
                company=company or "",
                kind=kind,  # type: ignore[arg-type]
                location="India / Remote",
                source="Web Search",
                source_url=url,
                match_method=f"web-{method}",
                published_at=datetime.now(timezone.utc),
                excerpt=_clean_text(r.snippet),
                tags=[],
                reasons=[],
            )
            out.append(op)

            # Keep web search additive, not overwhelming.
            if len(out) >= max(5, int(getattr(settings, "opp_max_results", 25) or 25)):
                break

        # Optional: Groq acts as a final filter to keep only the best job/apply links.
        # If Groq is not configured or fails, we return the heuristic-filtered list above.
        # Filter on the same URLs we already accepted.
        by_url: dict[str, _WebResult] = {}
        for r, _method in all_results:
            u = (r.link or "").strip()
            if u and u not in by_url:
                by_url[u] = r
        candidates = [by_url[o.source_url] for o in out if o.source_url in by_url]

        keep_urls = await self._groq_filter_keep_urls(candidates, profile)
        if keep_urls:
            out = [o for o in out if o.source_url in keep_urls]

        return out

    async def fetch_with_meta(self, profile: ProfileSignals) -> tuple[list[ExtractedOpportunity], dict[str, Any]]:
        meta: dict[str, Any] = {
            "enabled": self.enabled,
            "provider": self.provider,
            "used": False,
            "error": None,
        }

        if not self.enabled:
            return [], meta

        try:
            # "used" means we attempted a web search call (even if it returned 0 kept items).
            meta["used"] = True
            ops = await self.fetch(profile)
            return ops, meta
        except httpx.HTTPStatusError as e:
            status = None
            try:
                status = e.response.status_code if e.response is not None else None
            except Exception:
                status = None

            # Avoid dumping full response bodies (can include internal debug info).
            if self.provider == "google_cse":
                meta["error"] = (
                    f"Google CSE request failed (status={status}). "
                    "Check: Custom Search API enabled in Google Cloud, API key restrictions, correct CX, and billing/quota."
                )
            elif self.provider == "serpapi":
                meta["error"] = (
                    f"SerpAPI request failed (status={status}). "
                    "Check: SERPAPI_API_KEY, plan/quota, and that the key is active."
                )
            else:
                meta["error"] = f"Web search request failed (status={status})."
            return [], meta
        except Exception as e:
            meta["error"] = f"Web search failed: {type(e).__name__}"
            return [], meta
