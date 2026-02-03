"""AI Coach - Interview Preparation Service using Groq."""
from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from .settings import settings


log = logging.getLogger(__name__)


class AICoachService:
    """Interview preparation coach powered by Groq AI."""

    def __init__(self, api_key: str, model: str = "llama-3.3-70b-versatile", timeout_s: float = 30.0):
        self.api_key = api_key
        self.model = model
        self.timeout_s = timeout_s

    @classmethod
    def from_settings(cls) -> "AICoachService | None":
        api_key = (settings.ai_coach_api_key or "").strip()
        if not api_key:
            return None
        model = (settings.groq_model or "").strip() or "llama-3.3-70b-versatile"
        # Use longer timeout for interview sessions
        timeout_s = 30.0
        return cls(api_key=api_key, model=model, timeout_s=timeout_s)

    async def start_interview_prep(
        self,
        role: str,
        department: str,
        skills: list[str],
        target_role: str | None = None,
        difficulty: str = "medium"
    ) -> dict[str, Any]:
        """
        Start a specialized interview preparation session.
        """
        system_prompt = (
            "You are an expert technical interview coach. Return STRICT JSON objects only. "
            "Do not include any conversational text."
        )

        skills_str = ", ".join(skills[:10]) if skills else "general programming"
        target_info = f" for {target_role} role" if target_role else ""
        
        user_prompt = (
            f"Create a specialized interview prep session{target_info} for a {department} student "
            f"with skills in: {skills_str}. Difficulty: {difficulty}. "
            "\n\n"
            "Generate JSON with EXACT structure:\n"
            "{\n"
            '  "session_title": "Interview Prep: [Role]",\n'
            '  "focus_areas": ["area1", "area2", ...],\n'
            '  "technical_questions": [\n'
            '    {"question": "...", "difficulty": "easy|medium|hard", "topic": "..."},\n'
            "    ...\n"
            "  ],\n"
            '  "behavioral_questions": ["question1", "question2", ...],\n'
            '  "tips": ["tip1", "tip2", ...],\n'
            '  "recommended_topics": ["topic1", "topic2", ...]\n'
            "}"
        )

        req = {
            "model": self.model,
            "temperature": 0.4,
            "max_tokens": 2000,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
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
            except Exception as e:
                log.warning("AI Coach interview prep failed (%s).", type(e).__name__)
                return {"error": str(e), "session_title": "Error"}

        content = ""
        try:
            choices = data.get("choices") or []
            msg = (choices[0] or {}).get("message") or {}
            content = msg.get("content") or ""
        except Exception:
            return {"error": "Failed to parse response", "session_title": "Error"}

        if not content:
            return {"error": "Empty response from AI", "session_title": "Error"}

        # Robust extraction
        content = content.strip()
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            import re
            match = re.search(r"\{[\s\S]*\}", content)
            if match:
                try:
                    return json.loads(match.group(0))
                except Exception:
                    pass
            return {"error": "Invalid JSON response", "session_title": "Error"}

    async def get_interview_tips(self, question: str, user_answer: str | None = None) -> dict[str, Any]:
        """
        Get tips for answering a specific interview question.
        """
        system_prompt = (
            "You are an expert interview coach. Return STRICT JSON objects only. "
            "Do not include any conversational text before or after the JSON."
        )

        if user_answer:
            user_prompt = (
                f"Interview Question: {question}\n\n"
                f"Candidate's Answer: {user_answer}\n\n"
                "Provide feedback on this answer and suggest improvements. "
                "Return JSON with EXACT keys: {\"feedback\": \"...\", \"strengths\": [...], \"improvements\": [...], \"sample_points\": [...]}"
            )
        else:
            user_prompt = (
                f"Interview Question: {question}\n\n"
                "Provide tips for answering this question effectively. "
                "Return JSON with EXACT keys: {\"tips\": [...], \"key_points\": [...], \"common_mistakes\": [...]}"
            )

        req = {
            "model": self.model,
            "temperature": 0.4,
            "max_tokens": 1000,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
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
                
                content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                if not content:
                    return {"error": "Empty response from AI"}
                
                # Robust extraction
                content = content.strip()
                try:
                    return json.loads(content)
                except json.JSONDecodeError:
                    # Fallback extraction: find first { and last }
                    import re
                    match = re.search(r"\{[\s\S]*\}", content)
                    if match:
                        try:
                            return json.loads(match.group(0))
                        except Exception:
                            pass
                    
                    return {
                        "tips": ["Could not parse structured response."],
                        "key_points": [content[:200]],
                        "error": "Response was not valid JSON"
                    }
            except Exception as e:
                log.warning("AI Coach tips generation failed (%s).", type(e).__name__)
                return {"error": str(e)}

    async def get_completion(self, prompt: str, system_prompt: str | None = None) -> str:
        """Get a generic completion from Groq."""
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        req = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.7,
            "max_tokens": 2000,
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
                content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                return content
            except Exception as e:
                log.warning("AI completion failed (%s).", type(e).__name__)
                return f"Error: {str(e)}"
