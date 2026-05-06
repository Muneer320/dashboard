"""
Notification triggers for all coin-related events.

Each call writes a row to the `notifications` table (in-app bell) and
attempts an email send (best-effort). Email lookup pulls the user's
mail off either `users.details.mail` or the dedicated column when
present — admins/students each define this in their own way, so the
helper just falls back gracefully.
"""

from __future__ import annotations

import logging
from typing import Any

from app.db.supabase_client import first_row, get_client
from app.services.email_service import send_email

logger = logging.getLogger(__name__)


NOTIFICATION_TEMPLATES: dict[str, dict[str, str]] = {
    "ugc_approved": {
        "title": "Post verified! 🎉",
        "body": "Your {source} post was approved. +{coins} coins added.",
    },
    "booth_award": {
        "title": "+{coins} coins from {source}",
        "body": "A volunteer awarded you {coins} coins at the {source} booth.",
    },
    "ugc_rejected": {
        "title": "Post needs attention",
        "body": "Your {source} post was rejected: {reason}. Please fix and resubmit.",
    },
    "ugc_reverification_required": {
        "title": "Re-verification needed",
        "body": (
            "Your previously verified {source} post failed re-verification: "
            "{reason}. {coins} coins have been reversed; restore them by "
            "re-submitting before {deadline}."
        ),
    },
    "post_deleted_reversal": {
        "title": "Post removed — action needed",
        "body": (
            "We couldn't find your post at {url}. {coins} coins reversed. "
            "Repost by {deadline} to restore them."
        ),
    },
    "reversal_permanent": {
        "title": "Coins reversal finalised",
        "body": "The reversal on your {source} post is now permanent.",
    },
    "creator_collab_invite": {
        "title": "{name} tagged you in a Creator Collab",
        "body": "Confirm to earn 150 coins. You have {hours}h to respond.",
    },
    "snapshot_taken": {
        "title": "Leaderboard snapshot locked",
        "body": "The {tier} snapshot has been taken. Check your reward status.",
    },
    "certificate_issued": {
        "title": "Your ASCENT'26 certificate is ready",
        "body": "You earned the {tier} certificate. Download and share on LinkedIn!",
    },
    "surprise_drop_live": {
        "title": "⚡ Surprise Drop is LIVE",
        "body": "{criteria} — act fast!",
    },
    "surprise_drop_won": {
        "title": "You won a Surprise Drop! 🎁",
        "body": "You've been awarded {reward}. Claim at the merch booth.",
    },
}


def _render(template: str, context: dict[str, Any]) -> str:
    """Render a template safely — missing keys render as empty string."""
    class _D(dict):
        def __missing__(self, key: str) -> str:  # noqa: D401
            return ""
    return template.format_map(_D(context))


async def notify_student(
    student_id: str,
    template_key: str,
    context: dict[str, Any] | None = None,
) -> None:
    """Insert into `notifications` table and best-effort email."""
    ctx = context or {}
    template = NOTIFICATION_TEMPLATES.get(template_key)
    if template is None:
        logger.warning("notify_student called with unknown template: %s", template_key)
        return

    title = _render(template["title"], ctx)
    body = _render(template["body"], ctx)

    supabase = await get_client()
    try:
        await supabase.table("notifications").insert({
            "user_id": str(student_id),
            "template_key": template_key,
            "title": title,
            "body": body,
            "context": ctx,
        }).execute()
    except Exception:
        # Don't let a notification failure cascade — surface but proceed.
        logger.exception("Failed to insert in-app notification (%s)", template_key)

    # Lookup recipient email and send (best-effort).
    try:
        user_resp = await (
            supabase.table("users")
            .select("details")
            .eq("id", str(student_id))
            .limit(1)
            .execute()
        )
        user = first_row(user_resp)
        details = (user or {}).get("details") or {}
        recipient = details.get("mail") or details.get("email")
        if recipient:
            await send_email(recipient, title, body)
    except Exception:
        logger.exception("Failed email send for notification (%s)", template_key)
