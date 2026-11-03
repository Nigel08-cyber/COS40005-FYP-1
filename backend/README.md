# VolunteerHub API (FastAPI)

Run locally (PowerShell, from `backend/`):

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env      # then edit DATABASE_URL and JWT_SECRET
uvicorn app.main:app --reload
```

Docs UI: http://localhost:8000/docs

## Database
- `schema.sql` is the shared Neon schema (ERD v3). Run it once on a fresh database.
- `migrations/001_refresh_token.sql` adds the refresh_token table (API-owned).
- `migrations/002_registration_waitlist.sql` adds the `waitlisted` registration status. **Shared schema change: clear with Nigel, try on a Neon dev branch first.**

## Tests
```powershell
pytest -q                                  # in-memory SQLite
$env:TEST_DATABASE_URL = "postgresql+psycopg://USER:PASS@HOST/DB"   # a throw-away PostgreSQL with schema.sql loaded
pytest -q                                  # same suite on PostgreSQL (truncates every table first!)
```

## Endpoints
| Area | Endpoints |
| --- | --- |
| Auth | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `GET /auth/me`, `PATCH /auth/users/{id}/system-role` |
| Volunteer profile | `GET/PUT/PATCH /me/profile`, `GET /skills`, `POST /skills` (admin) |
| Volunteer history | `GET /me/contributions`, `/me/stats`, `/me/hours?months=6`, `/me/certificates`, `/me/activities?past=bool` |
| NGO | `POST/GET /ngos`, `GET/PATCH /ngos/{id}`, `PATCH /ngos/{id}/status` (admin), `GET/POST /ngos/{id}/members`, `DELETE /ngos/{id}/members/{user_id}`, `GET /ngos/{id}/dashboard` |
| Projects | `POST/GET /projects`, `GET/PATCH /projects/{id}`, `PATCH /projects/{id}/status`, `PUT /projects/{id}/coordinator`, `GET/PUT /projects/{id}/skills`, `GET /me/coordinated-projects` |
| Events | `POST/GET /projects/{id}/events`, `GET/PATCH /events/{id}` |
| Applications | `POST /projects/{id}/applications`, `DELETE /projects/{id}/applications/me`, `GET /projects/{id}/applications`, `PATCH /applications/{id}`, `GET /me/applications` |
| Registrations | `POST /events/{id}/registrations` (full event => `waitlisted`), `DELETE /events/{id}/registrations/me`, `GET /me/registrations` |
