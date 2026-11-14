# Functional test checklist (backlog item 28)

How to read it: **Auto** = covered by the backend test suite (`pytest -q`, 87 tests, also green on PostgreSQL with the real
schema and triggers). **Manual** = click it through on the running app and tick the box. Fill in the Result column on test day.

Run the automated part: `pytest -q`. Run the manual part against local (backend `uvicorn app.main:app`, frontend `npm run dev`)
or against staging (`python -m scripts.smoke_staging ...` first).

## Sprint 1

| # | Requirement | How to verify | Evidence | Result |
|---|---|---|---|---|
| 1 | Tech stack confirmed | Tech stack doc matches the code (schema changes are plain SQL migrations, not Alembic) | POC-003_Tech_Stack.docx | Manual |
| 2 | Repo + branch policy | `main` is protected by PRs; `dev-testing-backup` used for work | GitHub settings | Manual |
| 3 | Local environments | Fresh clone: README steps give a working backend and frontend | README.md | Manual |
| 4, 4a | ER diagram v2/v3 | ERD matches `schema.sql` (23 tables) | ERD PDF, schema.sql | Manual |
| 6 | Database set up | Neon has all tables; `migrations/001..004` applied | Neon SQL editor | Manual |
| 7 | Seed data | Demo logins work; projects/events visible | seed pack | Manual |
| 5, 8 | Backlog, personas | Documents exist and match the roles in the app | docs | Manual |
| 9-16 | Wireframes (registration, NGO profile, browse, project/event, NGO dashboard, volunteer dashboard, QR check-in, admin) | Each built screen matches its wireframe | Figma | Manual |

## Sprint 2

| # | Requirement | How to verify | Evidence | Result |
|---|---|---|---|---|
| 16a, 16b | Certificate and AI review wireframes | Figma pages exist | Figma | Manual |
| 17 | Auth: custom JWT, Argon2, storage, expiry, reset | Login, wrong password, refresh rotation, reuse detection, logout | test_auth.py, test_password_reset.py | Auto |
| 18 | RBAC, four roles | Each role only reaches its pages/endpoints; other NGO's data is 403 | test_auth.py, test_ngo_admin.py, test_admin_users.py | Auto |
| 19 | Register / login / password reset | Sign up, log in, request reset, open emailed link, set new password, old password fails | test_password_reset.py + real email once (item 26) | Auto + Manual |
| 20 | Volunteer history model + profile API | Profile save/load; contributions, stats, hours, activities | test_volunteers.py | Auto |
| 21, 23 | Frontend: registration, profile, browse, NGO profile, dashboard, project form, details | Click through as volunteer and NGO admin | UI | Manual |
| 22 | NGO/org API, dashboard data, project/event CRUD, coordinator link | Create org, admin approves, project, event, coordinator | test_ngos_projects.py, test_ngo_admin.py | Auto |
| 22a | Applications and registrations | Apply, withdraw, approve/reject, register, cancel, waitlist, promotion | test_applications.py | Auto |
| 23a | Applications and coordinator screens | Apply/withdraw/register/cancel screens; coordinator review and assign | UI | Manual |
| 23b | Admin panel | Users list, suspend/reactivate, approve NGO | test_admin_users.py + UI | Auto + Manual |

## Sprint 3

| # | Requirement | How to verify | Evidence | Result |
|---|---|---|---|---|
| 24 | Notification templates: confirmation, reminder, last-minute update, thank-you | Register: confirmation + bell entry. Wait for reminder. Change/cancel event: update mail. After check-out: thank-you | test_notifications.py | Auto + Manual |
| 25 | Rotating QR with expiry, validated | Code stays for 5 min then changes; old code refused; non-staff cannot read it | test_attendance.py | Auto |
| 25a | Scan flow, hours, coordinator view | First scan checks in, second checks out with hours; double scan, early, late, unregistered refused; coordinator list + correction | test_attendance.py + phone test | Auto + Manual |
| 26 | Brevo email | `EMAIL_BACKEND=brevo`: a real password-reset email arrives; failure never breaks the request | test_mailer.py + real send | Auto + Manual |
| 26a | Scheduled reminders | Event starting within 24 h: one reminder per registered volunteer, none twice, none for waitlisted/cancelled; missed reminder sent late only before start; restart safe | test_notifications.py | Auto |
| 27 | Contribution tracking | Check-out creates a verified contribution with hours, role, skills; staff can verify/reject; rejected hours leave dashboards | test_contributions_feedback.py | Auto + Manual (dashboard UI) |
| 27a | Feedback form and storage | Only attendees, once, rating 1-5; coordinator sees list and average | test_contributions_feedback.py | Auto + Manual (form UI) |
| 27b | Certificates (PDF + verification page) | Not built yet (Trishanth, Nigel) | - | Not done |
| 27c | Audit log + hardening | Failed/successful logins and every change logged without passwords; admin can query; production refuses unsafe config; rate limiting on login/reset (Nigel) | test_audit_and_config.py | Auto (rate limiting: pending) |
| 29 | API documentation | `docs/API.md` lists every endpoint (regenerate with `python -m scripts.export_api_docs`) | docs/API.md | Done |
| 30 | Staging build | `python -m scripts.smoke_staging --url ... --origin ... --email ... --password ...` all PASS; login works from the Vercel site | smoke script | Manual |
