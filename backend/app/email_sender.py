from __future__ import annotations

import smtplib
import socket
from email.message import EmailMessage

from .settings import settings


def _send_email(subject: str, to_email: str, body: str) -> None:
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = to_email
    msg.set_content(body)

    if not settings.smtp_host:
        raise ValueError("SMTP is not configured (SMTP_HOST is empty).")

    # Common misconfig: user puts an email address into SMTP_HOST.
    if "@" in settings.smtp_host:
        raise ValueError("SMTP_HOST must be a hostname like smtp.gmail.com (not an email address).")

    try:
        server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15)
    except socket.gaierror:
        raise ValueError("Cannot resolve SMTP_HOST. Check SMTP_HOST and your internet/DNS.")
    try:
        if settings.smtp_use_tls:
            server.starttls()
        if settings.smtp_username:
            server.login(settings.smtp_username, settings.smtp_password)
        server.send_message(msg)
    except smtplib.SMTPException:
        raise ValueError("SMTP send failed. Verify SMTP credentials and settings.")
    finally:
        try:
            server.quit()
        except Exception:
            pass


def send_email_otp(to_email: str, otp: str) -> None:
    body = (
        """
Your verification code is:

{otp}

This code will expire in a few minutes.
If you did not request this, you can ignore this email.
""".strip().format(otp=otp)
    )
    _send_email("Your KEC Opportunities Hub verification code", to_email, body)


def notify_referral_request(to_email: str, student_email: str, message: str, post_title: str | None = None) -> None:
    subject = "New referral request on KEC Opportunities Hub"
    about = f"\n\nRegarding: {post_title}" if post_title else ""
    body = (
        """
You have received a new referral request.

From: {student_email}{about}

Message:
{message}

Open the app to chat and review the student's profile/resume.
""".strip().format(student_email=student_email, about=about, message=message)
    )

    provider = (settings.notify_provider or "console").lower()
    if provider == "console":
        print(f"[NOTIFY] To={to_email} Subject={subject}\n{body}")
        return
    if provider == "smtp":
        _send_email(subject, to_email, body)
        return

    raise ValueError(f"Unknown NOTIFY_PROVIDER: {settings.notify_provider}")


def notify_referral_decision(
    to_email: str,
    alumni_email: str,
    decision: str,
    note: str | None = None,
    post_title: str | None = None,
) -> None:
    subject = "Referral request update on KEC Opportunities Hub"
    about = f"\n\nRegarding: {post_title}" if post_title else ""
    extra = f"\n\nAlumni note:\n{note}" if note else ""
    body = (
        """
Your referral request has been updated.

Alumni: {alumni_email}
Status: {decision}{about}{extra}

Open the app to chat and continue.
""".strip().format(alumni_email=alumni_email, decision=decision, about=about, extra=extra)
    )

    provider = (settings.notify_provider or "console").lower()
    if provider == "console":
        print(f"[NOTIFY] To={to_email} Subject={subject}\n{body}")
        return
    if provider == "smtp":
        _send_email(subject, to_email, body)
        return

    raise ValueError(f"Unknown NOTIFY_PROVIDER: {settings.notify_provider}")
