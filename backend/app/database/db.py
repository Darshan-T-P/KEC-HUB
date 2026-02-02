from __future__ import annotations

import logging
from datetime import timezone
from typing import Optional

from urllib.parse import urlsplit, urlunsplit

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from ..settings import settings


log = logging.getLogger(__name__)

_client: Optional[AsyncIOMotorClient] = None
_db: Optional[AsyncIOMotorDatabase] = None
_student_validation_db: Optional[AsyncIOMotorDatabase] = None  # For kec_hub.sheet1
_db_ok: bool = False


def _mask_mongo_uri(uri: str) -> str:
    """Best-effort masking for logs.

    Converts:
      mongodb+srv://user:pass@host/db -> mongodb+srv://***:***@host/db
    """
    try:
        parts = urlsplit(uri)
        if not parts.netloc:
            return uri
        if "@" not in parts.netloc:
            return uri
        _creds, host = parts.netloc.rsplit("@", 1)
        netloc = f"***:***@{host}"
        return urlunsplit((parts.scheme, netloc, parts.path, parts.query, parts.fragment))
    except Exception:
        return "<invalid-mongodb-uri>"


async def connect_mongodb() -> None:
    global _client, _db, _student_validation_db, _db_ok

    if _client is not None:
        print("[DB] MongoDB already connected.")
        log.info("MongoDB already connected.")
        return
    
    print(f"[DB] Connecting to MongoDB...")
    print(f"[DB] Target database: {settings.mongodb_db}")
    log.info(f"Connecting to MongoDB...")
    log.info(f"Target database: {settings.mongodb_db}")

    # MongoDB stores datetimes as UTC instants without timezone info.
    # Configure the driver to return timezone-aware datetimes in UTC to avoid
    # "can't compare offset-naive and offset-aware datetimes" errors.
    uri = settings.mongodb_uri
    print(f"[DB] Connecting MongoDB: {_mask_mongo_uri(uri)} (db={settings.mongodb_db})")
    log.info("Connecting MongoDB: %s (db=%s)", _mask_mongo_uri(uri), settings.mongodb_db)
    _client = AsyncIOMotorClient(uri, tz_aware=True, tzinfo=timezone.utc)
    
    # Main application database (for users, events, etc.)
    _db = _client[settings.mongodb_db]
    print(f"[DB] Main database set to: {settings.mongodb_db}")
    log.info("Main database set to: %s", settings.mongodb_db)
    
    # Student validation database (for sheet1 with 7888 student emails)
    _student_validation_db = _client["kec_hub"]
    print("[DB] Student validation database set to: kec_hub")
    log.info("Student validation database set to: kec_hub")

    try:
        await _db.command({"ping": 1})
        await _student_validation_db.command({"ping": 1})
        _db_ok = True
        print("[DB] ✓ MongoDB connected successfully to both databases")
        log.info("MongoDB connected successfully")
    except Exception as e:
        _db_ok = False
        print(f"[DB] ✗ MongoDB connection failed: {str(e)}")
        log.error("MongoDB connection failed: %s", str(e))


async def disconnect_mongodb() -> None:
    global _client, _db, _student_validation_db, _db_ok

    _db_ok = False

    if _client is not None:
        _client.close()

    _client = None
    _db = None
    _student_validation_db = None


def mongodb_ok() -> bool:
    return _db_ok


def get_db() -> AsyncIOMotorDatabase:
    if _db is None:
        raise RuntimeError("MongoDB is not initialized")
    return _db


def get_student_validation_db() -> AsyncIOMotorDatabase:
    """Get database for student email validation (kec_hub.sheet1)"""
    if _student_validation_db is None:
        raise RuntimeError("MongoDB is not initialized")
    return _student_validation_db
