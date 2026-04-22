import asyncio
import os
from dotenv import load_dotenv
from supabase import create_async_client
import httpx

async def run():
    load_dotenv()
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    client = await create_async_client(url, key)
    
    # get admin token
    res = await client.auth.sign_in_with_password({
        "email": "archived-7835154600@example.invalid",
        "password": "Admin@Super1"
    })
    token = res.session.access_token
    
    # get event_id
    events_resp = await client.table('events').select('id').limit(1).execute()
    event_id = events_resp.data[0]['id']
    
    with open(r'c:\Users\Karti\Downloads\temp wk\Regn_1669636_BasicInfo_20260422_0211_NoFilters.csv', 'rb') as f:
        file_content = f.read()
        
    print("Sending POST request to upload...")
    async with httpx.AsyncClient(timeout=30.0) as http:
        files = {'file': ('test.csv', file_content, 'text/csv')}
        data = {'event_id': event_id}
        headers = {'Authorization': f'Bearer {token}'}
        
        response = await http.post(
            'http://127.0.0.1:8000/api/v1/admin-panel/registrations/upload',
            headers=headers,
            data=data,
            files=files
        )
        
        print(f"Status: {response.status_code}")
        print(f"Headers: {response.headers}")
        if not response.is_success:
            print(f"Body: {response.text}")
        else:
            print("OK, returning stream of size: ", len(response.content))

if __name__ == '__main__':
    asyncio.run(run())
