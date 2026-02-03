from fastapi import APIRouter, Depends, HTTPException
from ..models import (
    SendOtpRequest, VerifyOtpRequest, RegisterRequest, LoginRequest, 
    CheckUserRequest, ResetPasswordRequest, ApiResponse, AuthUserResponse, UserProfile
)
from ..deps import get_auth_service
from ..database.db import mongodb_ok

router = APIRouter(prefix="/auth", tags=["auth"])

def _is_allowed_domain(email: str) -> bool:
    domain = email.split("@")[-1].lower()
    return domain in {"kongu.edu", "kongu.ac.in"}

@router.post("/check-user", response_model=ApiResponse)
async def check_user(payload: CheckUserRequest, auth_service=Depends(get_auth_service)) -> ApiResponse:
    if not mongodb_ok():
        return ApiResponse(success=False, message="MongoDB is not connected.")
    
    exists = await auth_service.check_user_exists(payload.email, payload.role)
    if exists:
        return ApiResponse(success=True, message="User already registered.")
    else:
        return ApiResponse(success=False, message="User not found.")

@router.post("/reset-password", response_model=ApiResponse)
async def reset_password(payload: ResetPasswordRequest, auth_service=Depends(get_auth_service)) -> ApiResponse:
    if not mongodb_ok():
        return ApiResponse(success=False, message="MongoDB is not connected.")
    
    try:
        await auth_service.reset_password(payload.email, payload.new_password, payload.role)
        return ApiResponse(success=True, message="Password reset successful!")
    except ValueError as e:
        return ApiResponse(success=False, message=str(e))

@router.post("/send-otp", response_model=ApiResponse)
async def send_otp(payload: SendOtpRequest, auth_service=Depends(get_auth_service)) -> ApiResponse:
    if not _is_allowed_domain(payload.email):
        return ApiResponse(success=False, message="Only @kongu.edu or @kongu.ac.in emails are permitted.")

    if not mongodb_ok():
        return ApiResponse(success=False, message="MongoDB is not connected. Start MongoDB and retry.")

    try:
        provider = await auth_service.send_otp(payload.email)
        if provider == "smtp":
            return ApiResponse(success=True, message="Verification code sent to your email.")
        return ApiResponse(success=True, message="OTP generated (dev console mode). Check backend logs.")
    except ValueError as e:
        return ApiResponse(success=False, message=str(e))
    except Exception:
        return ApiResponse(success=False, message="OTP send failed due to server configuration. Please contact admin.")

@router.post("/verify-otp", response_model=ApiResponse)
async def verify_otp(payload: VerifyOtpRequest, auth_service=Depends(get_auth_service)) -> ApiResponse:
    if not mongodb_ok():
        return ApiResponse(success=False, message="MongoDB is not connected. Start MongoDB and retry.")

    try:
        await auth_service.verify_otp(payload.email, payload.otp)
        return ApiResponse(success=True, message="OTP verified.")
    except ValueError as e:
        return ApiResponse(success=False, message=str(e))

@router.post("/register", response_model=AuthUserResponse)
async def register(payload: RegisterRequest, auth_service=Depends(get_auth_service)) -> AuthUserResponse:
    if not _is_allowed_domain(payload.email):
        return AuthUserResponse(success=False, message="Only @kongu.edu or @kongu.ac.in emails are permitted.")
    if not mongodb_ok():
        return AuthUserResponse(success=False, message="MongoDB is not connected. Start MongoDB and retry.")

    try:
        data = await auth_service.register(payload.name, payload.email, payload.password, payload.department, payload.role)
        return AuthUserResponse(
            success=True,
            message="Registration successful!",
            user=UserProfile(**data["user"]),
            accessToken=data["accessToken"]
        )
    except ValueError as e:
        return AuthUserResponse(success=False, message=str(e))

def _to_user_profile(user_doc: dict) -> UserProfile:
    profile_data = user_doc.get("profile") or {}
    return UserProfile(
        name=user_doc.get("name", "Student"),
        email=user_doc.get("email"),
        department=user_doc.get("department", "Computer Science"),
        role=user_doc.get("role", "student"),
        roll_number=profile_data.get("roll_number"),
        dob=profile_data.get("dob"),
        personal_email=profile_data.get("personal_email"),
        phone_number=profile_data.get("phone_number"),
        cgpa=profile_data.get("cgpa"),
        arrears_history=profile_data.get("arrears_history"),
        interests=profile_data.get("interests") or [],
        skills=profile_data.get("skills") or [],
        achievements=profile_data.get("achievements") or [],
        blogs=profile_data.get("blogs") or [],
        linkedin_url=profile_data.get("linkedin_url"),
        github_url=profile_data.get("github_url"),
        leetcode_url=profile_data.get("leetcode_url"),
        portfolio_url=profile_data.get("portfolio_url"),
        projects=profile_data.get("projects") or [],
        resume=profile_data.get("resume"),
    )

@router.post("/login", response_model=AuthUserResponse)
async def login(payload: LoginRequest, auth_service=Depends(get_auth_service)) -> AuthUserResponse:
    if not mongodb_ok():
        return AuthUserResponse(success=False, message="MongoDB is not connected. Start MongoDB and retry.")

    try:
        data = await auth_service.login(payload.email, payload.password, payload.role)
        return AuthUserResponse(
            success=True, 
            message="Login successful!", 
            user=_to_user_profile(data["user"]),
            accessToken=data["accessToken"]
        )
    except ValueError as e:
        return AuthUserResponse(success=False, message=str(e))
