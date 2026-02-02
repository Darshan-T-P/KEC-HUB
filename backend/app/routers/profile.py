import secrets
from pathlib import Path
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from ..models import ProfileResponse, ProfileUpdateRequest, UserRole, UserProfile
from ..deps import get_user_repo
from ..database.db import mongodb_ok

router = APIRouter(prefix="/profile", tags=["profile"])

_UPLOADS_DIR = Path(__file__).resolve().parents[2] / "uploads"
_RESUMES_DIR = _UPLOADS_DIR / "resumes"
_RESUMES_DIR.mkdir(parents=True, exist_ok=True)

def _is_allowed_domain(email: str) -> bool:
    domain = email.split("@")[-1].lower()
    return domain in {"kongu.edu", "kongu.ac.in"}

def _to_user_profile(user_doc: dict) -> UserProfile:
    profile = user_doc.get("profile") or {}
    return UserProfile(
        name=user_doc.get("name", "Student"),
        email=user_doc.get("email"),
        department=user_doc.get("department", "Computer Science"),
        role=user_doc.get("role", "student"),
        roll_number=profile.get("roll_number"),
        dob=profile.get("dob"),
        personal_email=profile.get("personal_email"),
        phone_number=profile.get("phone_number"),
        cgpa=profile.get("cgpa"),
        arrears_history=profile.get("arrears_history"),
        interests=profile.get("interests") or [],
        skills=profile.get("skills") or [],
        achievements=profile.get("achievements") or [],
        blogs=profile.get("blogs") or [],
        linkedin_url=profile.get("linkedin_url"),
        github_url=profile.get("github_url"),
        leetcode_url=profile.get("leetcode_url"),
        portfolio_url=profile.get("portfolio_url"),
        projects=profile.get("projects") or [],
        resume=profile.get("resume"),
    )

@router.get("/{email}", response_model=ProfileResponse)
async def get_profile(email: str, role: UserRole = "student", user_repo=Depends(get_user_repo)) -> ProfileResponse:
    if not _is_allowed_domain(email):
        return ProfileResponse(success=False, message="Only @kongu.edu or @kongu.ac.in emails are permitted.")
    if not mongodb_ok():
        return ProfileResponse(success=False, message="MongoDB is not connected. Start MongoDB and retry.")

    user_doc = await user_repo.find_public_by_email_and_role(email, role)
    if user_doc is None:
        return ProfileResponse(success=False, message="User not found.")

    return ProfileResponse(success=True, message="ok", profile=_to_user_profile(user_doc))

@router.put("/{email}", response_model=ProfileResponse)
async def update_profile(email: str, payload: ProfileUpdateRequest, role: UserRole = "student", user_repo=Depends(get_user_repo)) -> ProfileResponse:
    if not _is_allowed_domain(email):
        return ProfileResponse(success=False, message="Only @kongu.edu or @kongu.ac.in emails are permitted.")
    if not mongodb_ok():
        return ProfileResponse(success=False, message="MongoDB is not connected. Start MongoDB and retry.")

    core_update: dict = {}
    if payload.name is not None:
        core_update["name"] = payload.name
    if payload.department is not None:
        core_update["department"] = payload.department

    profile_update = payload.model_dump(exclude_none=True)
    profile_update.pop("name", None)
    profile_update.pop("department", None)

    if core_update:
        await user_repo.update_core_fields(email, role, core_update)

    user_doc = await user_repo.update_profile(email, role, profile_update)
    if user_doc is None:
        return ProfileResponse(success=False, message="User not found.")

    return ProfileResponse(success=True, message="Profile updated.", profile=_to_user_profile(user_doc))

@router.post("/{email}/resume", response_model=ProfileResponse)
async def upload_resume(email: str, file: UploadFile = File(...), role: UserRole = "student", user_repo=Depends(get_user_repo)) -> ProfileResponse:
    if not _is_allowed_domain(email):
        return ProfileResponse(success=False, message="Only @kongu.edu or @kongu.ac.in emails are permitted.")
    if not mongodb_ok():
        return ProfileResponse(success=False, message="MongoDB is not connected. Start MongoDB and retry.")

    if file.filename is None or not file.filename.strip():
        return ProfileResponse(success=False, message="Invalid filename.")

    allowed_ext = {".pdf", ".doc", ".docx"}
    original = Path(file.filename).name
    ext = Path(original).suffix.lower()
    if ext not in allowed_ext:
        return ProfileResponse(success=False, message="Only PDF/DOC/DOCX files are allowed.")

    token = secrets.token_hex(8)
    safe_identity = f"{role}_{email}".replace("@", "_").replace(".", "_")
    stored = f"{safe_identity}_{token}{ext}"
    dest = _RESUMES_DIR / stored

    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        return ProfileResponse(success=False, message="Resume too large (max 5MB).")

    dest.write_bytes(data)

    url = f"/uploads/resumes/{stored}"
    resume_meta = {
        "originalName": original,
        "storedName": stored,
        "contentType": file.content_type or "application/octet-stream",
        "size": len(data),
        "uploadedAt": datetime.now(timezone.utc).isoformat(),
        "url": url,
    }

    user_doc = await user_repo.update_profile(email, role, {"resume": resume_meta})
    if user_doc is None:
        return ProfileResponse(success=False, message="User not found.")

    return ProfileResponse(success=True, message="Resume uploaded.", profile=_to_user_profile(user_doc))
