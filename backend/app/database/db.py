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
    global _client, _db, _db_ok

    if _client is not None:
        return

    # MongoDB stores datetimes as UTC instants without timezone info.
    # Configure the driver to return timezone-aware datetimes in UTC to avoid
    # "can't compare offset-naive and offset-aware datetimes" errors.
    uri = settings.mongodb_uri
    log.info("Connecting MongoDB: %s (db=%s)", _mask_mongo_uri(uri), settings.mongodb_db)
    _client = AsyncIOMotorClient(uri, tz_aware=True, tzinfo=timezone.utc)
    _db = _client[settings.mongodb_db]

    try:
        await _db.command({"ping": 1})
        _db_ok = True
        log.info("MongoDB connected.")
    except Exception as e:
        _db_ok = False
        log.error("MongoDB connection failed: %s", str(e))


async def disconnect_mongodb() -> None:
    global _client, _db, _db_ok

    _db_ok = False

    if _client is not None:
        _client.close()

    _client = None
    _db = None


def mongodb_ok() -> bool:
    return _db_ok


def get_db() -> AsyncIOMotorDatabase:
    if _db is None:
        raise RuntimeError("MongoDB is not initialized")
    return _db
