from fastapi import APIRouter, Depends, Form, HTTPException
from ..deps import get_ai_advantage, get_user_repo
from ..models import UserRole

router = APIRouter(prefix="/ai-advantage", tags=["ai-advantage"])

@router.post("/strategic-prep")
async def strategic_prep(
    email: str,
    role: UserRole = "student",
    target_role: str = Form(...),
    company: str | None = Form(None),
    experience_level: str = Form("entry-level"),
    user_repo=Depends(get_user_repo),
    advantage=Depends(get_ai_advantage)
):
    if not advantage:
        return {"error": "AI Advantage is not configured."}
    
    user_doc = await user_repo.find_public_by_email_and_role(email, role)
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    profile = user_doc.get("profile") or {}
    skills = profile.get("skills") or []
    
    result = await advantage.strategic_preparation(
        target_role=target_role,
        company=company,
        skills=skills,
        experience_level=experience_level
    )
    return result

@router.post("/cover-letter")
async def cover_letter(
    email: str,
    role: UserRole = "student",
    job_title: str = Form(...),
    company: str = Form(...),
    job_description: str = Form(...),
    user_repo=Depends(get_user_repo),
    advantage=Depends(get_ai_advantage)
):
    if not advantage:
        return {"error": "AI Advantage is not configured."}
    
    user_doc = await user_repo.find_public_by_email_and_role(email, role)
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    profile = user_doc.get("profile") or {}
    # Enrich profile with name and other relevant fields
    user_profile = {
        "name": user_doc.get("name", "Candidate"),
        "skills": profile.get("skills") or [],
        "projects": profile.get("projects") or [],
        "achievements": profile.get("achievements") or []
    }
    
    result = await advantage.generate_cover_letter(
        job_title=job_title,
        company=company,
        job_description=job_description,
        user_profile=user_profile
    )
    return result
