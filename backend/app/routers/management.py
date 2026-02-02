import io
import csv
import secrets
from pathlib import Path
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, Form, File, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse
from ..models import (
    ApiResponse, 
    PlacementCreateRequest, 
    PlacementListResponse, 
    PlacementItem,
    ManagementInstructionCreateRequest,
    ManagementInstructionListResponse,
    ManagementInstructionItem,
    ManagementNoteListResponse,
    ManagementNoteItem,
    UserRole
)
from ..deps import get_user_repo, get_placement_repo, get_mgmt_instruction_repo, get_mgmt_note_repo
from ..database.db import mongodb_ok
from ml.predict import recommend

router = APIRouter(tags=["management"])

_UPLOADS_DIR = Path(__file__).resolve().parents[2] / "uploads"
_MANAGEMENT_NOTES_DIR = _UPLOADS_DIR / "management_notes"
_MANAGEMENT_NOTES_DIR.mkdir(parents=True, exist_ok=True)

def _is_allowed_domain(email: str) -> bool:
    domain = email.split("@")[-1].lower()
    return domain in {"kongu.edu", "kongu.ac.in"}

def _doc_id(d: dict) -> str:
    _id = d.get("_id")
    return str(_id) if _id is not None else ""

def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()

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
        score=d.get("score", 0.0),
        reasons=d.get("reasons") or [],
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

@router.post("/placements", response_model=ApiResponse)
async def create_placement_notice(payload: PlacementCreateRequest, placement_repo=Depends(get_placement_repo), user_repo=Depends(get_user_repo)) -> ApiResponse:
    if not _is_allowed_domain(str(payload.staffEmail)):
        return ApiResponse(success=False, message="Only @kongu.edu or @kongu.ac.in emails are permitted.")
    if not mongodb_ok():
        return ApiResponse(success=False, message="MongoDB is not connected. Start MongoDB and retry.")

    if payload.role != "management":
        return ApiResponse(success=False, message="Role must be management.")

    staff = await user_repo.find_public_by_email_and_role(str(payload.staffEmail), "management")
    if staff is None:
        return ApiResponse(success=False, message="Management user not found.")

    allowed, allowed_lower = _normalize_allowed_departments(payload.allowedDepartments)

    await placement_repo.create(
        {
            "staffEmail": str(payload.staffEmail),
            "companyName": payload.companyName,
            "title": payload.title,
            "description": payload.description,
            "instructions": payload.instructions,
            "visitDate": payload.visitDate,
            "applicationDeadline": payload.applicationDeadline,
            "location": payload.location,
            "applyUrl": payload.applyUrl,
            "allowedDepartments": allowed,
            "allowedDepartmentsLower": allowed_lower,
            "minCgpa": float(payload.minCgpa) if payload.minCgpa is not None else None,
            "maxArrears": int(payload.maxArrears) if payload.maxArrears is not None else None,
            "resources": [r.model_dump() for r in (payload.resources or [])],
            "createdAt": datetime.now(timezone.utc),
        }
    )
    return ApiResponse(success=True, message="Placement notice created.")

@router.get("/placements/mine/{email}", response_model=PlacementListResponse)
async def list_my_placement_notices(
    email: str,
    role: UserRole = "management",
    limit: int = Query(default=200, ge=1, le=500),
    placement_repo=Depends(get_placement_repo)
) -> PlacementListResponse:
    if not _is_allowed_domain(email):
        return PlacementListResponse(success=False, message="Only @kongu.edu or @kongu.ac.in emails are permitted.")
    if not mongodb_ok():
        return PlacementListResponse(success=False, message="MongoDB is not connected. Start MongoDB and retry.")
    
    if role != "management":
        return PlacementListResponse(success=False, message="Role must be management.")

    docs = await placement_repo.list_by_staff(email, limit=int(limit))
    return PlacementListResponse(success=True, message="ok", notices=[_to_placement_item(d) for d in docs])

@router.get("/placements/visible/{email}", response_model=PlacementListResponse)
async def list_visible_placement_notices(
    email: str,
    role: UserRole = "student",
    limit: int = Query(default=200, ge=1, le=500),
    placement_repo=Depends(get_placement_repo),
    user_repo=Depends(get_user_repo)
) -> PlacementListResponse:
    if not _is_allowed_domain(email):
        return PlacementListResponse(success=False, message="Only @kongu.edu or @kongu.ac.in emails are permitted.")
    if not mongodb_ok():
        return PlacementListResponse(success=False, message="MongoDB is not connected. Start MongoDB and retry.")
    
    if role != "student":
        return PlacementListResponse(success=False, message="Role must be student.")

    student = await user_repo.find_public_by_email_and_role(email, "student")
    if student is None:
        return PlacementListResponse(success=False, message="Student not found.")

    dept = str(student.get("department") or "").strip()
    profile = student.get("profile") or {}
    cgpa = profile.get("cgpa")
    arrears = profile.get("arrears_history")

    docs = await placement_repo.list_visible_for_student(
        student_department=dept,
        student_cgpa=float(cgpa) if cgpa is not None else None,
        student_arrears=int(arrears) if arrears is not None else None,
        limit=int(limit),
    )

    # Integrate ML Recommendation
    student_data = {
        "skills": profile.get("skills") or [],
        "branch": dept,
        "year": profile.get("year", 3),
        "resume_score": profile.get("resume_score", 0.7)
    }
    
    def _extract_skills(d):
        skills = []
        for r in (d.get("resources") or []):
            label = r.get("label", "").lower()
            skills.append(label)
        return skills

    opp_data = [{
        "id": str(d.get("_id")),
        "required_skills": _extract_skills(d),
        "branch": dept,
        "min_year": d.get("minYear", 1)
    } for d in docs]

    recommendations = recommend(student_data, opp_data)
    recommendations_map = {r["opportunity_id"]: r for r in recommendations}

    items = []
    for d in docs:
        item = _to_placement_item(d)
        rec = recommendations_map.get(item.id)
        if rec:
            item.score = rec["score"]
            item.reasons = list(set((item.reasons or []) + rec["why_recommended"]))
        items.append(item)

    items.sort(key=lambda x: x.score, reverse=True)
    return PlacementListResponse(success=True, message="ok", notices=items)

@router.get("/placements/{notice_id}/export")
async def export_eligible_students_csv(
    notice_id: str,
    email: str,
    role: UserRole = "management",
    placement_repo=Depends(get_placement_repo),
    user_repo=Depends(get_user_repo)
):
    if not _is_allowed_domain(email):
        return JSONResponse(status_code=400, content={"success": False, "message": "Only @kongu.edu or @kongu.ac.in emails are permitted."})
    if not mongodb_ok():
        return JSONResponse(status_code=503, content={"success": False, "message": "MongoDB is not connected."})
    
    if role != "management":
        return JSONResponse(status_code=403, content={"success": False, "message": "Role must be management."})

    notice = await placement_repo.get_by_id(notice_id)
    if notice is None:
        return JSONResponse(status_code=404, content={"success": False, "message": "Placement notice not found."})

    staff_email = str(notice.get("staffEmail") or "").strip().lower()
    if staff_email != email.strip().lower():
        return JSONResponse(status_code=403, content={"success": False, "message": "Not allowed."})

    allowed_lower = notice.get("allowedDepartmentsLower") or []
    min_cgpa = notice.get("minCgpa")
    max_arrears = notice.get("maxArrears")
    
    min_cgpa_f = float(min_cgpa) if min_cgpa is not None else None
    max_arr_i = int(max_arrears) if max_arrears is not None else None

    cur = user_repo.col.find({"$or": [{"role": "student"}, {"role": {"$exists": False}}]}, {"passwordHash": 0})
    students = [d async for d in cur]

    rows = []
    for s in students:
        dept = str(s.get("department") or "").strip()
        dept_l = dept.lower()
        if allowed_lower and dept_l not in allowed_lower:
            continue
        profile = s.get("profile") or {}
        cgpa_v = profile.get("cgpa")
        arrears_v = profile.get("arrears_history")
        if min_cgpa_f is not None:
            try:
                if cgpa_v is None or float(cgpa_v) < min_cgpa_f:
                    continue
            except: continue
        if max_arr_i is not None:
            try:
                if arrears_v is None or int(arrears_v) > max_arr_i:
                    continue
            except: continue
        
        resume = profile.get("resume") or {}
        rows.append({
            "name": s.get("name", ""),
            "email": s.get("email", ""),
            "department": dept,
            "roll_number": profile.get("roll_number") or "",
            "cgpa": profile.get("cgpa") or "",
            "arrears_history": profile.get("arrears_history") or "",
            "phone_number": profile.get("phone_number") or "",
            "personal_email": profile.get("personal_email") or "",
            "resume_url": resume.get("url") or "",
        })

    output = io.StringIO()
    fieldnames = ["name", "email", "department", "roll_number", "cgpa", "arrears_history", "phone_number", "personal_email", "resume_url"]
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    for r in rows:
        writer.writerow(r)

    safe_company = "".join([c if c.isalnum() else "_" for c in str(notice.get("companyName") or "company")]).strip("_")
    filename = f"eligible_students_{safe_company}_{notice_id}.csv"
    return StreamingResponse(iter([output.getvalue().encode("utf-8")]), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename=\"{filename}\""})

@router.post("/management/instructions", response_model=ApiResponse)
async def create_management_instruction(payload: ManagementInstructionCreateRequest, mgmt_repo=Depends(get_mgmt_instruction_repo), user_repo=Depends(get_user_repo)) -> ApiResponse:
    if not _is_allowed_domain(str(payload.staffEmail)):
        return ApiResponse(success=False, message="Only @kongu.edu or @kongu.ac.in emails are permitted.")
    if not mongodb_ok():
        return ApiResponse(success=False, message="MongoDB is not connected.")

    if payload.role != "management":
        return ApiResponse(success=False, message="Role must be management.")

    staff = await user_repo.find_public_by_email_and_role(str(payload.staffEmail), "management")
    if staff is None:
        return ApiResponse(success=False, message="Management user not found.")

    allowed, allowed_lower = _normalize_allowed_departments(payload.allowedDepartments)
    await mgmt_repo.create({
        "staffEmail": str(payload.staffEmail),
        "title": payload.title,
        "body": payload.body,
        "allowedDepartments": allowed,
        "allowedDepartmentsLower": allowed_lower,
        "createdAt": datetime.now(timezone.utc),
    })
    return ApiResponse(success=True, message="Instruction posted.")

@router.get("/management/instructions/mine/{email}", response_model=ManagementInstructionListResponse)
async def list_my_management_instructions(email: str, role: UserRole = "management", limit: int = Query(default=200, ge=1, le=500), mgmt_repo=Depends(get_mgmt_instruction_repo)) -> ManagementInstructionListResponse:
    if not _is_allowed_domain(email):
        return ManagementInstructionListResponse(success=False, message="Only @kongu.edu or @kongu.ac.in emails are permitted.")
    if not mongodb_ok():
        return ManagementInstructionListResponse(success=False, message="MongoDB is not connected.")
    
    if role != "management":
        return ManagementInstructionListResponse(success=False, message="Role must be management.")

    docs = await mgmt_repo.list_by_staff(email, limit=int(limit))
    return ManagementInstructionListResponse(success=True, message="ok", items=[_to_instruction_item(d) for d in docs])

@router.get("/management/instructions/visible/{email}", response_model=ManagementInstructionListResponse)
async def list_visible_management_instructions(email: str, role: UserRole = "student", limit: int = Query(default=200, ge=1, le=500), mgmt_repo=Depends(get_mgmt_instruction_repo), user_repo=Depends(get_user_repo)) -> ManagementInstructionListResponse:
    if not _is_allowed_domain(email):
        return ManagementInstructionListResponse(success=False, message="Only @kongu.edu or @kongu.ac.in emails are permitted.")
    if not mongodb_ok():
        return ManagementInstructionListResponse(success=False, message="MongoDB is not connected.")
    
    if role != "student":
        return ManagementInstructionListResponse(success=False, message="Role must be student.")

    student = await user_repo.find_public_by_email_and_role(email, "student")
    if student is None:
        return ManagementInstructionListResponse(success=False, message="Student not found.")

    dept = str(student.get("department") or "").strip()
    docs = await mgmt_repo.list_visible_for_department(dept, limit=int(limit))
    return ManagementInstructionListResponse(success=True, message="ok", items=[_to_instruction_item(d) for d in docs])

@router.post("/management/notes/upload", response_model=ApiResponse)
async def upload_management_note(
    email: str,
    role: UserRole = "management",
    title: str = Form(...),
    description: str = Form(""),
    allowedDepartments: str = Form("all"),
    file: UploadFile = File(...),
    mgmt_notes=Depends(get_mgmt_note_repo),
    user_repo=Depends(get_user_repo)
) -> ApiResponse:
    if not _is_allowed_domain(email):
        return ApiResponse(success=False, message="Only @kongu.edu or @kongu.ac.in emails are permitted.")
    if not mongodb_ok():
        return ApiResponse(success=False, message="MongoDB is not connected.")
    
    if role != "management":
        return ApiResponse(success=False, message="Role must be management.")

    staff = await user_repo.find_public_by_email_and_role(email, "management")
    if staff is None:
        return ApiResponse(success=False, message="Management user not found.")

    if file.filename is None or not file.filename.strip():
        return ApiResponse(success=False, message="Invalid filename.")

    original = Path(file.filename).name
    ext = Path(original).suffix.lower()
    if ext not in {".pdf", ".png", ".jpg", ".jpeg"}:
        return ApiResponse(success=False, message="Only PDF/PNG/JPG/JPEG files are allowed.")

    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        return ApiResponse(success=False, message="File too large (max 10MB).")

    token = secrets.token_hex(8)
    stored = f"mgmt_{email.replace('@','_').replace('.','_')}_{token}{ext}"
    dest = _MANAGEMENT_NOTES_DIR / stored
    dest.write_bytes(data)

    url = f"/uploads/management_notes/{stored}"
    file_meta = {
        "originalName": original,
        "storedName": stored,
        "contentType": file.content_type or "application/octet-stream",
        "size": len(data),
        "uploadedAt": datetime.now(timezone.utc).isoformat(),
        "url": url,
    }

    raw_depts = _parse_departments_csv(allowedDepartments)
    allowed, allowed_lower = _normalize_allowed_departments(raw_depts)

    await mgmt_notes.create({
        "staffEmail": email,
        "title": str(title).strip(),
        "description": str(description).strip() or None,
        "allowedDepartments": allowed,
        "allowedDepartmentsLower": allowed_lower,
        "file": file_meta,
        "createdAt": datetime.now(timezone.utc),
    })
    return ApiResponse(success=True, message="Note uploaded.")

@router.get("/management/notes/mine/{email}", response_model=ManagementNoteListResponse)
async def list_my_management_notes(email: str, role: UserRole = "management", limit: int = Query(default=200, ge=1, le=500), mgmt_notes=Depends(get_mgmt_note_repo)) -> ManagementNoteListResponse:
    if not _is_allowed_domain(email):
        return ManagementNoteListResponse(success=False, message="Only @kongu.edu or @kongu.ac.in emails are permitted.")
    if not mongodb_ok():
        return ManagementNoteListResponse(success=False, message="MongoDB is not connected.")
    
    if role != "management":
        return ManagementNoteListResponse(success=False, message="Role must be management.")

    docs = await mgmt_notes.list_by_staff(email, limit=int(limit))
    return ManagementNoteListResponse(success=True, message="ok", items=[_to_note_item(d) for d in docs])

@router.get("/management/notes/visible/{email}", response_model=ManagementNoteListResponse)
async def list_visible_management_notes(email: str, role: UserRole = "student", limit: int = Query(default=200, ge=1, le=500), mgmt_notes=Depends(get_mgmt_note_repo), user_repo=Depends(get_user_repo)) -> ManagementNoteListResponse:
    if not _is_allowed_domain(email):
        return ManagementNoteListResponse(success=False, message="Only @kongu.edu or @kongu.ac.in emails are permitted.")
    if not mongodb_ok():
        return ManagementNoteListResponse(success=False, message="MongoDB is not connected.")
    
    if role != "student":
        return ManagementNoteListResponse(success=False, message="Role must be student.")

    student = await user_repo.find_public_by_email_and_role(email, "student")
    if student is None:
        return ManagementNoteListResponse(success=False, message="Student not found.")

    dept = str(student.get("department") or "").strip()
    docs = await mgmt_notes.list_visible_for_department(dept, limit=int(limit))
    return ManagementNoteListResponse(success=True, message="ok", items=[_to_note_item(d) for d in docs])
