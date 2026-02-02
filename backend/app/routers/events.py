import csv
import io
import secrets
from pathlib import Path
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query, File, UploadFile
from fastapi.responses import StreamingResponse
from bson import ObjectId
from ..models import (
    ApiResponse, 
    EventCreateRequest, 
    EventCreateResponse, 
    EventListResponse, 
    EventItem,
    EventRegistrationCreate,
    EventRegistrationsResponse,
    EventAttendanceMarkRequest,
    UserRole
)
from ..deps import get_user_repo, get_event_repo, get_event_reg_repo
from ..database.db import mongodb_ok

router = APIRouter(prefix="/events", tags=["events"])

_UPLOADS_DIR = Path(__file__).resolve().parents[2] / "uploads"
_EVENT_POSTERS_DIR = _UPLOADS_DIR / "event_posters"
_EVENT_POSTERS_DIR.mkdir(parents=True, exist_ok=True)

def _is_allowed_domain(email: str) -> bool:
    domain = email.split("@")[-1].lower()
    return domain in {"kongu.edu", "kongu.ac.in"}

def _doc_id(d: dict) -> str:
    _id = d.get("_id")
    return str(_id) if _id is not None else ""

def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()

def _parse_dt(s: str) -> datetime:
    raw = (s or "").strip()
    if not raw:
        raise ValueError("Invalid datetime")
    if raw.endswith("Z"):
        raw = raw[:-1] + "+00:00"
    return datetime.fromisoformat(raw)

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

@router.post("", response_model=EventCreateResponse)
async def create_event(payload: EventCreateRequest, event_repo=Depends(get_event_repo), user_repo=Depends(get_user_repo)) -> EventCreateResponse:
    if not _is_allowed_domain(str(payload.managerEmail)):
        return EventCreateResponse(success=False, message="Only @kongu.edu or @kongu.ac.in emails are permitted.")
    if not mongodb_ok():
        return EventCreateResponse(success=False, message="MongoDB is not connected.")

    if payload.role != "event_manager":
        return EventCreateResponse(success=False, message="Role must be event_manager.")

    mgr = await user_repo.find_public_by_email_and_role(str(payload.managerEmail), "event_manager")
    if mgr is None:
        return EventCreateResponse(success=False, message="Event manager user not found.")

    try:
        start_dt = _parse_dt(payload.startAt)
        end_dt = _parse_dt(payload.endAt) if payload.endAt else None
        if end_dt and end_dt < start_dt:
            return EventCreateResponse(success=False, message="endAt must be after startAt.")
    except ValueError:
        return EventCreateResponse(success=False, message="Invalid startAt/endAt datetime. Use ISO format.")

    allowed = [d.strip() for d in (payload.allowedDepartments or []) if str(d).strip()]
    if any(d.strip().lower() in {"all", "*"} for d in allowed):
        allowed = []
    allowed_lower = [d.lower() for d in allowed]

    fields = payload.formFields or []
    seen_keys = set()
    for f in fields:
        key = str(f.key)
        if key in seen_keys:
            return EventCreateResponse(success=False, message=f"Duplicate form field key: {key}")
        seen_keys.add(key)
        if f.type == "select" and not (f.options and len(f.options) > 0):
            return EventCreateResponse(success=False, message=f"Field '{key}' is select but has no options.")

    event_id = await event_repo.create({
        "managerEmail": str(payload.managerEmail),
        "title": payload.title,
        "description": payload.description,
        "venue": payload.venue,
        "startAt": start_dt,
        "endAt": end_dt,
        "allowedDepartments": allowed,
        "allowedDepartmentsLower": allowed_lower,
        "formFields": [f.model_dump() for f in fields],
        "poster": None,
        "createdAt": datetime.now(timezone.utc),
    })
    return EventCreateResponse(success=True, message="Event created.", eventId=event_id)

@router.get("/mine/{email}", response_model=EventListResponse)
async def list_my_events(email: str, role: UserRole = "event_manager", limit: int = Query(default=100, ge=1, le=300), event_repo=Depends(get_event_repo)) -> EventListResponse:
    if not _is_allowed_domain(email):
        return EventListResponse(success=False, message="Only @kongu.edu or @kongu.ac.in emails are permitted.")
    if not mongodb_ok():
        return EventListResponse(success=False, message="MongoDB is not connected.")
    
    if role != "event_manager":
        return EventListResponse(success=False, message="Role must be event_manager.")

    docs = await event_repo.list_by_manager(email, limit=int(limit))
    return EventListResponse(success=True, message="ok", events=[_to_event_item(d) for d in docs])

@router.get("/visible/{email}", response_model=EventListResponse)
async def list_visible_events(email: str, role: UserRole = "student", limit: int = Query(default=100, ge=1, le=300), event_repo=Depends(get_event_repo), user_repo=Depends(get_user_repo)) -> EventListResponse:
    if not _is_allowed_domain(email):
        return EventListResponse(success=False, message="Only @kongu.edu or @kongu.ac.in emails are permitted.")
    if not mongodb_ok():
        return EventListResponse(success=False, message="MongoDB is not connected.")

    if role != "student":
        return EventListResponse(success=False, message="Role must be student.")

    student = await user_repo.find_public_by_email_and_role(email, "student")
    if student is None:
        return EventListResponse(success=False, message="Student not found.")
    
    dept = str(student.get("department") or "").strip()
    docs = await event_repo.list_visible_for_department(dept, limit=int(limit))
    return EventListResponse(success=True, message="ok", events=[_to_event_item(d) for d in docs])

@router.post("/{event_id}/poster", response_model=ApiResponse)
async def upload_event_poster(event_id: str, email: str, role: UserRole = "event_manager", file: UploadFile = File(...), event_repo=Depends(get_event_repo)) -> ApiResponse:
    if not _is_allowed_domain(email):
        return ApiResponse(success=False, message="Only @kongu.edu or @kongu.ac.in emails are permitted.")
    if not mongodb_ok():
        return ApiResponse(success=False, message="MongoDB is not connected.")
    
    if role != "event_manager":
        return ApiResponse(success=False, message="Role must be event_manager.")

    if file.filename is None or not file.filename.strip():
        return ApiResponse(success=False, message="Invalid filename.")

    original = Path(file.filename).name
    ext = Path(original).suffix.lower()
    if ext not in {".png", ".jpg", ".jpeg"}:
        return ApiResponse(success=False, message="Only PNG/JPG/JPEG posters are allowed.")

    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        return ApiResponse(success=False, message="Poster too large (max 5MB).")

    token = secrets.token_hex(8)
    stored = f"event_{event_id}_{token}{ext}"
    dest = _EVENT_POSTERS_DIR / stored
    dest.write_bytes(data)

    poster_meta = {
        "originalName": original,
        "storedName": stored,
        "contentType": file.content_type or "image/jpeg",
        "size": len(data),
        "uploadedAt": datetime.now(timezone.utc).isoformat(),
        "url": f"/uploads/event_posters/{stored}",
    }

    ok = await event_repo.set_poster(event_id, email, poster_meta)
    if not ok:
        return ApiResponse(success=False, message="Event not found or not owned by this manager.")
    return ApiResponse(success=True, message="Poster uploaded.")

@router.post("/{event_id}/register", response_model=ApiResponse)
async def register_for_event(event_id: str, payload: EventRegistrationCreate, event_repo=Depends(get_event_repo), event_regs=Depends(get_event_reg_repo), user_repo=Depends(get_user_repo)) -> ApiResponse:
    if not _is_allowed_domain(str(payload.studentEmail)):
        return ApiResponse(success=False, message="Only @kongu.edu or @kongu.ac.in emails are permitted.")
    if not mongodb_ok():
        return ApiResponse(success=False, message="MongoDB is not connected.")
    
    if payload.studentRole != "student":
        return ApiResponse(success=False, message="studentRole must be student.")

    event_doc = await event_repo.get_by_id(event_id)
    if event_doc is None:
        return ApiResponse(success=False, message="Event not found.")

    student = await user_repo.find_public_by_email_and_role(str(payload.studentEmail), "student")
    if student is None:
        return ApiResponse(success=False, message="Student not found.")
    dept = str(student.get("department") or "").strip()
    dept_l = dept.lower()

    allowed_lower = event_doc.get("allowedDepartmentsLower") or []
    if allowed_lower and dept_l not in [str(x).lower() for x in allowed_lower]:
        return ApiResponse(success=False, message="This event is not visible for your department.")

    answers = payload.answers or {}
    fields = event_doc.get("formFields") or []
    for f in fields:
        key = str(f.get("key") or "").strip()
        if not key: continue
        required = bool(f.get("required", True))
        ftype = str(f.get("type") or "text")
        label = str(f.get("label") or key)
        val = str(answers.get(key, "")).strip() if key in answers else ""
        if required and not val:
            return ApiResponse(success=False, message=f"Missing required field: {label}")
        if val and ftype == "select":
            opts = f.get("options") or []
            if val not in [str(o).strip() for o in opts]:
                return ApiResponse(success=False, message=f"Invalid value for {label}.")

    try:
        event_oid = ObjectId(event_id)
    except:
        return ApiResponse(success=False, message="Invalid event id.")

    if await event_regs.exists(event_oid, str(payload.studentEmail)):
        return ApiResponse(success=False, message="You already registered for this event.")

    try:
        await event_regs.create({
            "eventId": event_oid,
            "studentEmail": str(payload.studentEmail),
            "studentRole": "student",
            "studentDepartment": dept,
            "answers": {k: str(v) for k, v in answers.items()},
            "createdAt": datetime.now(timezone.utc),
        })
    except:
        return ApiResponse(success=False, message="Registration failed.")

    return ApiResponse(success=True, message="Registered successfully.")

@router.get("/{event_id}/registrations", response_model=EventRegistrationsResponse)
async def list_event_registrations(event_id: str, email: str, role: UserRole = "event_manager", limit: int = Query(default=300, ge=1, le=1000), event_repo=Depends(get_event_repo), event_regs=Depends(get_event_reg_repo)) -> EventRegistrationsResponse:
    if not _is_allowed_domain(email):
        return EventRegistrationsResponse(success=False, message="Only @kongu.edu or @kongu.ac.in emails are permitted.")
    if not mongodb_ok():
        return EventRegistrationsResponse(success=False, message="MongoDB is not connected.")
    
    if role != "event_manager":
        return EventRegistrationsResponse(success=False, message="Role must be event_manager.")

    event_doc = await event_repo.get_by_id(event_id)
    if event_doc is None:
        return EventRegistrationsResponse(success=False, message="Event not found.")
    if str(event_doc.get("managerEmail") or "").strip().lower() != email.strip().lower():
        return EventRegistrationsResponse(success=False, message="Not allowed.")

    try:
        event_oid = ObjectId(event_id)
    except:
        return EventRegistrationsResponse(success=False, message="Invalid event id.")

    docs = await event_regs.list_by_event(event_oid, limit=int(limit))
    items = [{
        "id": _doc_id(d),
        "eventId": event_id,
        "studentEmail": d.get("studentEmail"),
        "studentDepartment": d.get("studentDepartment"),
        "answers": d.get("answers") or {},
        "isPresent": bool(d.get("isPresent", False)),
        "attendedAt": _iso(d.get("attendedAt")) if isinstance(d.get("attendedAt"), datetime) else (str(d.get("attendedAt")) if d.get("attendedAt") else None),
        "createdAt": _iso(d.get("createdAt")) if isinstance(d.get("createdAt"), datetime) else "",
    } for d in docs]
    return EventRegistrationsResponse(success=True, message="ok", registrations=items)

@router.get("/registrations/mine/{email}", response_model=EventRegistrationsResponse)
async def list_my_registrations(email: str, role: UserRole = "student", limit: int = Query(default=100, ge=1, le=300), event_regs=Depends(get_event_reg_repo)) -> EventRegistrationsResponse:
    if not _is_allowed_domain(email):
        return EventRegistrationsResponse(success=False, message="Only @kongu.edu or @kongu.ac.in emails are permitted.")
    if role != "student":
        return EventRegistrationsResponse(success=False, message="Role must be student.")

    docs = await event_regs.list_by_student(email, limit=int(limit))
    items = [{
        "id": _doc_id(d),
        "eventId": str(d.get("eventId")),
        "studentEmail": d.get("studentEmail"),
        "studentDepartment": d.get("studentDepartment"),
        "answers": d.get("answers") or {},
        "isPresent": bool(d.get("isPresent", False)),
        "attendedAt": _iso(d.get("attendedAt")) if isinstance(d.get("attendedAt"), datetime) else (str(d.get("attendedAt")) if d.get("attendedAt") else None),
        "createdAt": _iso(d.get("createdAt")) if isinstance(d.get("createdAt"), datetime) else "",
    } for d in docs]
    return EventRegistrationsResponse(success=True, message="ok", registrations=items)

@router.post("/{event_id}/attendance", response_model=ApiResponse)
async def mark_event_attendance(event_id: str, payload: EventAttendanceMarkRequest, event_repo=Depends(get_event_repo), event_regs=Depends(get_event_reg_repo), user_repo=Depends(get_user_repo)) -> ApiResponse:
    if not _is_allowed_domain(str(payload.managerEmail)):
        return ApiResponse(success=False, message="Only @kongu.edu or @kongu.ac.in emails are permitted.")
    if not mongodb_ok():
        return ApiResponse(success=False, message="MongoDB is not connected.")
    if payload.role != "event_manager":
        return ApiResponse(success=False, message="Role must be event_manager.")

    event_doc = await event_repo.get_by_id(event_id)
    if event_doc is None:
        return ApiResponse(success=False, message="Event not found.")
    if str(event_doc.get("managerEmail") or "").strip().lower() != str(payload.managerEmail).strip().lower():
        return ApiResponse(success=False, message="Not allowed.")

    try:
        event_oid = ObjectId(event_id)
    except:
        return ApiResponse(success=False, message="Invalid event id.")

    student_email = str(payload.studentIdentifier).strip()
    if "@" not in student_email:
        # Assume it's a roll number - case insensitive search
        student_doc = await user_repo.find_by_roll_number_case_insensitive(student_email)
        if student_doc:
            student_email = student_doc.get("email")
        else:
            # Fallback: search in event registration answers
            reg_doc = await event_regs.find_by_any_answer_value(event_oid, student_email)
            if reg_doc:
                student_email = reg_doc.get("studentEmail")
            else:
                return ApiResponse(success=False, message=f"Student with identifier {student_email} not found in profiles or registrations.")

    reg = await event_regs.get_one(event_oid, student_email)
    if not reg:
        return ApiResponse(success=False, message=f"Student {student_email} is not registered for this event.")

    current_status = bool(reg.get("isPresent", False))
    if current_status == payload.status:
        msg = f"Attendance is already marked as {'present' if current_status else 'absent'} for {student_email}."
        return ApiResponse(success=True, message=msg)

    ok = await event_regs.mark_attendance(event_oid, student_email, payload.status)
    if ok:
        target = "present" if payload.status else "absent"
        return ApiResponse(success=True, message=f"Attendance marked as {target} for {student_email}.")
    else:
        return ApiResponse(success=False, message="Failed to update attendance.")

@router.get("/{event_id}/attendance/report")
async def download_attendance_report(event_id: str, email: str, role: UserRole = "event_manager", event_repo=Depends(get_event_repo), event_regs=Depends(get_event_reg_repo), user_repo=Depends(get_user_repo)):
    if role != "event_manager":
        return ApiResponse(success=False, message="Role must be event_manager.")

    event_doc = await event_repo.get_by_id(event_id)
    if event_doc is None:
        return ApiResponse(success=False, message="Event not found.")
    if str(event_doc.get("managerEmail") or "").strip().lower() != email.strip().lower():
        return ApiResponse(success=False, message="Not allowed.")

    try:
        event_oid = ObjectId(event_id)
    except:
        return ApiResponse(success=False, message="Invalid event id.")

    regs = await event_regs.list_by_event(event_oid, limit=1000)
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    header = ["Student Email", "Department", "Registration Date", "Attended", "Attended At"]
    # Add form fields to header
    form_fields = event_doc.get("formFields") or []
    field_keys = [f.get("key") for f in form_fields]
    field_labels = [f.get("label") or f.get("key") for f in form_fields]
    header.extend(field_labels)
    writer.writerow(header)

    for r in regs:
        row = [
            r.get("studentEmail"),
            r.get("studentDepartment"),
            _iso(r.get("createdAt")) if isinstance(r.get("createdAt"), datetime) else str(r.get("createdAt") or ""),
            "YES" if r.get("isPresent") else "NO",
            _iso(r.get("attendedAt")) if isinstance(r.get("attendedAt"), datetime) else str(r.get("attendedAt") or ""),
        ]
        answers = r.get("answers") or {}
        for k in field_keys:
            row.append(answers.get(k, ""))
        writer.writerow(row)

    output.seek(0)
    filename = f"attendance_{event_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
