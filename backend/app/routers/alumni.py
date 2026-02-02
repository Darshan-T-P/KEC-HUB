from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from ..models import (
    AlumniListResponse, 
    AlumniPostListResponse, 
    AlumniPost, 
    AlumniPostCreateRequest, 
    ApiResponse, 
    UserRole
)
from ..deps import get_user_repo, get_alumni_posts_repo
from ..database.db import mongodb_ok

router = APIRouter(prefix="/alumni", tags=["alumni"])

def _is_allowed_domain(email: str) -> bool:
    domain = email.split("@")[-1].lower()
    return domain in {"kongu.edu", "kongu.ac.in"}

def _doc_id(d: dict) -> str:
    _id = d.get("_id")
    return str(_id) if _id is not None else ""

def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()

@router.get("/list", response_model=AlumniListResponse)
async def list_alumni(limit: int = Query(default=50, ge=1, le=200), user_repo=Depends(get_user_repo)) -> AlumniListResponse:
    if not mongodb_ok():
        return AlumniListResponse(success=False, message="MongoDB is not connected. Start MongoDB and retry.")

    cur = user_repo.col.find({"role": "alumni"}, {"passwordHash": 0}).limit(int(limit))
    docs = [d async for d in cur]
    alumni = [
        {
            "name": d.get("name", "Alumni"),
            "email": d.get("email"),
            "department": d.get("department", ""),
            "role": d.get("role", "alumni"),
        }
        for d in docs
        if d.get("email")
    ]
    return AlumniListResponse(success=True, message="ok", alumni=alumni)

@router.get("/posts", response_model=AlumniPostListResponse)
async def list_alumni_posts(limit: int = Query(default=100, ge=1, le=300), alumni_posts=Depends(get_alumni_posts_repo)) -> AlumniPostListResponse:
    if not mongodb_ok():
        return AlumniPostListResponse(success=False, message="MongoDB is not connected. Start MongoDB and retry.")
    docs = await alumni_posts.list_all(limit=limit)
    posts = [
        AlumniPost(
            id=_doc_id(d),
            alumniEmail=d.get("alumniEmail"),
            title=d.get("title", ""),
            description=d.get("description", ""),
            tags=d.get("tags") or [],
            link=d.get("link"),
            createdAt=_iso(d.get("createdAt") or datetime.now(timezone.utc)),
        )
        for d in docs
    ]
    return AlumniPostListResponse(success=True, message="ok", posts=posts)

@router.get("/{email}/posts", response_model=AlumniPostListResponse)
async def list_posts_by_alumni(email: str, role: UserRole = "alumni", limit: int = Query(default=100, ge=1, le=300), alumni_posts=Depends(get_alumni_posts_repo)) -> AlumniPostListResponse:
    if not _is_allowed_domain(email):
        return AlumniPostListResponse(success=False, message="Only @kongu.edu or @kongu.ac.in emails are permitted.")
    if not mongodb_ok():
        return AlumniPostListResponse(success=False, message="MongoDB is not connected. Start MongoDB and retry.")
    
    if role != "alumni":
        return AlumniPostListResponse(success=False, message="Role must be alumni.")

    docs = await alumni_posts.list_by_alumni(email, limit=limit)
    posts = [
        AlumniPost(
            id=_doc_id(d),
            alumniEmail=d.get("alumniEmail"),
            title=d.get("title", ""),
            description=d.get("description", ""),
            tags=d.get("tags") or [],
            link=d.get("link"),
            createdAt=_iso(d.get("createdAt") or datetime.now(timezone.utc)),
        )
        for d in docs
    ]
    return AlumniPostListResponse(success=True, message="ok", posts=posts)

@router.post("/posts", response_model=ApiResponse)
async def create_alumni_post(payload: AlumniPostCreateRequest, alumni_posts=Depends(get_alumni_posts_repo), user_repo=Depends(get_user_repo)) -> ApiResponse:
    if not _is_allowed_domain(str(payload.alumniEmail)):
        return ApiResponse(success=False, message="Only @kongu.edu or @kongu.ac.in emails are permitted.")
    if not mongodb_ok():
        return ApiResponse(success=False, message="MongoDB is not connected. Start MongoDB and retry.")

    if payload.role != "alumni":
        return ApiResponse(success=False, message="Role must be alumni.")

    alumni_user = await user_repo.find_public_by_email_and_role(str(payload.alumniEmail), "alumni")
    if alumni_user is None:
        return ApiResponse(success=False, message="Alumni user not found.")

    await alumni_posts.create(
        {
            "alumniEmail": str(payload.alumniEmail),
            "title": payload.title,
            "description": payload.description,
            "tags": payload.tags,
            "link": str(payload.link) if payload.link else None,
            "createdAt": datetime.now(timezone.utc),
        }
    )
    return ApiResponse(success=True, message="Post created.")
