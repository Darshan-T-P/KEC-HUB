from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import jwt
from .database.db import get_db, get_kec_hub_db, mongodb_ok
from .settings import settings
from .database.repositories import (
    UserRepository,
    OtpRepository,
    VerifiedEmailRepository,
    AuthorizedEmailRepository,
    AlumniPostRepository,
    ReferralRepository,
    ChatThreadRepository,
    ChatMessageRepository,
    EventRepository,
    EventRegistrationRepository,
    PlacementRepository,
    ManagementInstructionRepository,
    ManagementNoteRepository,
)
from .auth_service import AuthService
from .resume_analyzer import GroqResumeAnalyzer
from .opportunity_extractor.extractor import OpportunityExtractor

from .ai_coach import AICoachService
from .gemini_advantage import GeminiAdvantageService

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)


def get_user_repo(db = Depends(get_db)):
    return UserRepository(db)

# Authentication Dependency
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    user_repo: UserRepository = Depends(get_user_repo)
) -> dict:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception

    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        email: str = payload.get("sub")
        role: str = payload.get("role")
        if email is None or role is None:
            raise credentials_exception
    except Exception:
        raise credentials_exception
    
    user = await user_repo.find_by_email_and_role(email, role)
    if user is None:
        raise credentials_exception
    return user

def get_otp_repo(db = Depends(get_db)):
    return OtpRepository(db)

def get_verified_repo(db = Depends(get_db)):
    return VerifiedEmailRepository(db)

def get_authorized_email_repo(db = Depends(get_kec_hub_db)):
    return AuthorizedEmailRepository(db)

def get_auth_service(
    otp_repo = Depends(get_otp_repo),
    verified_repo = Depends(get_verified_repo),
    user_repo = Depends(get_user_repo),
    auth_email_repo = Depends(get_authorized_email_repo)
):
    return AuthService(
        otp_repo=otp_repo,
        verified_repo=verified_repo,
        user_repo=user_repo,
        auth_email_repo=auth_email_repo
    )

def get_alumni_posts_repo(db = Depends(get_db)):
    return AlumniPostRepository(db)

def get_referral_repo(db = Depends(get_db)):
    return ReferralRepository(db)

def get_chat_thread_repo(db = Depends(get_db)):
    return ChatThreadRepository(db)

def get_chat_message_repo(db = Depends(get_db)):
    return ChatMessageRepository(db)

def get_event_repo(db = Depends(get_db)):
    return EventRepository(db)

def get_event_reg_repo(db = Depends(get_db)):
    return EventRegistrationRepository(db)

def get_placement_repo(db = Depends(get_db)):
    return PlacementRepository(db)

def get_mgmt_instruction_repo(db = Depends(get_db)):
    return ManagementInstructionRepository(db)

def get_mgmt_note_repo(db = Depends(get_db)):
    return ManagementNoteRepository(db)

_opportunity_extractor = OpportunityExtractor()
def get_opportunity_extractor():
    return _opportunity_extractor

def get_resume_analyzer():
    analyzer = GroqResumeAnalyzer.from_settings()
    return analyzer

def get_ai_coach():
    return AICoachService.from_settings()

def get_ai_advantage():
    return GeminiAdvantageService.from_settings()
