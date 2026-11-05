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
- `migrations/003_password_reset.sql` adds the password_reset_token table (API-owned, same as 001).

## Tests
```powershell
pytest -q                                  # in-memory SQLite
$env:TEST_DATABASE_URL = "postgresql+psycopg://USER:PASS@HOST/DB"   # a throw-away PostgreSQL with schema.sql loaded
pytest -q                                  # same suite on PostgreSQL (truncates every table first!)
```

## Endpoints
| Area | Endpoints |
| --- | --- |
| Auth | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `GET /auth/me` (user object has `user_id`/`id`, `roles[]` and the single `role` the frontend routes on), `PATCH /auth/users/{id}/system-role` |
| Admin users (item 23b) | `GET /users?q=&role=&account_status=&limit=&offset=` (System Admin only; every account with `roles[]` and `organisations[]`), `PATCH /users/{id}/status {account_status: active|suspended}` (suspending signs the user out everywhere; you cannot change your own) |
| Password reset (item 19) | `POST /auth/password-reset {email}` (always 202, same answer whether or not the account exists), `POST /auth/password-reset/check {token}` (204 or 400, for the expired-link page), `POST /auth/password-reset/confirm {token, new_password}` (204 or 400; signs the account out everywhere). Link = `FRONTEND_URL/reset-password?token=...`, valid `PASSWORD_RESET_MINUTES` (30), single use, one email per account per minute. `EMAIL_BACKEND=log` writes the link to the server log until Brevo (item 26) is connected |
| Opportunities (volunteer browse) | `GET /opportunities`, `GET /opportunities/{project_id}` (active project + next event + counts + skills + distance) |
| Volunteer profile | `GET/PUT/PATCH /me/profile`, `GET /skills`, `POST /skills` (admin) |
| Volunteer history | `GET /me/contributions`, `/me/stats`, `/me/hours?months=6`, `/me/certificates`, `/me/activities?past=bool` |
| NGO | `POST/GET /ngos`, `GET/PATCH /ngos/{id}`, `PATCH /ngos/{id}/status` (admin), `GET/POST /ngos/{id}/members`, `DELETE /ngos/{id}/members/{user_id}`, `GET /ngos/{id}/dashboard` |
| Projects | `POST/GET /projects`, `GET/PATCH /projects/{id}`, `PATCH /projects/{id}/status`, `PUT /projects/{id}/coordinator`, `GET/PUT /projects/{id}/skills`, `GET /me/coordinated-projects` |
| Events | `POST/GET /projects/{id}/events`, `GET/PATCH /events/{id}` |
| Applications | `POST /projects/{id}/applications`, `DELETE /projects/{id}/applications/me`, `GET /projects/{id}/applications`, `PATCH /applications/{id}`, `GET /me/applications` |
| Registrations | `POST /events/{id}/registrations` (full event => `waitlisted`), `DELETE /events/{id}/registrations/me`, `GET /me/registrations` |
