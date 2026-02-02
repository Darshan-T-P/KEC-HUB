import anyio
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query
from ..models import ApiResponse, ReferralRequestCreate, ReferralListResponse, ReferralDecisionRequest, UserRole
from ..deps import get_user_repo, get_referral_repo, get_alumni_posts_repo
from ..database.db import mongodb_ok
from ..email_sender import notify_referral_decision, notify_referral_request

router = APIRouter(prefix="/referrals", tags=["referrals"])

def _is_allowed_domain(email: str) -> bool:
    domain = email.split("@")[-1].lower()
    return domain in {"kongu.edu", "kongu.ac.in"}

def _doc_id(d: dict) -> str:
    _id = d.get("_id")
    return str(_id) if _id is not None else ""

def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()

@router.post("/request", response_model=ApiResponse)
async def request_referral(payload: ReferralRequestCreate, referral_repo=Depends(get_referral_repo), user_repo=Depends(get_user_repo), alumni_posts=Depends(get_alumni_posts_repo)) -> ApiResponse:
    if not _is_allowed_domain(str(payload.studentEmail)) or not _is_allowed_domain(str(payload.alumniEmail)):
        return ApiResponse(success=False, message="Only @kongu.edu or @kongu.ac.in emails are permitted.")
    if not mongodb_ok():
        return ApiResponse(success=False, message="MongoDB is not connected.")
    
    if (payload.studentRole or "student") != "student":
        return ApiResponse(success=False, message="studentRole must be student.")

    student = await user_repo.find_public_by_email_and_role(str(payload.studentEmail), "student")
    if student is None:
        return ApiResponse(success=False, message="Student not found.")
    alumni = await user_repo.find_public_by_email_and_role(str(payload.alumniEmail), "alumni")
    if alumni is None:
        return ApiResponse(success=False, message="Alumni not found.")

    if payload.postId:
        exists = await referral_repo.exists_for_student_alumni_post(str(payload.studentEmail), str(payload.alumniEmail), payload.postId)
        if exists:
            return ApiResponse(success=False, message="You already requested a referral for this post.")

    await referral_repo.create({
        "studentEmail": str(payload.studentEmail),
        "studentRole": "student",
        "alumniEmail": str(payload.alumniEmail),
        "alumniRole": "alumni",
        "postId": payload.postId,
        "message": payload.message,
        "status": "pending",
        "createdAt": datetime.now(timezone.utc),
        "decidedAt": None,
        "alumniNote": None,
    })

    post_title = None
    if payload.postId:
        post = await alumni_posts.get_by_id(payload.postId)
        if post:
            post_title = post.get("title")

    try:
        await anyio.to_thread.run_sync(notify_referral_request, str(payload.alumniEmail), str(payload.studentEmail), payload.message, post_title)
    except Exception as e:
        print(f"[NOTIFY] referral request email failed: {e}")

    return ApiResponse(success=True, message="Referral request sent.")

@router.get("/inbox/{email}", response_model=ReferralListResponse)
async def referral_inbox(email: str, role: UserRole = "alumni", status: str | None = None, referral_repo=Depends(get_referral_repo)) -> ReferralListResponse:
    if not _is_allowed_domain(email):
        return ReferralListResponse(success=False, message="Only @kongu.edu or @kongu.ac.in emails are permitted.")
    if not mongodb_ok():
        return ReferralListResponse(success=False, message="MongoDB is not connected.")
    
    if role != "alumni":
        return ReferralListResponse(success=False, message="Role must be alumni.")

    docs = await referral_repo.list_for_alumni(email, status=status)
    items = [{
        "id": _doc_id(d),
        "studentEmail": d.get("studentEmail"),
        "alumniEmail": d.get("alumniEmail"),
        "postId": d.get("postId"),
        "message": d.get("message", ""),
        "status": d.get("status", "pending"),
        "createdAt": _iso(d.get("createdAt")) if isinstance(d.get("createdAt"), datetime) else "",
        "decidedAt": _iso(d.get("decidedAt")) if isinstance(d.get("decidedAt"), datetime) else None,
        "alumniNote": d.get("alumniNote"),
    } for d in docs]
    return ReferralListResponse(success=True, message="ok", requests=items)

@router.get("/outbox/{email}", response_model=ReferralListResponse)
async def referral_outbox(email: str, role: UserRole = "student", referral_repo=Depends(get_referral_repo)) -> ReferralListResponse:
    if not _is_allowed_domain(email):
        return ReferralListResponse(success=False, message="Only @kongu.edu or @kongu.ac.in emails are permitted.")
    if not mongodb_ok():
        return ReferralListResponse(success=False, message="MongoDB is not connected.")
    
    if role != "student":
        return ReferralListResponse(success=False, message="Role must be student.")

    docs = await referral_repo.list_for_student(email)
    items = [{
        "id": _doc_id(d),
        "studentEmail": d.get("studentEmail"),
        "alumniEmail": d.get("alumniEmail"),
        "postId": d.get("postId"),
        "message": d.get("message", ""),
        "status": d.get("status", "pending"),
        "createdAt": _iso(d.get("createdAt")) if isinstance(d.get("createdAt"), datetime) else "",
        "decidedAt": _iso(d.get("decidedAt")) if isinstance(d.get("decidedAt"), datetime) else None,
        "alumniNote": d.get("alumniNote"),
    } for d in docs]
    return ReferralListResponse(success=True, message="ok", requests=items)

@router.post("/{req_id}/decide", response_model=ApiResponse)
async def decide_referral(req_id: str, payload: ReferralDecisionRequest, referral_repo=Depends(get_referral_repo), alumni_posts=Depends(get_alumni_posts_repo)) -> ApiResponse:
    if not _is_allowed_domain(str(payload.alumniEmail)):
        return ApiResponse(success=False, message="Only @kongu.edu or @kongu.ac.in emails are permitted.")
    if not mongodb_ok():
        return ApiResponse(success=False, message="MongoDB is not connected.")
    
    if payload.alumniRole != "alumni":
        return ApiResponse(success=False, message="Role must be alumni.")

    updated = await referral_repo.decide(req_id, str(payload.alumniEmail), payload.decision, datetime.now(timezone.utc), payload.note)
    if updated is None:
        return ApiResponse(success=False, message="Invalid request id.")

    student_email = str(updated.get("studentEmail") or "")
    post_title = None
    post_id = updated.get("postId")
    if post_id:
        post = await alumni_posts.get_by_id(str(post_id))
        if post:
            post_title = post.get("title")

    if student_email:
        try:
            await anyio.to_thread.run_sync(notify_referral_decision, student_email, str(payload.alumniEmail), payload.decision, payload.note, post_title)
        except Exception as e:
            print(f"[NOTIFY] referral decision email failed: {e}")

    return ApiResponse(success=True, message="Decision saved.")
