import requests
from locust import HttpUser, task, between, events

# Global tokens
ADMIN_TOKEN = None
USER_TOKEN = None

@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    global ADMIN_TOKEN, USER_TOKEN
    host = environment.host or "http://127.0.0.1:8000"
    
    # Fetch admin token
    try:
        resp = requests.post(f"{host}/api/v1/auth/admin/login", json={
            "username": "superadmin",
            "password": "password123"
        })
        if resp.status_code == 200:
            ADMIN_TOKEN = resp.json().get("access_token")
            print("Successfully acquired Admin Token.")
        else:
            print(f"Failed to get Admin Token: {resp.status_code} {resp.text}")
    except Exception as e:
        print(f"Error fetching Admin Token: {e}")

    # Fetch user token
    try:
        resp = requests.post(f"{host}/api/v1/auth/login", json={
            "email": "archived-f02f61d33a@example.invalid",
            "password": "password123"
        })
        if resp.status_code == 200:
            USER_TOKEN = resp.json().get("access_token")
            print("Successfully acquired User Token.")
        else:
            print(f"Failed to get User Token: {resp.status_code} {resp.text}")
    except Exception as e:
        print(f"Error fetching User Token: {e}")

class AdminUser(HttpUser):
    wait_time = between(1, 3)
    weight = 1

    def on_start(self):
        if ADMIN_TOKEN:
            self.client.headers.update({"Authorization": f"Bearer {ADMIN_TOKEN}"})

    @task(3)
    def admin_overview(self):
        if ADMIN_TOKEN:
            self.client.get("/api/v1/admin-panel/stats", name="Admin Stats")

    @task(2)
    def admin_events(self):
        if ADMIN_TOKEN:
            self.client.get("/api/v1/admin-panel/events", name="Admin Events")

    @task(2)
    def admin_participants(self):
        if ADMIN_TOKEN:
            self.client.get("/api/v1/admin-panel/participants", name="Admin Participants")

    @task(1)
    def admin_me(self):
        if ADMIN_TOKEN:
            self.client.get("/api/v1/auth/admin/me", name="Admin Me")


class ParticipantUser(HttpUser):
    wait_time = between(1, 3)
    weight = 9

    def on_start(self):
        if USER_TOKEN:
            self.client.headers.update({"Authorization": f"Bearer {USER_TOKEN}"})

    @task(3)
    def view_events(self):
        if USER_TOKEN:
            self.client.get("/api/v1/events", name="User Events")

    @task(1)
    def view_me(self):
        if USER_TOKEN:
            self.client.get("/api/v1/auth/me", name="User Me")
