from __future__ import annotations
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .database.db import connect_mongodb, disconnect_mongodb, mongodb_ok
from .settings import settings
from .models import ApiResponse
from .routers import auth, profile, student, alumni, management, events, chat, referrals, ml_feedback

app = FastAPI(title="KEC Opportunities Hub API")

_BACKEND_DIR = Path(__file__).resolve().parents[1]
_UPLOADS_DIR = _BACKEND_DIR / "uploads"
_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

# Serve uploaded files for development.
app.mount("/uploads", StaticFiles(directory=str(_UPLOADS_DIR)), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def _startup() -> None:
    await connect_mongodb()

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
