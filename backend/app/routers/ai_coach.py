from fastapi import APIRouter, Depends, Form, HTTPException
from ..deps import get_ai_coach, get_user_repo
from ..models import UserRole, ApiResponse

router = APIRouter(prefix="/ai-coach", tags=["ai-coach"])

@router.post("/get-tips")
async def get_tips(
    question: str = Form(...),
    user_answer: str | None = Form(None),
    coach=Depends(get_ai_coach)
):
    if not coach:
        return {"error": "AI Coach is not configured."}
    
    result = await coach.get_interview_tips(question, user_answer)
    return result

@router.post("/start-prep")
async def start_prep(
    email: str,
    role: UserRole = "student",
    target_role: str | None = Form(None),
    difficulty: str = Form("medium"),
    user_repo=Depends(get_user_repo),
    coach=Depends(get_ai_coach)
):
    if not coach:
        return {"error": "AI Coach is not configured."}
    
    user_doc = await user_repo.find_public_by_email_and_role(email, role)
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    profile = user_doc.get("profile") or {}
    skills = profile.get("skills") or []
    department = user_doc.get("department") or "General"
    
    result = await coach.start_interview_prep(
        role=role,
        department=department,
        skills=skills,
        target_role=target_role,
        difficulty=difficulty
    )
    return result
