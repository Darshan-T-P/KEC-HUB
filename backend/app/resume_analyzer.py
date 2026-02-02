from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from typing import Any

import httpx

from .settings import settings


_JSON_OBJECT_RE = re.compile(r"\{[\s\S]*\}")


def _extract_json_object(text: str) -> dict[str, Any] | None:
    if not text:
        return None

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


def _truncate(s: str, limit: int) -> str:
    s = (s or "").strip()
    if len(s) <= limit:
        return s
    return s[:limit].rstrip() + "\n\n[TRUNCATED]"


@dataclass
class GroqResumeAnalyzer:
    """Resume analysis using Groq (OpenAI-compatible endpoint).

    Takes resume text + job description and returns structured JSON feedback.
    """

    api_key: str
    model: str
    timeout_s: float = 20.0

    @classmethod
    def from_settings(cls) -> "GroqResumeAnalyzer | None":
        api_key = (settings.groq_api_key or "").strip()
        if not api_key:
            return None

        model = (settings.groq_model or "").strip() or "llama-3.1-8b-instant"
        timeout_s = float(getattr(settings, "groq_timeout_s", 20.0) or 20.0)
        timeout_s = max(5.0, min(60.0, timeout_s))

        return cls(api_key=api_key, model=model, timeout_s=timeout_s)

    async def analyze(self, resume_text: str, job_description: str) -> dict[str, Any] | None:
        log = logging.getLogger(__name__)

        resume_text = _truncate(resume_text, 14000)
        job_description = _truncate(job_description, 8000)

        system = (
            "You are an expert resume reviewer and ATS optimization coach. "
            "Return STRICT JSON only. No markdown. No prose outside JSON. "
            "Be constructive, specific, and actionable."
        )

        user = (
            "Analyze the following resume against the job description. "
            "Return a single JSON object with EXACT keys:\n"
            "{\n"
            '  "overallFitScore": 0-100,\n'
            '  "strengths": [string],\n'
            '  "gaps": [string],\n'
            '  "improvements": [{"area": string, "recommendation": string, "example": string}],\n'
            '  "missingKeywords": [string],\n'
            '  "suggestedSummary": string,\n'
            '  "suggestedBullets": [string],\n'
            '  "atsWarnings": [string],\n'
            '  "finalFeedback": string\n'
            "}\n\n"
            "Rules:\n"
            "- Keep recommendations realistic; do not invent experience.\n"
            "- Prefer impact + metrics suggestions.\n"
            "- Mention formatting/ATS issues if present.\n\n"
            "JOB_DESCRIPTION:\n"
            + job_description
            + "\n\nRESUME_TEXT:\n"
            + resume_text
        )

        req = {
            "model": self.model,
            "temperature": 0.25,
            "max_tokens": 1100,
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
                status = e.response.status_code if e.response is not None else None
                body = ""
                try:
                    body = (e.response.text or "")[:800]
                except Exception:
                    body = ""

                log.warning("Groq resume analysis failed (status=%s, model=%s).", status, self.model)
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
                        log.info("Groq resume analysis succeeded after fallback to %s.", default_model)
                    except Exception:
                        return None
                else:
                    return None
            except Exception as e:
                log.warning("Groq resume analysis failed (%s).", type(e).__name__)
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

        return obj
