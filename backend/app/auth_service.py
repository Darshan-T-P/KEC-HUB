from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Literal

import anyio
from passlib.context import CryptContext
from passlib.exc import PasswordSizeError

from .email_sender import send_email_otp
from .database.repositories import OtpRepository, UserRepository, VerifiedEmailRepository, utc_now
from .settings import settings

# bcrypt has a 72-byte password limit; for better UX use pbkdf2_sha256 for new
# hashes while still supporting existing bcrypt hashes if any were created.
_pwd = CryptContext(schemes=["pbkdf2_sha256", "bcrypt"], deprecated="auto")


def _gen_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def _as_utc_aware(dt: datetime) -> datetime:
    # Backward/defensive: if existing records were written/read as naive
    # datetimes, normalize them to UTC-aware before comparisons.
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class AuthService:
    def __init__(self, otp_repo: OtpRepository, verified_repo: VerifiedEmailRepository, user_repo: UserRepository):
        self.otp_repo = otp_repo
        self.verified_repo = verified_repo
        self.user_repo = user_repo

    async def send_otp(self, email: str) -> Literal["console", "smtp"]:
        now = utc_now()
        existing = await self.otp_repo.get(email)

        if existing is not None:
            last_sent_at = existing.get("lastSentAt")
            if isinstance(last_sent_at, datetime):
                last_sent_at = _as_utc_aware(last_sent_at)
            if last_sent_at and (now - last_sent_at).total_seconds() < settings.otp_min_resend_seconds:
                raise ValueError("Please wait before requesting another code.")

            # sliding window for last hour
            ts = existing.get("sendTimestamps", [])
            ts = [(_as_utc_aware(t) if isinstance(t, datetime) else t) for t in ts]
            ts = [t for t in ts if isinstance(t, datetime) and (now - t).total_seconds() < 3600]
            if len(ts) >= settings.otp_max_sends_per_hour:
                raise ValueError("Too many OTP requests. Try again later.")

        otp = _gen_otp()
        prev_ts = existing.get("sendTimestamps", []) if existing else []
        prev_ts = [(_as_utc_aware(t) if isinstance(t, datetime) else t) for t in prev_ts]
        prev_ts = [t for t in prev_ts if isinstance(t, datetime) and (now - t).total_seconds() < 3600]

        doc = {
            "email": email,
            "otp": otp,
            "createdAt": now,
            "expiresAt": now + timedelta(seconds=settings.otp_ttl_seconds),
            "lastSentAt": now,
            "sendTimestamps": prev_ts + [now],
            "verifyAttempts": 0,
        }

        await self.otp_repo.upsert(doc)

        provider = settings.otp_provider.lower()
        if provider == "console":
            print(f"[OTP] {email} -> {otp}")
            return "console"

        if provider == "smtp":
            # Run SMTP send off the event loop.
            await anyio.to_thread.run_sync(send_email_otp, email, otp)
            return "smtp"

        raise ValueError(f"Unknown OTP_PROVIDER: {settings.otp_provider}")

    async def verify_otp(self, email: str, otp: str) -> None:
        doc = await self.otp_repo.get(email)
        if doc is None:
            raise ValueError("No active code for this email. Please request a new OTP.")

        expires_at = doc.get("expiresAt")
        if isinstance(expires_at, datetime):
            expires_at = _as_utc_aware(expires_at)

        if expires_at and expires_at <= utc_now():
            await self.otp_repo.delete(email)
            raise ValueError("OTP expired. Please request a new code.")

        attempts = int(doc.get("verifyAttempts", 0)) + 1
        if attempts > 5:
            await self.otp_repo.delete(email)
            raise ValueError("Too many attempts. Please request a new code.")

        if otp.strip() != str(doc.get("otp", "")):
            await self.otp_repo.upsert({**doc, "verifyAttempts": attempts})
            raise ValueError("Invalid OTP. Please try again.")

        await self.otp_repo.delete(email)
        await self.verified_repo.mark_verified(email)

    async def register(
        self,
        name: str,
        email: str,
        password: str,
        department: str = "Computer Science",
        role: str = "student",
    ) -> None:
        if not await self.verified_repo.is_verified(email):
            raise ValueError("Email not verified. Please verify OTP before registering.")

        existing = await self.user_repo.find_by_email_and_role(email, role)
        if existing is not None:
            raise ValueError("This email is already registered for the selected role.")

        try:
            password_hash = _pwd.hash(password)
        except PasswordSizeError:
            raise ValueError("Password is too long. Please choose a shorter password.")
        await self.user_repo.create(
            {
                "name": name,
                "email": email,
                "role": role,
                "department": department,
                "passwordHash": password_hash,
                "createdAt": utc_now(),
            }
        )

    async def login(self, email: str, password: str, role: str = "student") -> dict:
        user = await self.user_repo.find_by_email_and_role(email, role)
        if user is None:
            raise ValueError("Invalid email or password.")

        try:
            ok = _pwd.verify(password, user.get("passwordHash", ""))
        except PasswordSizeError:
            raise ValueError("Password is too long. Please choose a shorter password.")

        if not ok:
            raise ValueError("Invalid email or password.")

        profile = user.get("profile") or {}
        return {
            "name": user.get("name", "Student"),
            "email": user.get("email", email),
            "role": user.get("role", role) or role,
            "department": user.get("department", "Computer Science"),
            **profile,
        }
