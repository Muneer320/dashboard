"""
Google Sheets logger — appends a row to the cart orders sheet whenever
a student locks a reward reservation.

Fails silently: a Sheets outage never blocks a reward reservation.
The gspread client is cached after the first call (no re-auth per request).
"""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

logger = logging.getLogger(__name__)

_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]


@lru_cache(maxsize=1)
def _client():
    import gspread
    from google.oauth2.service_account import Credentials

    sa_file = os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE", "google_service_account.json")
    path = Path(sa_file)
    if not path.is_absolute():
        path = Path(__file__).parent.parent.parent / path
    creds = Credentials.from_service_account_file(str(path), scopes=_SCOPES)
    return gspread.authorize(creds)


def _append_sync(sheet_id: str, row: list) -> None:
    _client().open_by_key(sheet_id).sheet1.append_row(row, value_input_option="USER_ENTERED")


async def log_cart_order(
    *,
    username: str,
    email: str,
    coins_before: int,
    coins_after: int,
    tier_label: str,
) -> None:
    sheet_id = os.getenv("GOOGLE_SHEET_ID", "")
    if not sheet_id:
        return
    row = [
        datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
        username,
        email,
        coins_before,
        coins_after,
        tier_label,
    ]
    loop = asyncio.get_running_loop()
    try:
        await loop.run_in_executor(None, _append_sync, sheet_id, row)
        logger.info("Sheets row written: %s / %s", username, tier_label)
    except Exception as exc:
        logger.warning("Sheets write failed (non-fatal): %s", exc)
