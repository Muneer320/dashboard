import asyncio
import os
import asyncpg
import socket

async def test_db():
    print("Testing DB Connection...")
    # Read from .env manually to ensure we have the right one
    url = "postgresql://archive:archive-local-only@127.0.0.1:5432/archive_demo"

    # First test basic DNS resolution
    host = "db.dqzeyiumettgfcebqnmo.supabase.co"
    try:
        print(f"Resolving {host}...")
        results = socket.getaddrinfo(host, 5432, 0, socket.SOCK_STREAM)
        for r in results:
            print(f" Resolved to: {r[4][0]} (Family: {r[0]})")
    except Exception as e:
        print(f" DNS Resolution failed: {e}")

    # Now test asyncpg
    print("\nAttempting asyncpg connection with port 5432...")
    try:
        conn = await asyncpg.connect(url, timeout=10)
        print(" Successfully connected using port 5432 (direct)! ")
        await conn.close()
    except Exception as e:
        print(f" Connection on 5432 failed: {type(e).__name__} - {e}")
        
    print("\nAttempting asyncpg connection with port 6543 (Supabase transaction pooler)...")
    url_pooler = url.replace(":5432", ":6543")
    try:
        conn = await asyncpg.connect(url_pooler, timeout=10)
        print(" Successfully connected using port 6543 (pooler)! ")
        await conn.close()
    except Exception as e:
        print(f" Connection on 6543 failed: {type(e).__name__} - {e}")

if __name__ == "__main__":
    asyncio.run(test_db())
