"""
Auto-check service for UGC URL submissions.
Runs before admin sees the submission.
Returns pass/fail with specific reason for each check.

IMPORTANT: LinkedIn heavily restricts scraping.
If scraping fails with a non-404 error, do not auto-reject.
Instead flag as needs_manual_check and let admin verify.
"""

from __future__ import annotations

import hashlib
import re
from datetime import datetime, timezone
from typing import Any

import httpx

from app.core.coins_config import POWER_HOURS, POWER_HOUR_ELIGIBLE_SOURCES


async def run_auto_check(
    url: str,
    source_type: str,
    student_linkedin_handle: str | None,
    student_instagram_handle: str | None,
    submitted_at: datetime,
    existing_submissions: list[dict[str, Any]],
    current_student_id: str | None = None,
) -> dict[str, Any]:
    """
    Returns:
    {
        passed: bool,
        reason: str | None,          # if failed
        power_hour_eligible: bool,
        fingerprint: str,
        published_timestamp: datetime | None,
        needs_manual_check: bool,    # true if scrape failed non-fatally
        flags: list[str]             # warnings for admin
    }
    """
    result: dict[str, Any] = {
        "passed": False,
        "reason": None,
        "power_hour_eligible": False,
        "fingerprint": "",
        "published_timestamp": None,
        "needs_manual_check": False,
        "flags": [],
    }

    # CHECK 1: URL resolves and is publicly visible
    page_text = ""
    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
            resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
        if resp.status_code == 404:
            result["reason"] = "post_not_found"
            return result
        if resp.status_code == 403:
            result["reason"] = "post_private_or_restricted"
            return result
        if resp.status_code >= 500:
            # Server error — do not reject. Flag for manual check.
            result["needs_manual_check"] = True
            result["flags"].append("url_check_server_error")
            result["passed"] = True
            return result
        page_text = resp.text
    except httpx.TimeoutException:
        result["needs_manual_check"] = True
        result["flags"].append("url_check_timeout")
        result["passed"] = True
        return result
    except Exception:
        result["needs_manual_check"] = True
        result["flags"].append("url_check_failed")
        result["passed"] = True
        return result

    # CHECK 2: Handle match — URL belongs to student's linked account
    handle_found = False
    if student_linkedin_handle and student_linkedin_handle.lower() in url.lower():
        handle_found = True
    if student_instagram_handle and student_instagram_handle.lower() in url.lower():
        handle_found = True
    if not handle_found:
        result["reason"] = "handle_mismatch"
        return result

    # CHECK 3: Required hashtag present
    page_lower = page_text.lower()
    if "#ascent26" not in page_lower and "%23ascent26" not in page_lower:
        # LinkedIn may not expose hashtags in scraped HTML
        # Flag for admin instead of hard reject
        result["flags"].append("hashtag_not_found_in_scrape")
        result["needs_manual_check"] = True

    # CHECK 4: Duplicate URL check
    for existing in existing_submissions:
        if existing.get("url") == url and existing.get("source_type") == source_type:
            result["reason"] = "duplicate_url_same_source"
            return result
        if (
            existing.get("url") == url
            and current_student_id is not None
            and existing.get("student_id") != current_student_id
        ):
            result["flags"].append("url_used_by_another_student")

    # CHECK 5: Fingerprint for daily re-check
    fingerprint_data = page_text[:500] if page_text else url
    result["fingerprint"] = hashlib.md5(fingerprint_data.encode()).hexdigest()

    # CHECK 6: Power Hour eligibility
    # published_timestamp extraction is best-effort
    # If not extractable, use submitted_at as approximation
    published_ts = _extract_published_timestamp(page_text) or submitted_at
    result["published_timestamp"] = published_ts

    if source_type in POWER_HOUR_ELIGIBLE_SOURCES:
        result["power_hour_eligible"] = _is_in_power_hour(published_ts)

    result["passed"] = True
    return result


def _is_in_power_hour(timestamp: datetime) -> bool:
    """Check if a timestamp falls inside any Power Hour window."""
    return power_hour_window_key(timestamp) is not None


def power_hour_window_key(timestamp: datetime) -> str | None:
    """Identify which Power Hour window a timestamp falls in.

    Returns a stable string key like 'day1_17:00-18:00' that can be
    persisted in ledger metadata. Returns None if outside any window.
    Day matching is by date (UTC), not just time-of-day.
    """
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)
    t = timestamp.astimezone(timezone.utc)
    hour_minute = t.strftime("%H:%M")
    for window in POWER_HOURS:
        if window["start"] <= hour_minute < window["end"]:
            return f"day{window['day']}_{window['start']}-{window['end']}_{t.date().isoformat()}"
    return None


_PUBLISHED_TIME_RE = re.compile(r'published_time["\s:]+([0-9T:+\-Z]+)')
_DATE_PUBLISHED_RE = re.compile(r'"datePublished"\s*:\s*"([^"]+)"')


def _extract_published_timestamp(page_text: str) -> datetime | None:
    """
    Best-effort extraction of post publish time from page HTML.
    LinkedIn and Instagram embed timestamps in meta tags or JSON-LD.
    Returns None if not extractable — caller will use submitted_at.
    """
    if not page_text:
        return None

    for pattern in (_PUBLISHED_TIME_RE, _DATE_PUBLISHED_RE):
        match = pattern.search(page_text)
        if match:
            ts = _parse_iso8601(match.group(1))
            if ts is not None:
                return ts
    return None


def _parse_iso8601(value: str) -> datetime | None:
    """Parse an ISO 8601 timestamp; tolerate trailing 'Z'."""
    try:
        cleaned = value.strip()
        if cleaned.endswith("Z"):
            cleaned = cleaned[:-1] + "+00:00"
        return datetime.fromisoformat(cleaned)
    except (ValueError, TypeError):
        return None
