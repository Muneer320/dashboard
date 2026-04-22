import sys
import asyncio
import time
sys.path.insert(0, '.')
from app.services.bulk_enroll_service import bulk_enroll, parse_upload
from app.db.supabase_client import get_client

async def run():
    st = time.time()
    client = await get_client()
    print("get_client:", time.time() - st); st = time.time()
    with open(r'c:\Users\Karti\Downloads\temp wk\Regn_1669636_BasicInfo_20260422_0211_NoFilters.csv', 'rb') as f:
        content = f.read()
    
    rows = parse_upload('test.csv', content)
    print("parse_upload:", time.time() - st); st = time.time()
    events_resp = await client.table('events').select('id').limit(1).execute()
    event_id = events_resp.data[0]['id']
    print("fetch event:", time.time() - st); st = time.time()

    
    print(f'Testing with {len(rows)} rows')
    res = await bulk_enroll(client, event_id, rows)
    print("New credentials:", len(res["new_credentials"]))
    print("Added to existing:", len(res["added_to_existing"]))
    print("Duplicates:", len(res["duplicates_detail"]))
    print("Errors:", len(res["errors_detail"]))
    if res["errors_detail"]:
        print("First error:", res["errors_detail"][0])

if __name__ == '__main__':
    asyncio.run(run())
