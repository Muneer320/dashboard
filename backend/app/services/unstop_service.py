"""Supabase-backed Unstop sync service."""

from __future__ import annotations

import secrets
import uuid

from fastapi import HTTPException, status
from supabase import AsyncClient

from app.core.security import get_password_hash
from app.db.supabase_client import first_row, rows
from app.models.user import User
from app.schemas.unstop import UnstopUserItem
from app.services.email_service import send_temporary_credentials


async def sync_unstop_users(supabase: AsyncClient, users: list[UnstopUserItem]) -> dict:
    created_credentials: list[dict[str, str]] = []
    pending_emails: list[dict[str, str]] = []
    created_count = 0
    updated_count = 0

    for incoming in users:
        # Look up by unstop_id OR username
        by_unstop = await (
            supabase.table("users")
            .select("*")
            .eq("unstop_id", incoming.unstop_id)
            .limit(1)
            .execute()
        )
        row = first_row(by_unstop)

        if row is None:
            by_username = await (
                supabase.table("users")
                .select("*")
                .eq("username", incoming.username)
                .limit(1)
                .execute()
            )
            row = first_row(by_username)

        if row is None:
            # Create new user
            temporary_password = secrets.token_urlsafe(10)
            new_user = User(
                id=uuid.uuid4(),
                unstop_id=incoming.unstop_id,
                username=incoming.username,
                password_hash=get_password_hash(temporary_password),
                name=incoming.name,
                details=incoming.details or {},
                events={},
                food={"meal1": False, "meal2": False, "meal3": False},
                is_attending=False,
                is_profile_complete=incoming.is_profile_complete,
                cents=0,
            )
            await (
                supabase.table("users")
                .insert(new_user.to_insert())
                .execute()
            )
            created_count += 1
            created_credentials.append({
                "unstop_id": incoming.unstop_id,
                "username": incoming.username,
                "temporary_password": temporary_password,
            })
            email_address = (incoming.details or {}).get("email")
            if email_address:
                pending_emails.append({
                    "email": email_address,
                    "username": incoming.username,
                    "temporary_password": temporary_password,
                })
        else:
            # Update existing user
            await (
                supabase.table("users")
                .update({
                    "unstop_id": incoming.unstop_id,
                    "name": incoming.name,
                    "details": incoming.details or {},
                    "is_profile_complete": incoming.is_profile_complete,
                })
                .eq("id", row["id"])
                .execute()
            )
            updated_count += 1

    # Send emails after all DB ops are done
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
