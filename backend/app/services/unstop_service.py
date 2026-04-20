import secrets

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash
from app.models.user import User
from app.schemas.unstop import UnstopUserItem
from app.services.email_service import send_temporary_credentials


async def sync_unstop_users(session: AsyncSession, users: list[UnstopUserItem]) -> dict:
    created_credentials: list[dict[str, str]] = []
    pending_emails: list[dict[str, str]] = []
    created_count = 0
    updated_count = 0

    for incoming in users:
        result = await session.execute(
            select(User).where((User.unstop_id == incoming.unstop_id)
                               | (User.username == incoming.username))
        )
        user = result.scalar_one_or_none()
        if user is None:
            temporary_password = secrets.token_urlsafe(10)
            user = User(
                unstop_id=incoming.unstop_id,
                username=incoming.username,
                password_hash=get_password_hash(temporary_password),
                name=incoming.name,
                details=incoming.details,
                events={},
                food={"meal1": False, "meal2": False, "meal3": False},
                is_attending=False,
                is_profile_complete=incoming.is_profile_complete,
                cents=0,
            )
            session.add(user)
            created_count += 1
            created_credentials.append(
                {
                    "unstop_id": incoming.unstop_id,
                    "username": incoming.username,
                    "temporary_password": temporary_password,
                }
            )
            email_address = (incoming.details or {}).get("email")
            if email_address:
                pending_emails.append(
                    {
                        "email": email_address,
                        "username": incoming.username,
                        "temporary_password": temporary_password,
                    }
                )
            continue

        user.unstop_id = incoming.unstop_id
        user.name = incoming.name
        user.details = incoming.details
        user.is_profile_complete = incoming.is_profile_complete
        updated_count += 1

    await session.commit()

    for email_payload in pending_emails:
        await send_temporary_credentials(
            recipient_email=email_payload["email"],
            username=email_payload["username"],
            temporary_password=email_payload["temporary_password"],
        )

    return {
        "created": created_count,
        "updated": updated_count,
        "created_credentials": created_credentials,
    }
