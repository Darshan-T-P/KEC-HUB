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
        
        Args:
            target_role: Target job role (e.g., "Software Engineer")
            company: Optional company name for company-specific prep
            skills: User's technical skills
            experience_level: Experience level (entry-level/mid-level/senior)
            
        Returns:
            Dict with strategic prep plan and resources
        """
        skills_str = ", ".join(skills[:10]) if skills else "general programming"
        company_info = f" at {company}" if company else ""
        
        prompt = (
            f"Create a comprehensive strategic interview preparation plan for a {experience_level} "
            f"{target_role} role{company_info}. "
            f"Candidate's skills: {skills_str}.\n\n"
            "Include:\n"
            "1. Company research points (if company specified)\n"
            "2. Technical topics to study (prioritized list)\n"
            "3. Common interview patterns for this role\n"
            "4. Projects/portfolio suggestions\n"
            "5. Week-by-week study timeline (4 weeks)\n"
            "6. Recommended resources and study materials\n\n"
            "Respond in JSON format with these exact keys:\n"
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
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.7,
            "max_tokens": 2500,
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
            except httpx.HTTPStatusError as e:
                status = e.response.status_code if e.response is not None else None
                body = ""
                try:
                    body = (e.response.text or "")[:1200]
                except Exception:
                    body = ""
                log.error("Groq strategic prep failed (status=%s).", status)
                log.error("Request: %s", json.dumps(req, indent=2))
                if body:
                    log.error("Error body: %s", body)
                return {"error": f"Strategic prep generation failed (status={status}): {body[:200]}"}
            except Exception as e:
                log.error("Groq strategic prep failed (%s): %s", type(e).__name__, str(e))
                return {"error": f"Strategic prep generation failed: {type(e).__name__}"}

        try:
            choices = data.get("choices", [])
            if not choices:
                return {"error": "No response from Groq"}
            
            message = choices[0].get("message", {})
            content_text = message.get("content", "")
            
            if not content_text:
                return {"error": "Empty response"}
            
            # Try to extract JSON from the response
            result = {}
            try:
                # Sometimes the model wraps JSON in code blocks
                if "```json" in content_text:
                    json_start = content_text.find("```json") + 7
                    json_end = content_text.find("```", json_start)
                    content_text = content_text[json_start:json_end].strip()
                elif "```" in content_text:
                    json_start = content_text.find("```") + 3
                    json_end = content_text.find("```", json_start)
                    content_text = content_text[json_start:json_end].strip()
                    
                result = json.loads(content_text)
            except Exception:
                # If not valid JSON, return as is
                result = {"raw_response": content_text}
            
            return result
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
        
        Args:
            job_title: Job title
            company: Company name
            job_description: Full job description
            user_profile: User profile with name, skills, experience, projects
            
        Returns:
            Dict with cover letter and key highlights
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
            "3. Show enthusiasm for the company\n"
            "4. Connect candidate's background to job requirements\n"
            "5. Include specific examples from projects/achievements\n\n"
            "Return JSON with: "
            "{\"cover_letter\": \"full letter text\", "
            "\"key_highlights\": [\"point1\", \"point2\", ...], "
            "\"customization_tips\": [\"tip1\", \"tip2\", ...]}"
        )

        req = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.8,
            "max_tokens": 1500,
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
                
                choices = data.get("choices", [])
                if not choices:
                    return {"error": "No response from Groq"}
                
                content = choices[0].get("message", {}).get("content", "")
                
                if not content:
                    return {"error": "Empty response"}
                
                # Extract JSON from potential code block wrapping
                raw_text = content.strip()
                if raw_text.startswith("```json"):
                    raw_text = raw_text[7:]
                if raw_text.startswith("```"):
                    raw_text = raw_text[3:]
                if raw_text.endswith("```"):
                    raw_text = raw_text[:-3]
                raw_text = raw_text.strip()
                
                try:
                    result = json.loads(raw_text)
                except json.JSONDecodeError:
                    result = {
                        "cover_letter": raw_text,
                        "key_highlights": [],
                        "customization_tips": []
                    }
                
                return result
            except httpx.HTTPStatusError as e:
                status = e.response.status_code if e.response is not None else None
                body = ""
                try:
                    body = (e.response.text or "")[:1200]
                except Exception:
                    body = ""
                log.error("Groq cover letter generation failed (status=%s).", status)
                log.error("Request: %s", json.dumps(req, indent=2))
                if body:
                    log.error("Error body: %s", body)
                return {"error": f"Cover letter generation failed (status={status}): {body[:200]}"}
            except Exception as e:
                log.error("Groq cover letter generation failed (%s): %s", type(e).__name__, str(e))
                return {"error": f"Cover letter generation failed: {type(e).__name__}"}
