"""
Mint a JWT for the booth tool with a `booth_id` claim.

The /api/v1/auth/admin/login endpoint doesn't include `booth_id` in the
token (booth assignment isn't on the admins table yet), so for local
testing use this helper to mint a token directly.

Usage:
    cd backend
    uv run python scripts/mint_booth_token.py --uid 5 --booth AR_FILTER
    # → prints a token + a curl example

Then in the browser console at http://localhost:5173/booth:
    localStorage.setItem('ascent_admin_token', '<token>')
    location.reload()
"""

from __future__ import annotations

import argparse
from datetime import timedelta

from app.core.security import create_access_token


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--uid", type=int, required=True, help="admins.uid of the booth volunteer")
    p.add_argument("--booth", required=True,
                   help="booth_id (e.g. AR_FILTER, SCAVENGER, RAZORPAY, ECO_EXCHANGE, EVENT_WIN, ECO_DESIGN_WIN)")
    p.add_argument("--role", default="booth_volunteer",
                   help="JWT role claim (default booth_volunteer)")
    p.add_argument("--hours", type=int, default=12, help="token TTL in hours")
    args = p.parse_args()

    token = create_access_token(
        subject=f"admin:{args.uid}",
        role=args.role,
        expires_delta=timedelta(hours=args.hours),
        extra_claims={"booth_id": args.booth},
    )

    print()
    print("Token:")
    print(token)
    print()
    print("Browser console (at /booth):")
    print(f"  localStorage.setItem('ascent_admin_token', '{token}')")
    print("  location.reload()")
    print()
    print("Curl example:")
    print(f"  curl -H 'Authorization: Bearer {token}' \\")
    print(f"       -H 'Content-Type: application/json' \\")
    print(f"       -d '{{\"student_id\":\"<uuid>\",\"client_uuid\":\"abc-1\"}}' \\")
    print(f"       http://localhost:8000/api/v1/booth/award")


if __name__ == "__main__":
    main()
