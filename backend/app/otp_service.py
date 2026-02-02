from __future__ import annotations

import secrets
import time
from dataclasses import dataclass
from typing import Dict, List, Optional

from .email_sender import send_email_otp
from .settings import settings


@dataclass
class _OtpRecord:
    otp: str
    expires_at: float
    created_at: float
    last_sent_at: float
    send_timestamps: List[float]
    verify_attempts: int


class OtpService:
    def __init__(self) -> None:
        self._store: Dict[str, _OtpRecord] = {}

    def _now(self) -> float:
        return time.time()

    def _cleanup(self, email: str) -> None:
        rec = self._store.get(email)
        if not rec:
            return
        if rec.expires_at <= self._now():
            del self._store[email]

    def _gen_otp(self) -> str:
        # 6-digit numeric OTP
        return f"{secrets.randbelow(1_000_000):06d}"

    def send_otp(self, email: str) -> str:
        now = self._now()
        self._cleanup(email)

        rec = self._store.get(email)
        if rec:
            if now - rec.last_sent_at < settings.otp_min_resend_seconds:
                raise ValueError("Please wait before requesting another code.")

            # Sliding window: 1 hour
            rec.send_timestamps = [t for t in rec.send_timestamps if now - t < 3600]
            if len(rec.send_timestamps) >= settings.otp_max_sends_per_hour:
                raise ValueError("Too many OTP requests. Try again later.")

            rec.otp = self._gen_otp()
            rec.created_at = now
            rec.expires_at = now + settings.otp_ttl_seconds
            rec.last_sent_at = now
            rec.send_timestamps.append(now)
            rec.verify_attempts = 0
        else:
            rec = _OtpRecord(
                otp=self._gen_otp(),
                created_at=now,
                expires_at=now + settings.otp_ttl_seconds,
                last_sent_at=now,
                send_timestamps=[now],
                verify_attempts=0,
            )
            self._store[email] = rec

        provider = settings.otp_provider.lower()

        if provider == "console":
            # Dev-friendly: logs OTP in server console
            print(f"[OTP] {email} -> {rec.otp}")
            return "console"

        if provider == "smtp":
            send_email_otp(email, rec.otp)
            return "smtp"

        raise RuntimeError(f"Unknown OTP_PROVIDER: {settings.otp_provider}")

    def verify_otp(self, email: str, otp: str) -> None:
        self._cleanup(email)
        rec = self._store.get(email)
        if not rec:
            raise ValueError("No active code for this email. Please request a new OTP.")

        if rec.expires_at <= self._now():
            del self._store[email]
            raise ValueError("OTP expired. Please request a new code.")

        rec.verify_attempts += 1
        if rec.verify_attempts > 5:
            del self._store[email]
            raise ValueError("Too many attempts. Please request a new code.")

        if otp.strip() != rec.otp:
            raise ValueError("Invalid OTP. Please try again.")

        # Success: consume OTP
        del self._store[email]


otp_service = OtpService()
