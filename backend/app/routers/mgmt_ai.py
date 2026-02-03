from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, Form
from ..deps import get_ai_coach  # Reusing Groq service
from ..models import UserRole

router = APIRouter(prefix="/mgmt-ai", tags=["Management AI"])
log = logging.getLogger(__name__)

@router.post("/draft-description")
async def draft_description(
    company: str = Form(...),
    role: str = Form(...),
    points: str = Form(...), # key points or requirements
    coach=Depends(get_ai_coach) # Using AICoachService which uses Groq
):
    if not coach:
        return {"error": "AI Service not configured."}
    
    prompt = (
        f"Draft a professional placement notice description for {company} seeking a {role}.\n\n"
        f"Key requirements/points to include:\n{points}\n\n"
        "Format the output with these sections:\n"
        "1. Role Overview\n"
        "2. Key Responsibilities\n"
        "3. Qualifications & Skills\n"
        "4. About the Company\n\n"
        "Use clear bullet points and professional language. Do not include markdown bolding markers like **."
    )
    
    result = await coach.get_completion(prompt)
    return {"draft": result}

@router.post("/draft-instructions")
async def draft_instructions(
    company: str = Form(...),
    role: str = Form(...),
    process: str = Form(...), # e.g. "Online test, Technical, HR"
    coach=Depends(get_ai_coach)
):
    if not coach:
        return {"error": "AI Service not configured."}
    
    prompt = (
        f"Draft clear student instructions for the recruitment process of {company} for the {role} position.\n\n"
        f"Process details:\n{process}\n\n"
        "Structure the instructions round-by-round (e.g., Round 1: Online Test, Round 2: Technical Interview).\n"
        "Include preparation tips for each round and general advice for students. Do not use markdown bolding."
    )
    
    result = await coach.get_completion(prompt)
    return {"instructions": result}
