"""AI Advantage - Strategic Preparation & Cover Letters using Groq."""
from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from .settings import settings


log = logging.getLogger(__name__)


class GeminiAdvantageService:
    """AI Advantage powered by Groq LLM."""

    def __init__(self, api_key: str, model: str = "llama-3.3-70b-versatile", timeout_s: float = 30.0):
        self.api_key = api_key
        self.model = model
        self.timeout_s = timeout_s
        self.base_url = "https://api.groq.com/openai/v1"

    @classmethod
    def from_settings(cls) -> "GeminiAdvantageService | None":
        # Use AI Coach API key (Groq) instead of Gemini
        api_key = (settings.ai_coach_api_key or "").strip()
        if not api_key:
            return None
        model = "llama-3.3-70b-versatile"
        timeout_s = 30.0
        return cls(api_key=api_key, model=model, timeout_s=timeout_s)

    async def strategic_preparation(
        self,
        target_role: str,
        company: str | None,
        skills: list[str],
        experience_level: str = "entry-level"
    ) -> dict[str, Any]:
        """
        Generate strategic interview preparation plan using Groq.
        """
        skills_str = ", ".join(skills[:10]) if skills else "general programming"
        company_info = f" at {company}" if company else ""
        
        system_prompt = (
            "You are an expert career counselor. Return STRICT JSON objects only. "
            "Do not include any conversational preamble or post-amble."
        )

        prompt = (
            f"Create a comprehensive strategic interview preparation plan for a {experience_level} "
            f"{target_role} role{company_info}. "
            f"Candidate profile: {skills_str}.\n\n"
            "Include:\n"
            "1. Company research points\n"
            "2. Technical roadmap (prioritized study topics)\n"
            "3. Common interview patterns for this role\n"
            "4. Projects/portfolio suggestions\n"
            "5. 4-week study timeline\n"
            "6. Recommended resources\n\n"
            "Respond in JSON format with EXACT keys:\n"
            '{"company_insights": {"culture": "...", "key_focus_areas": [...]}, '
            '"technical_roadmap": {"priority_topics": [...], "timeline": "..."}, '
            '"interview_patterns": [...], '
            '"portfolio_projects": [{"title": "...", "description": "..."}], '
            '"study_timeline": {"week1": [...], "week2": [...], "week3": [...], "week4": [...]}, '
            '"resources": [{"title": "...", "type": "..."}]}'
        )

        # Use Groq chat completion API
        req = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.4,
            "max_tokens": 2500,
            "response_format": {"type": "json_object"},
        }

        url = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient(timeout=self.timeout_s) as client:
            try:
                resp = await client.post(url, json=req, headers=headers)
                resp.raise_for_status()
                data = resp.json()
            except Exception as e:
                log.error("Groq strategic prep failed (%s): %s", type(e).__name__, str(e))
                return {"error": f"Strategic prep generation failed: {type(e).__name__}"}

        try:
            choices = data.get("choices", [])
            if not choices:
                return {"error": "No response from Groq"}
            
            content_text = choices[0].get("message", {}).get("content", "")
            if not content_text:
                return {"error": "Empty response"}
            
            # Robust extraction
            content_text = content_text.strip()
            try:
                return json.loads(content_text)
            except json.JSONDecodeError:
                import re
                match = re.search(r"\{[\s\S]*\}", content_text)
                if match:
                    try:
                        return json.loads(match.group(0))
                    except Exception:
                        pass
                return {"error": "Failed to parse JSON response", "raw": content_text[:200]}
        except Exception as e:
            log.warning("Failed to parse Groq response (%s).", type(e).__name__)
            return {"error": "Failed to parse response", "details": str(e)}

    async def generate_cover_letter(
        self,
        job_title: str,
        company: str,
        job_description: str,
        user_profile: dict[str, Any]
    ) -> dict[str, Any]:
        """
        Generate AI-powered cover letter using Groq.
        """
        name = user_profile.get("name", "Candidate")
        skills = user_profile.get("skills", [])
        projects = user_profile.get("projects", [])
        achievements = user_profile.get("achievements", [])
        
        skills_str = ", ".join(skills[:8]) if skills else "various technical skills"
        projects_str = "\n".join([
            f"- {p.get('title', '')}: {p.get('description', '')[:100]}"
            for p in projects[:3]
        ]) if projects else "No projects listed"
        
        achievements_str = "\n".join([f"- {a}" for a in achievements[:3]]) if achievements else "No achievements listed"
        
        system_prompt = (
            "You are an expert resume writer. Return STRICT JSON objects only. "
            "Do not include any conversational text."
        )

        prompt = (
            f"Write a professional, compelling cover letter for {name} applying to the {job_title} "
            f"position at {company}.\n\n"
            f"Candidate Profile:\n"
            f"Skills: {skills_str}\n"
            f"Projects:\n{projects_str}\n"
            f"Achievements:\n{achievements_str}\n\n"
            f"Job Description:\n{job_description[:1500]}\n\n"
            "Requirements:\n"
            "1. Professional tone, 250-350 words\n"
            "2. Highlight relevant skills and experiences\n"
            "3. Connect candidate's background to job requirements\n\n"
            "Return JSON with EXACT keys: "
            "{\"cover_letter\": \"full letter text\", "
            "\"key_highlights\": [\"point1\", \"point2\", ...], "
            "\"customization_tips\": [\"tip1\", \"tip2\", ...]}"
        )

        req = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.6,
            "max_tokens": 1500,
            "response_format": {"type": "json_object"},
        }

        url = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient(timeout=self.timeout_s) as client:
            try:
                resp = await client.post(url, json=req, headers=headers)
                resp.raise_for_status()
                data = resp.json()
            except Exception as e:
                log.error("Groq cover letter generation failed (%s): %s", type(e).__name__, str(e))
                return {"error": f"Cover letter generation failed: {type(e).__name__}"}
                
        try:
            choices = data.get("choices", [])
            if not choices:
                return {"error": "No response from Groq"}
            
            content = choices[0].get("message", {}).get("content", "")
            if not content:
                return {"error": "Empty response"}
            
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
                return {
                    "cover_letter": content,
                    "key_highlights": [],
                    "customization_tips": ["Check response formatting"],
                    "error": "Failed to parse JSON"
                }
        except Exception as e:
            log.warning("Failed to parse response (%s).", type(e).__name__)
            return {"error": str(e)}
