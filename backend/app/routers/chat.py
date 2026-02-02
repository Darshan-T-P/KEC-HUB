from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from ..models import ChatThreadsResponse, ChatMessagesResponse, ChatSendRequest, ApiResponse, UserRole
from ..deps import get_chat_thread_repo, get_chat_message_repo
from ..database.db import mongodb_ok
from ..database.repositories import make_thread_id

router = APIRouter(prefix="/chat", tags=["chat"])

def _is_allowed_domain(email: str) -> bool:
    domain = email.split("@")[-1].lower()
    return domain in {"kongu.edu", "kongu.ac.in"}

def _doc_id(d: dict) -> str:
    _id = d.get("_id")
    return str(_id) if _id is not None else ""

def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()

@router.get("/threads/{email}", response_model=ChatThreadsResponse)
async def chat_threads(email: str, role: UserRole = "student", chat_threads_repo=Depends(get_chat_thread_repo)) -> ChatThreadsResponse:
    if not _is_allowed_domain(email):
        return ChatThreadsResponse(success=False, message="Only @kongu.edu or @kongu.ac.in emails are permitted.")
    if not mongodb_ok():
        return ChatThreadsResponse(success=False, message="MongoDB is not connected.")

    docs = await chat_threads_repo.list_for_user(email, role)
    threads = []
    for d in docs:
        parts = d.get("participants") or []
        me = f"{role}:{email}".lower()
        other = next((p for p in parts if str(p).lower() != me), None)
        if not other or ":" not in other:
            continue
        other_role, other_email = other.split(":", 1)
        upd = d.get("updatedAt")
        threads.append({
            "id": str(d.get("_id")),
            "otherEmail": other_email,
            "otherRole": other_role,
            "lastMessage": d.get("lastMessage"),
            "lastAt": _iso(upd) if isinstance(upd, datetime) else None,
        })
    return ChatThreadsResponse(success=True, message="ok", threads=threads)

@router.get("/messages/{thread_id}", response_model=ChatMessagesResponse)
async def chat_messages(thread_id: str, email: str, role: UserRole, chat_messages_repo=Depends(get_chat_message_repo)) -> ChatMessagesResponse:
    if not _is_allowed_domain(email):
        return ChatMessagesResponse(success=False, message="Only @kongu.edu or @kongu.ac.in emails are permitted.")
    if not mongodb_ok():
        return ChatMessagesResponse(success=False, message="MongoDB is not connected.")

    docs = await chat_messages_repo.list_by_thread(thread_id)
    msgs = [{
        "id": _doc_id(d),
        "threadId": d.get("threadId"),
        "senderEmail": d.get("senderEmail"),
        "senderRole": d.get("senderRole"),
        "text": d.get("text", ""),
        "createdAt": _iso(d.get("createdAt")) if isinstance(d.get("createdAt"), datetime) else "",
    } for d in docs]
    return ChatMessagesResponse(success=True, message="ok", messages=msgs)

@router.post("/send", response_model=ApiResponse)
async def chat_send(payload: ChatSendRequest, chat_threads_repo=Depends(get_chat_thread_repo), chat_messages_repo=Depends(get_chat_message_repo)) -> ApiResponse:
    if not _is_allowed_domain(str(payload.senderEmail)) or not _is_allowed_domain(str(payload.recipientEmail)):
        return ApiResponse(success=False, message="Only @kongu.edu or @kongu.ac.in emails are permitted.")
    if not mongodb_ok():
        return ApiResponse(success=False, message="MongoDB is not connected.")

    thread_id = make_thread_id(str(payload.senderEmail), payload.senderRole, str(payload.recipientEmail), payload.recipientRole)
    now = datetime.now(timezone.utc)
    participants = sorted([
        f"{payload.senderRole}:{payload.senderEmail}".lower(),
        f"{payload.recipientRole}:{payload.recipientEmail}".lower(),
    ])

    await chat_messages_repo.create({
        "threadId": thread_id,
        "senderEmail": str(payload.senderEmail),
        "senderRole": payload.senderRole,
        "recipientEmail": str(payload.recipientEmail),
        "recipientRole": payload.recipientRole,
        "text": payload.text,
        "createdAt": now,
    })
    await chat_threads_repo.upsert_on_message(
        thread_id,
        participants,
        now,
        payload.text[:500],
        str(payload.senderEmail),
    )
    return ApiResponse(success=True, message=thread_id)
