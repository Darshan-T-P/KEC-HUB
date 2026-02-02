from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field, field_validator
from pydantic.networks import AnyUrl
from typing import Literal


UserRole = Literal["student", "event_manager", "alumni", "management"]


class SendOtpRequest(BaseModel):
    email: EmailStr


class VerifyOtpRequest(BaseModel):
    email: EmailStr
    otp: str = Field(min_length=4, max_length=12)


class ApiResponse(BaseModel):
    success: bool
    message: str


class UserPublic(BaseModel):
    name: str
    email: EmailStr
    department: str
    role: UserRole = "student"


class ProjectItem(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=1, max_length=2000)
    link: AnyUrl | None = None

    @field_validator("link", mode="before")
    @classmethod
    def _empty_link_to_none(cls, v):
        if v == "":
            return None
        return v


class ResumeMeta(BaseModel):
    originalName: str
    storedName: str
    contentType: str
    size: int
    uploadedAt: str
    url: str


class UserProfile(UserPublic):
    roll_number: str | None = Field(default=None, min_length=1, max_length=32)
    dob: str | None = None  # ISO date string (YYYY-MM-DD)
    personal_email: EmailStr | None = None
    phone_number: str | None = Field(default=None, pattern=r"^\+?\d{10,15}$")

    cgpa: float | None = None
    arrears_history: int | None = None

    interests: list[str] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    achievements: list[str] = Field(default_factory=list)
    blogs: list[str] = Field(default_factory=list)

    linkedin_url: AnyUrl | None = None
    github_url: AnyUrl | None = None
    leetcode_url: AnyUrl | None = None
    portfolio_url: AnyUrl | None = None

    projects: list[ProjectItem] = Field(default_factory=list)
    resume: ResumeMeta | None = None


class AuthUserResponse(ApiResponse):
    user: UserProfile | None = None


class ProfileResponse(ApiResponse):
    profile: UserProfile | None = None


class ProfileUpdateRequest(BaseModel):
    # All optional: partial updates allowed
    name: str | None = Field(default=None, min_length=2, max_length=80)
    department: str | None = Field(default=None, min_length=2, max_length=80)
    roll_number: str | None = Field(default=None, min_length=1, max_length=32)
    dob: str | None = None
    personal_email: EmailStr | None = None
    phone_number: str | None = Field(default=None, pattern=r"^\+?\d{10,15}$")

    cgpa: float | None = Field(default=None, ge=0, le=10)
    arrears_history: int | None = Field(default=None, ge=0, le=99)

    interests: list[str] | None = None
    skills: list[str] | None = None
    achievements: list[str] | None = None
    blogs: list[str] | None = None

    linkedin_url: AnyUrl | None = None
    github_url: AnyUrl | None = None
    leetcode_url: AnyUrl | None = None
    portfolio_url: AnyUrl | None = None

    projects: list[ProjectItem] | None = None

    @field_validator(
        "roll_number",
        "dob",
        "personal_email",
        "phone_number",
        "linkedin_url",
        "github_url",
        "leetcode_url",
        "portfolio_url",
        mode="before",
    )
    @classmethod
    def _empty_str_to_none(cls, v):
        if v == "":
            return None
        if isinstance(v, str):
            return v.strip()
        return v


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    department: str = Field(default="Computer Science", min_length=2, max_length=80)
    role: UserRole = "student"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
    role: UserRole = "student"


class OpportunityItem(BaseModel):
    id: str
    title: str
    company: str
    type: str
    source: str
    matchMethod: str | None = None
    deadline: str | None = None
    description: str
    tags: list[str] = Field(default_factory=list)
    location: str
    postedDate: str | None = None
    eligibility: str = "See source page"
    requirements: list[str] = Field(default_factory=list)
    sourceUrl: str
    score: float = 0.0
    reasons: list[str] = Field(default_factory=list)


class OpportunitiesResponse(ApiResponse):
    opportunities: list[OpportunityItem] = Field(default_factory=list)
    generatedAt: str | None = None
    groqEnabled: bool = False
    groqUsed: bool = False
    webSearchEnabled: bool = False
    webSearchProvider: str | None = None
    webSearchUsed: bool = False
    webSearchError: str | None = None


class AlumniPublic(BaseModel):
    name: str
    email: EmailStr
    department: str
    role: UserRole = "alumni"


class AlumniPostCreateRequest(BaseModel):
    alumniEmail: EmailStr
    role: UserRole = "alumni"
    title: str = Field(min_length=3, max_length=160)
    description: str = Field(min_length=3, max_length=4000)
    tags: list[str] = Field(default_factory=list, max_length=20)
    link: AnyUrl | None = None

    @field_validator("link", mode="before")
    @classmethod
    def _empty_link_to_none_2(cls, v):
        if v is None:
            return None
        if isinstance(v, str):
            cleaned = v.strip()
            if cleaned == "":
                return None
            if not (cleaned.startswith("http://") or cleaned.startswith("https://")):
                # Common user input: "www.example.com" or "example.com".
                cleaned = f"https://{cleaned}"
            return cleaned
        return v


class AlumniPost(BaseModel):
    id: str
    alumniEmail: EmailStr
    title: str
    description: str
    tags: list[str] = Field(default_factory=list)
    link: str | None = None
    createdAt: str


class AlumniPostListResponse(ApiResponse):
    posts: list[AlumniPost] = Field(default_factory=list)


class AlumniListResponse(ApiResponse):
    alumni: list[AlumniPublic] = Field(default_factory=list)


ReferralStatus = Literal["pending", "approved", "rejected"]


class PlacementResourceItem(BaseModel):
    label: str = Field(min_length=1, max_length=80)
    url: str = Field(min_length=1, max_length=500)


class PlacementCreateRequest(BaseModel):
    staffEmail: EmailStr
    role: UserRole = "management"

    companyName: str = Field(min_length=2, max_length=120)
    title: str = Field(min_length=3, max_length=160)
    description: str = Field(min_length=3, max_length=6000)
    instructions: str | None = Field(default=None, max_length=6000)

    visitDate: str | None = None  # ISO date or datetime string
    applicationDeadline: str | None = None  # ISO date or datetime string
    location: str | None = Field(default=None, max_length=200)
    applyUrl: str | None = Field(default=None, max_length=500)

    # Visibility / eligibility
    allowedDepartments: list[str] = Field(default_factory=list, max_length=50)
    minCgpa: float | None = Field(default=None, ge=0, le=10)
    maxArrears: int | None = Field(default=None, ge=0, le=99)

    resources: list[PlacementResourceItem] = Field(default_factory=list, max_length=30)

    @field_validator(
        "instructions",
        "visitDate",
        "applicationDeadline",
        "location",
        "applyUrl",
        mode="before",
    )
    @classmethod
    def _empty_str_to_none_placement(cls, v):
        if v == "":
            return None
        if isinstance(v, str):
            return v.strip()
        return v


class PlacementItem(BaseModel):
    id: str
    staffEmail: EmailStr
    companyName: str
    title: str
    description: str
    instructions: str | None = None
    visitDate: str | None = None
    applicationDeadline: str | None = None
    location: str | None = None
    applyUrl: str | None = None
    allowedDepartments: list[str] = Field(default_factory=list)
    minCgpa: float | None = None
    maxArrears: int | None = None
    resources: list[PlacementResourceItem] = Field(default_factory=list)
    createdAt: str


class PlacementListResponse(ApiResponse):
    notices: list[PlacementItem] = Field(default_factory=list)


class ManagementInstructionCreateRequest(BaseModel):
    staffEmail: EmailStr
    role: UserRole = "management"
    title: str = Field(min_length=3, max_length=160)
    body: str = Field(min_length=3, max_length=8000)
    allowedDepartments: list[str] = Field(default_factory=list, max_length=50)


class ManagementInstructionItem(BaseModel):
    id: str
    staffEmail: EmailStr
    title: str
    body: str
    allowedDepartments: list[str] = Field(default_factory=list)
    createdAt: str


class ManagementInstructionListResponse(ApiResponse):
    items: list[ManagementInstructionItem] = Field(default_factory=list)


class ManagementNoteFileMeta(BaseModel):
    originalName: str
    storedName: str
    contentType: str
    size: int
    uploadedAt: str
    url: str


class ManagementNoteItem(BaseModel):
    id: str
    staffEmail: EmailStr
    title: str
    description: str | None = None
    allowedDepartments: list[str] = Field(default_factory=list)
    file: ManagementNoteFileMeta
    createdAt: str


class ManagementNoteListResponse(ApiResponse):
    items: list[ManagementNoteItem] = Field(default_factory=list)


class ResumeImprovement(BaseModel):
    area: str
    recommendation: str
    example: str | None = None


class ResumeAnalysisResult(BaseModel):
    overallFitScore: int = Field(default=0, ge=0, le=100)
    strengths: list[str] = Field(default_factory=list)
    gaps: list[str] = Field(default_factory=list)
    improvements: list[ResumeImprovement] = Field(default_factory=list)
    missingKeywords: list[str] = Field(default_factory=list)
    suggestedSummary: str | None = None
    suggestedBullets: list[str] = Field(default_factory=list)
    atsWarnings: list[str] = Field(default_factory=list)
    finalFeedback: str | None = None


class ResumeAnalysisResponse(ApiResponse):
    groqEnabled: bool = False
    model: str | None = None
    result: ResumeAnalysisResult | None = None


class ReferralRequestCreate(BaseModel):
    studentEmail: EmailStr
    studentRole: UserRole = "student"
    alumniEmail: EmailStr
    message: str = Field(min_length=1, max_length=2000)
    postId: str | None = None


class ReferralDecisionRequest(BaseModel):
    alumniEmail: EmailStr
    alumniRole: UserRole = "alumni"
    decision: ReferralStatus
    note: str | None = Field(default=None, max_length=2000)


class ReferralRequestItem(BaseModel):
    id: str
    studentEmail: EmailStr
    alumniEmail: EmailStr
    postId: str | None = None
    message: str
    status: ReferralStatus
    createdAt: str
    decidedAt: str | None = None
    alumniNote: str | None = None


class ReferralListResponse(ApiResponse):
    requests: list[ReferralRequestItem] = Field(default_factory=list)


class ChatSendRequest(BaseModel):
    senderEmail: EmailStr
    senderRole: UserRole
    recipientEmail: EmailStr
    recipientRole: UserRole
    text: str = Field(min_length=1, max_length=4000)


class ChatMessage(BaseModel):
    id: str
    threadId: str
    senderEmail: EmailStr
    senderRole: UserRole
    text: str
    createdAt: str


class ChatThread(BaseModel):
    id: str
    otherEmail: EmailStr
    otherRole: UserRole
    lastMessage: str | None = None
    lastAt: str | None = None


class ChatThreadsResponse(ApiResponse):
    threads: list[ChatThread] = Field(default_factory=list)


class ChatMessagesResponse(ApiResponse):
    messages: list[ChatMessage] = Field(default_factory=list)


EventFieldType = Literal["text", "textarea", "select"]


class EventFormField(BaseModel):
    key: str = Field(min_length=1, max_length=50, pattern=r"^[a-zA-Z0-9_]+$")
    label: str = Field(min_length=1, max_length=120)
    type: EventFieldType = "text"
    required: bool = True
    options: list[str] | None = None

    @field_validator("options", mode="before")
    @classmethod
    def _normalize_options(cls, v):
        if v is None:
            return None
        if isinstance(v, list):
            cleaned = [str(x).strip() for x in v if str(x).strip()]
            return cleaned or None
        return v


class PosterMeta(BaseModel):
    originalName: str
    storedName: str
    contentType: str
    size: int
    uploadedAt: str
    url: str


class EventCreateRequest(BaseModel):
    managerEmail: EmailStr
    role: UserRole = "event_manager"
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=3, max_length=6000)
    venue: str | None = Field(default=None, max_length=200)
    startAt: str = Field(min_length=10, max_length=64)  # ISO datetime
    endAt: str | None = Field(default=None, max_length=64)  # ISO datetime
    allowedDepartments: list[str] = Field(default_factory=list, max_length=50)
    formFields: list[EventFormField] = Field(default_factory=list, max_length=30)

    @field_validator("allowedDepartments", mode="before")
    @classmethod
    def _clean_depts(cls, v):
        if v is None:
            return []
        if isinstance(v, list):
            cleaned = [str(x).strip() for x in v if str(x).strip()]
            # Empty list means visible to all.
            return cleaned
        return v


class EventItem(BaseModel):
    id: str
    managerEmail: EmailStr
    title: str
    description: str
    venue: str | None = None
    startAt: str
    endAt: str | None = None
    allowedDepartments: list[str] = Field(default_factory=list)
    formFields: list[EventFormField] = Field(default_factory=list)
    poster: PosterMeta | None = None
    createdAt: str


class EventListResponse(ApiResponse):
    events: list[EventItem] = Field(default_factory=list)


class EventCreateResponse(ApiResponse):
    eventId: str | None = None


class EventRegistrationCreate(BaseModel):
    studentEmail: EmailStr
    studentRole: UserRole = "student"
    answers: dict[str, str] = Field(default_factory=dict)


class EventRegistrationItem(BaseModel):
    id: str
    eventId: str
    studentEmail: EmailStr
    studentDepartment: str | None = None
    answers: dict[str, str] = Field(default_factory=dict)
    createdAt: str


class EventRegistrationsResponse(ApiResponse):
    registrations: list[EventRegistrationItem] = Field(default_factory=list)
