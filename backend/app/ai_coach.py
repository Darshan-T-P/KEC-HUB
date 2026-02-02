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
        
        Args:
            role: User role (student/alumni)
            department: Academic department
            skills: List of technical skills
            target_role: Target job role (e.g., "SDE", "Data Analyst")
            difficulty: Interview difficulty level (easy/medium/hard)
            
        Returns:
            Dict with interview questions, tips, and session info
        """
        system_prompt = (
            "You are an expert technical interview coach specializing in Computer Science roles. "
            "You help students and fresh graduates prepare for technical interviews by providing: "
            "1. Relevant technical questions based on their profile "
            "2. Common behavioral questions "
            "3. Tips for answering effectively "
            "4. Areas to focus on based on their skills and target role. "
            "Always be encouraging, specific, and practical in your advice."
        )

        skills_str = ", ".join(skills[:10]) if skills else "general programming"
        target_info = f" for {target_role} role" if target_role else ""
        
        user_prompt = (
            f"Create a specialized interview prep session{target_info} for a {department} student "
            f"with skills in: {skills_str}. "
            f"Difficulty level: {difficulty}. "
            "\n\n"
            "Generate a JSON response with the following structure:\n"
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
            "temperature": 0.7,
            "max_tokens": 2000,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
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
                log.warning("AI Coach interview prep failed (status=%s).", status)
                if body:
                    log.warning("Error body: %s", body)
                return {
                    "error": f"Interview prep generation failed (status={status})",
                    "session_title": "Error",
                }
            except Exception as e:
                log.warning("AI Coach interview prep failed (%s).", type(e).__name__)
                return {
                    "error": f"Interview prep generation failed: {type(e).__name__}",
                    "session_title": "Error",
                }

        content = ""
        try:
            choices = data.get("choices") or []
            msg = (choices[0] or {}).get("message") or {}
            content = msg.get("content") or ""
        except Exception as e:
            log.warning("Failed to parse AI Coach response (%s).", type(e).__name__)
            return {"error": "Failed to parse response", "session_title": "Error"}

        if not content:
            return {"error": "Empty response from AI", "session_title": "Error"}

        # Extract JSON from potential code block wrapping
        content = content.strip()
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()

        try:
            result = json.loads(content)
            return result
        except Exception as e:
            log.warning("Failed to decode JSON from AI Coach (%s).", type(e).__name__)
            return {"error": "Invalid JSON response", "session_title": "Error", "raw": content[:500]}

    async def get_interview_tips(self, question: str, user_answer: str | None = None) -> dict[str, Any]:
        """
        Get tips for answering a specific interview question.
        
        Args:
            question: The interview question
            user_answer: Optional user's draft answer to review
            
        Returns:
            Dict with tips, sample answer structure, and feedback
        """
        system_prompt = (
            "You are an expert interview coach. Provide concise, actionable tips "
            "for answering technical and behavioral interview questions."
        )

        if user_answer:
            user_prompt = (
                f"Interview Question: {question}\n\n"
                f"Candidate's Answer: {user_answer}\n\n"
                "Provide feedback on this answer and suggest improvements. "
                "Return JSON with: {\"feedback\": \"...\", \"strengths\": [...], \"improvements\": [...], \"sample_points\": [...]}"
            )
        else:
            user_prompt = (
                f"Interview Question: {question}\n\n"
                "Provide tips for answering this question effectively. "
                "Return JSON with: {\"tips\": [...], \"key_points\": [...], \"common_mistakes\": [...]}"
            )

        req = {
            "model": self.model,
            "temperature": 0.7,
            "max_tokens": 1000,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
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
                    return {"error": "Empty response"}
                
                # Extract JSON from potential code block wrapping
                content = content.strip()
                if content.startswith("```json"):
                    content = content[7:]
                if content.startswith("```"):
                    content = content[3:]
                if content.endswith("```"):
                    content = content[:-3]
                content = content.strip()
                
                try:
                    return json.loads(content)
                except json.JSONDecodeError:
                    # If JSON parsing fails, return structured fallback
                    return {
                        "tips": [content[:500]],
                        "key_points": ["See full response above"],
                        "error": "Response was not valid JSON"
                    }
            except Exception as e:
                log.warning("AI Coach tips generation failed (%s).", type(e).__name__)
                return {"error": str(e)}
