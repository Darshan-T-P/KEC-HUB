from fastapi import Depends, HTTPException
from .database.db import get_db, mongodb_ok
from .database.repositories import (
    UserRepository,
    OtpRepository,
    VerifiedEmailRepository,
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

def get_user_repo(db = Depends(get_db)):
    return UserRepository(db)

def get_otp_repo(db = Depends(get_db)):
    return OtpRepository(db)

def get_verified_repo(db = Depends(get_db)):
    return VerifiedEmailRepository(db)

def get_auth_service(
    otp_repo = Depends(get_otp_repo),
    verified_repo = Depends(get_verified_repo),
    user_repo = Depends(get_user_repo)
):
    return AuthService(otp_repo=otp_repo, verified_repo=verified_repo, user_repo=user_repo)

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
