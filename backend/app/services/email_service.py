from __future__ import annotations

import asyncio
import logging
import smtplib
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger(__name__)


async def send_email(
    recipient_email: str | None,
    subject: str,
    body: str,
) -> bool:
    """Generic transactional email send. Returns False if SMTP isn't
    configured or if delivery fails — callers must treat email as
    best-effort."""
    smtp_host = settings.SMTP_HOST
    from_email = settings.SMTP_FROM_EMAIL
    if not recipient_email or not smtp_host or not from_email:
        return False

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = from_email
    message["To"] = recipient_email
    message.set_content(body)

    def _send() -> None:
        with smtplib.SMTP(smtp_host, settings.SMTP_PORT) as smtp:
            if settings.SMTP_USE_TLS:
                smtp.starttls()
            if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            smtp.send_message(message)

    try:
        await asyncio.to_thread(_send)
        return True
    except Exception as exc:
        logger.warning("send_email failed for %s: %s", recipient_email, exc)
        return False


async def send_temporary_credentials(
    recipient_email: str | None,
    username: str,
    temporary_password: str,
) -> bool:
    smtp_host = settings.SMTP_HOST
    from_email = settings.SMTP_FROM_EMAIL
    if not recipient_email or not smtp_host or not from_email:
        return False

    message = EmailMessage()
    message["Subject"] = "Ascent Dashboard credentials"
    message["From"] = from_email
    message["To"] = recipient_email
    message.set_content(
        f"Your Ascent Dashboard credentials:\n\nUsername: {username}\nTemporary Password: {temporary_password}\n"
    )

    def _send() -> None:
        with smtplib.SMTP(smtp_host, settings.SMTP_PORT) as smtp:
            if settings.SMTP_USE_TLS:
                smtp.starttls()
            if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            smtp.send_message(message)

    import asyncio

    await asyncio.to_thread(_send)
    return True
