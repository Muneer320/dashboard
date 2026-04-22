import asyncio
from app.services.bulk_enroll_service import bulk_enroll, parse_upload

async def test():
    content = b"Name,Email,Phone\nJohn Doe,john@example.com,1234567890\nJane Doe,jane@example.com,0987654321"
    parsed = parse_upload("test.csv", content)
    print("Parsed:", parsed)

asyncio.run(test())
