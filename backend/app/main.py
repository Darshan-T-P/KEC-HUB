from __future__ import annotations

import os
import secrets
import csv
import io
from datetime import datetime, timezone
from pathlib import Path

from fastapi import File, UploadFile
from fastapi import FastAPI
from fastapi import Form
from fastapi import Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, StreamingResponse
from bson import ObjectId
import anyio

try:
    from pypdf import PdfReader  # type: ignore
except Exception:  # pragma: no cover
    PdfReader = None  # type: ignore

try:
    from pdfminer.high_level import extract_text as _pdfminer_extract_text  # type: ignore
except Exception:  # pragma: no cover
    _pdfminer_extract_text = None  # type: ignore

from .auth_service import AuthService
from .database.db import connect_mongodb, disconnect_mongodb, get_db, mongodb_ok
from .models import (
    ApiResponse,
    AlumniListResponse,
    AlumniPost,
    AlumniPostCreateRequest,
    AlumniPostListResponse,
    AuthUserResponse,
    EventCreateRequest,
    EventCreateResponse,
    EventItem,
    EventListResponse,
    EventRegistrationCreate,
    EventRegistrationsResponse,
    ChatMessagesResponse,
    ChatSendRequest,
    ChatThreadsResponse,
    LoginRequest,
    OpportunitiesResponse,
    OpportunityItem,
    ManagementInstructionCreateRequest,
    ManagementInstructionItem,
    ManagementInstructionListResponse,
    ManagementNoteItem,
    ManagementNoteListResponse,
    PlacementCreateRequest,
    PlacementItem,
    PlacementListResponse,
    ProfileResponse,
    ProfileUpdateRequest,
    RegisterRequest,
    ReferralDecisionRequest,
    ReferralListResponse,
    ReferralRequestCreate,
    ResumeAnalysisResponse,
    ResumeAnalysisResult,
    ResumeImprovement,
    SendOtpRequest,
    UserProfile,
    UserRole,
    VerifyOtpRequest,
)
from .database.repositories import (
    AlumniPostRepository,
    ChatMessageRepository,
    ChatThreadRepository,
    EventRegistrationRepository,
    EventRepository,
    ManagementInstructionRepository,
    ManagementNoteRepository,
    PlacementRepository,
    OtpRepository,
    ReferralRepository,
    UserRepository,
    VerifiedEmailRepository,
    make_thread_id,
)
from .email_sender import notify_referral_decision, notify_referral_request
from .settings import settings
from .models import ApiResponse
from .routers import auth, profile, student, alumni, management, events, chat, referrals, ml_feedback

app = FastAPI(title="KEC Opportunities Hub API")

_BACKEND_DIR = Path(__file__).resolve().parents[1]
_UPLOADS_DIR = _BACKEND_DIR / "uploads"
_RESUMES_DIR = _UPLOADS_DIR / "resumes"
_EVENT_POSTERS_DIR = _UPLOADS_DIR / "event_posters"
_MANAGEMENT_NOTES_DIR = _UPLOADS_DIR / "management_notes"

_RESUMES_DIR.mkdir(parents=True, exist_ok=True)
_EVENT_POSTERS_DIR.mkdir(parents=True, exist_ok=True)
_MANAGEMENT_NOTES_DIR.mkdir(parents=True, exist_ok=True)

# Serve uploaded files (resume) for development.
app.mount("/uploads", StaticFiles(directory=str(_UPLOADS_DIR)), name="uploads")

_auth_service: AuthService | None = None
_user_repo: UserRepository | None = None
_alumni_posts: AlumniPostRepository | None = None
_referrals: ReferralRepository | None = None
_chat_threads: ChatThreadRepository | None = None
_chat_messages: ChatMessageRepository | None = None
_events: EventRepository | None = None
_event_regs: EventRegistrationRepository | None = None
_placements: PlacementRepository | None = None
_mgmt_instructions: ManagementInstructionRepository | None = None
_mgmt_notes: ManagementNoteRepository | None = None
_opportunity_extractor = OpportunityExtractor()
_resume_analyzer: GroqResumeAnalyzer | None = None

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list(),
    allow_credentials=True,
    allow_methods=["*"] ,
    allow_headers=["*"],
)


@app.on_event("startup")
async def _startup() -> None:
    global _auth_service
    global _user_repo
    global _alumni_posts
    global _referrals
    global _chat_threads
    global _chat_messages
    global _events
    global _event_regs
    global _placements
    global _mgmt_instructions
    global _mgmt_notes
    global _resume_analyzer

    await connect_mongodb()
    if mongodb_ok():
        db = get_db()
        otp_repo = OtpRepository(db)
        verified_repo = VerifiedEmailRepository(db)
        user_repo = UserRepository(db)
        alumni_posts = AlumniPostRepository(db)
        referrals = ReferralRepository(db)
        chat_threads = ChatThreadRepository(db)
        chat_messages = ChatMessageRepository(db)
        events = EventRepository(db)
        event_regs = EventRegistrationRepository(db)
        placements = PlacementRepository(db)
        mgmt_instructions = ManagementInstructionRepository(db)
        mgmt_notes = ManagementNoteRepository(db)

        await otp_repo.ensure_indexes()
        await verified_repo.ensure_indexes()
        await user_repo.ensure_indexes()
        await alumni_posts.ensure_indexes()
        await referrals.ensure_indexes()
        await chat_threads.ensure_indexes()
        await chat_messages.ensure_indexes()
        await events.ensure_indexes()
        await event_regs.ensure_indexes()
        await placements.ensure_indexes()
        await mgmt_instructions.ensure_indexes()
        await mgmt_notes.ensure_indexes()

        _auth_service = AuthService(otp_repo=otp_repo, verified_repo=verified_repo, user_repo=user_repo)
        _user_repo = user_repo
        _alumni_posts = alumni_posts
        _referrals = referrals
        _chat_threads = chat_threads
        _chat_messages = chat_messages
        _events = events
        _event_regs = event_regs
        _placements = placements
        _mgmt_instructions = mgmt_instructions
        _mgmt_notes = mgmt_notes

    else:
        # Backend can still start, but auth endpoints will return a clear error.
        _auth_service = None
        _user_repo = None
        _alumni_posts = None
        _referrals = None
        _chat_threads = None
        _chat_messages = None
        _events = None
        _event_regs = None
        _placements = None
        _mgmt_instructions = None
        _mgmt_notes = None

    _resume_analyzer = GroqResumeAnalyzer.from_settings()


def _extract_resume_text_pdf(data: bytes) -> str:
    if not data:
        return ""

    def _clean(text: str) -> str:
        text = (text or "").replace("\x00", " ")
        # Light normalization; keep newlines for readability.
        text = "\n".join([line.rstrip() for line in text.splitlines()])
        return text.strip()

    extracted = ""

    if PdfReader is not None:
        try:
            reader = PdfReader(io.BytesIO(data))
            parts: list[str] = []
            for page in reader.pages:
                try:
                    txt = page.extract_text() or ""
                except Exception:
                    txt = ""
                if txt:
                    parts.append(txt)
            extracted = _clean("\n\n".join(parts))
        except Exception:
            extracted = ""

    if (not extracted or len(extracted) < 30) and _pdfminer_extract_text is not None:
        try:
            extracted2 = _pdfminer_extract_text(io.BytesIO(data)) or ""
            extracted2 = _clean(extracted2)
            if len(extracted2) > len(extracted):
                extracted = extracted2
        except Exception:
            pass

    return extracted


def _safe_str_list(v) -> list[str]:
    if not isinstance(v, list):
        return []
    out: list[str] = []
    for item in v:
        if isinstance(item, str) and item.strip():
            out.append(item.strip())
    return out


def _to_resume_analysis_result(obj: dict) -> ResumeAnalysisResult:
    improvements_raw = obj.get("improvements")
    improvements: list[ResumeImprovement] = []
    if isinstance(improvements_raw, list):
        for it in improvements_raw:
            if not isinstance(it, dict):
                continue
            area = (it.get("area") or "").strip()
            rec = (it.get("recommendation") or "").strip()
            ex = it.get("example")
            ex_s = ex.strip() if isinstance(ex, str) and ex.strip() else None
            if area and rec:
                improvements.append(ResumeImprovement(area=area, recommendation=rec, example=ex_s))

    score = obj.get("overallFitScore")
    try:
        score_i = int(score)
    except Exception:
        score_i = 0
    score_i = max(0, min(100, score_i))

    suggested_summary = obj.get("suggestedSummary")
    if not isinstance(suggested_summary, str):
        suggested_summary = None
    else:
        suggested_summary = suggested_summary.strip() or None

    final_feedback = obj.get("finalFeedback")
    if not isinstance(final_feedback, str):
        final_feedback = None
    else:
        final_feedback = final_feedback.strip() or None

    return ResumeAnalysisResult(
        overallFitScore=score_i,
        strengths=_safe_str_list(obj.get("strengths")),
        gaps=_safe_str_list(obj.get("gaps")),
        improvements=improvements,
        missingKeywords=_safe_str_list(obj.get("missingKeywords")),
        suggestedSummary=suggested_summary,
        suggestedBullets=_safe_str_list(obj.get("suggestedBullets")),
        atsWarnings=_safe_str_list(obj.get("atsWarnings")),
        finalFeedback=final_feedback,
    )


@app.post("/resume/analyze", response_model=ResumeAnalysisResponse)
async def analyze_resume(
    email: str = Query(...),
    role: UserRole = Query("student"),
    jobDescription: str = Form(...),
    file: UploadFile = File(...),
) -> ResumeAnalysisResponse:
    if role != "student":
        return ResumeAnalysisResponse(success=False, message="Only students can use resume analysis.")

    if _user_repo is None:
        return ResumeAnalysisResponse(success=False, message="Database not ready.")

    user_doc = await _user_repo.find_public_by_email_and_role(email, role)
    if not user_doc:
        return ResumeAnalysisResponse(success=False, message="User not found.")

    if _resume_analyzer is None:
        return ResumeAnalysisResponse(success=False, message="Groq is not configured on the server.", groqEnabled=False)

    jd = (jobDescription or "").strip()
    if len(jd) < 20:
        return ResumeAnalysisResponse(success=False, message="Please provide a longer job description (at least 20 characters).", groqEnabled=True, model=_resume_analyzer.model)

    raw = await file.read()
    if raw is None:
        raw = b""

    max_bytes = 5 * 1024 * 1024
    if len(raw) > max_bytes:
        return ResumeAnalysisResponse(success=False, message="Resume too large (max 5MB).", groqEnabled=True, model=_resume_analyzer.model)

    filename = (file.filename or "").lower()
    content_type = (file.content_type or "").lower()

    resume_text = ""
    if filename.endswith(".pdf") or content_type == "application/pdf":
        if PdfReader is None and _pdfminer_extract_text is None:
            return ResumeAnalysisResponse(
                success=False,
                message="PDF text extraction is not available on the server. Install 'pypdf' or 'pdfminer.six' and restart the backend.",
                groqEnabled=True,
                model=_resume_analyzer.model,
            )
        resume_text = _extract_resume_text_pdf(raw)
    else:
        try:
            resume_text = raw.decode("utf-8", errors="ignore").strip()
        except Exception:
            resume_text = ""

    if not resume_text or len(resume_text) < 30:
        return ResumeAnalysisResponse(
            success=False,
            message="Could not extract readable text from the resume. Please upload a text-based PDF (not scanned) or a .txt resume.",
            groqEnabled=True,
            model=_resume_analyzer.model,
        )

    obj = await _resume_analyzer.analyze(resume_text=resume_text, job_description=jd)
    if not obj:
        return ResumeAnalysisResponse(success=False, message="Resume analysis failed. Try again later.", groqEnabled=True, model=_resume_analyzer.model)

    result = _to_resume_analysis_result(obj)

    return ResumeAnalysisResponse(
        success=True,
        message="Resume analysis generated.",
        groqEnabled=True,
        model=_resume_analyzer.model,
        result=result,
    )


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def _parse_dt(s: str) -> datetime:
    raw = (s or "").strip()
    if not raw:
        raise ValueError("Invalid datetime")
    if raw.endswith("Z"):
        raw = raw[:-1] + "+00:00"
    return datetime.fromisoformat(raw)


def _doc_id(d: dict) -> str:
    _id = d.get("_id")
    return str(_id) if _id is not None else ""


def _require_role(actual: str, expected: str) -> None:
    if (actual or "").strip().lower() != expected:
        raise ValueError(f"Role must be {expected}.")


def _to_event_item(d: dict) -> EventItem:
    start_at = d.get("startAt")
    end_at = d.get("endAt")
    created = d.get("createdAt")
    return EventItem(
        id=_doc_id(d),
        managerEmail=d.get("managerEmail"),
        title=d.get("title", ""),
        description=d.get("description", ""),
        venue=d.get("venue"),
        startAt=_iso(start_at) if isinstance(start_at, datetime) else str(start_at or ""),
        endAt=_iso(end_at) if isinstance(end_at, datetime) else (str(end_at) if end_at else None),
        allowedDepartments=d.get("allowedDepartments") or [],
        formFields=d.get("formFields") or [],
        poster=d.get("poster"),
        createdAt=_iso(created) if isinstance(created, datetime) else str(created or ""),
    )


def _to_placement_item(d: dict) -> PlacementItem:
    created = d.get("createdAt")
    return PlacementItem(
        id=_doc_id(d),
        staffEmail=d.get("staffEmail"),
        companyName=d.get("companyName", ""),
        title=d.get("title", ""),
        description=d.get("description", ""),
        instructions=d.get("instructions"),
        visitDate=d.get("visitDate"),
        applicationDeadline=d.get("applicationDeadline"),
        location=d.get("location"),
        applyUrl=d.get("applyUrl"),
        allowedDepartments=d.get("allowedDepartments") or [],
        minCgpa=d.get("minCgpa"),
        maxArrears=d.get("maxArrears"),
        resources=d.get("resources") or [],
        createdAt=_iso(created) if isinstance(created, datetime) else str(created or ""),
    )


def _to_instruction_item(d: dict) -> ManagementInstructionItem:
    created = d.get("createdAt")
    return ManagementInstructionItem(
        id=_doc_id(d),
        staffEmail=d.get("staffEmail"),
        title=d.get("title", ""),
        body=d.get("body", ""),
        allowedDepartments=d.get("allowedDepartments") or [],
        createdAt=_iso(created) if isinstance(created, datetime) else str(created or ""),
    )


def _to_note_item(d: dict) -> ManagementNoteItem:
    created = d.get("createdAt")
    return ManagementNoteItem(
        id=_doc_id(d),
        staffEmail=d.get("staffEmail"),
        title=d.get("title", ""),
        description=d.get("description"),
        allowedDepartments=d.get("allowedDepartments") or [],
        file=d.get("file") or {},
        createdAt=_iso(created) if isinstance(created, datetime) else str(created or ""),
    )


def _normalize_allowed_departments(raw: list[str] | None) -> tuple[list[str], list[str]]:
    allowed = [str(d).strip() for d in (raw or []) if str(d).strip()]
    if any(d.lower() in {"all", "*"} for d in allowed):
        allowed = []
    return allowed, [d.lower() for d in allowed]


def _parse_departments_csv(raw: str | None) -> list[str]:
    if raw is None:
        return []
    s = str(raw).strip()
    if not s:
        return []
    if s.lower() in {"all", "*"}:
        return ["all"]
    return [p.strip() for p in s.split(",") if p.strip()]


@app.on_event("shutdown")
async def _shutdown() -> None:
    await disconnect_mongodb()


@app.get("/health", response_model=ApiResponse)
def health() -> ApiResponse:
    return ApiResponse(success=True, message=f"ok (db: {'connected' if mongodb_ok() else 'disconnected'})")

# Include Routers
app.include_router(auth.router)
app.include_router(profile.router)
app.include_router(student.router)
app.include_router(alumni.router)
app.include_router(management.router)
app.include_router(events.router)
app.include_router(chat.router)
app.include_router(referrals.router)
app.include_router(ml_feedback.router)
