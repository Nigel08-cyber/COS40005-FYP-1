<h1 align="center">VolunteerHub API</h1>

<p align="center">
  <strong>FastAPI back end for VolunteerHub.</strong><br>
  Auth, NGOs, projects, events, applications, QR attendance, notifications and the audit log.
</p>

<p align="center">
  <img alt="API: FastAPI" src="https://img.shields.io/badge/api-FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white">
  <img alt="Database: PostgreSQL on Neon" src="https://img.shields.io/badge/db-PostgreSQL%20on%20Neon-336791?style=flat-square&logo=postgresql&logoColor=white">
  <img alt="Tests: 87 passing" src="https://img.shields.io/badge/tests-87%20passing-brightgreen?style=flat-square">
</p>

<p align="center">
  <a href="../README.md">Project overview</a> ·
  <a href="#database">Database</a> ·
  <a href="#tests">Tests</a> ·
  <a href="#endpoints">Endpoints</a> ·
  <a href="#scheduler-item-26a">Scheduler</a> ·
  <a href="#staging-item-30-vercel--neon--this-backend-on-your-machine-through-tailscale-funnel">Staging</a>
</p>

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
- `migrations/004_sprint3_indexes.sql` adds indexes for notifications and the audit log (no new tables; safe to run twice).

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
| Email (items 24, 26) | Brevo behind `app/mailer.py` (`EMAIL_BACKEND=brevo`, `BREVO_API_KEY`, `MAIL_FROM_EMAIL`). Templates in `app/notifications.py`: registration confirmation, waitlist, waitlist promotion, reminder, last-minute update/cancellation, post-event thank-you |
| Notifications (bell) | `GET /me/notifications?unread_only=&limit=&offset=`, `GET /me/notifications/unread-count`, `POST /me/notifications/{id}/read`, `POST /me/notifications/read-all` |
| QR attendance (items 25, 25a) | Coordinator: `GET /events/{id}/qr` (current code, rotates every 5 min), `POST /events/{id}/qr` (rotate now), `GET /events/{id}/attendance` (who is in), `PUT /events/{id}/attendance/{user_id}` (correct times or `absent`). Volunteer: `POST /attendance/scan {token}` (first scan = check-in, next = check-out + hours + contribution), `GET /events/{id}/attendance/me` |
| Contributions (item 27) | `GET /me/contributions` (now with `skills`, `attendance_id`), `GET /projects/{id}/contributions`, `PATCH /contributions/{id} {status}` (verify/reject) |
| Feedback (item 27a) | `POST /events/{id}/feedback {rating 1-5, comments}` (attended volunteers only, once), `GET /events/{id}/feedback/me`, `GET /me/feedback/pending`, coordinator `GET /events/{id}/feedback` |
| Audit log (item 27c) | every POST/PUT/PATCH/DELETE is logged (who, route, status, IP; never bodies). `GET /audit-logs?action=&user_id=&limit=&offset=` (System Admin only) |

Full list with request/response types: [`docs/API.md`](docs/API.md) (regenerate with `python -m scripts.export_api_docs`).

## Scheduler (item 26a)
One APScheduler job (every `SCHEDULER_INTERVAL_SECONDS`, default 60) queues reminders (events starting within `REMINDER_HOURS_BEFORE`, default 24) and post-event thank-yous (to volunteers who checked in), then sends due emails. The `notification` table is the queue, so a restart never loses or repeats a mail. **Missed reminders:** still sent late if the event has not started, skipped once it has. **Run exactly one backend process** (no `--workers`), or each job runs once per process.

## Staging (item 30): Vercel + Neon + this backend on your machine through Tailscale Funnel
```powershell
# 1. backend/.env  (never commit)
#    DATABASE_URL=<Neon pooled connection string>      JWT_SECRET=<python -c "import secrets; print(secrets.token_urlsafe(48))">
#    ENVIRONMENT=production   COOKIE_SECURE=true   COOKIE_SAMESITE=lax   (none only if the browser sees two different sites)
#    CORS_ORIGINS=https://cos-40005-fyp-1.vercel.app   FRONTEND_URL=https://cos-40005-fyp-1.vercel.app
#    EMAIL_BACKEND=brevo   BREVO_API_KEY=...   MAIL_FROM_EMAIL=...   TRUST_PROXY_HEADERS=true
# 2. run the backend (one process, no --reload)
uvicorn app.main:app --host 127.0.0.1 --port 8000
# 3. expose it over HTTPS
tailscale funnel 8000
# 4. Vercel -> Project -> Settings -> Environment Variables: BACKEND_URL = the https://....ts.net URL, then redeploy
# 5. check HTTPS + CORS + cookie from any terminal
python -m scripts.smoke_staging --url https://YOUR.ts.net --origin https://cos-40005-fyp-1.vercel.app --email you@example.com --password "..."
```
With `ENVIRONMENT=production` the backend refuses to start if `JWT_SECRET` is the default or short, `COOKIE_SECURE` is false, or `CORS_ORIGINS` still lists localhost. Neon needs migrations 001 to 004 applied.
