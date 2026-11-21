<p align="center">
  <img alt="Tandem logo" src="branding/tandem/svg/icon.svg" width="96">
</p>

<h1 align="center">Tandem</h1>

<p align="center">
  <strong>Find volunteer work, run NGO projects and track every hour in one place.</strong><br>
  Volunteers browse and join opportunities, NGOs manage projects and events, and QR check-in turns attendance into verified contribution hours. COS 40005, Group 14, POC-003.
</p>

<p align="center">
  <img alt="Sprint 3 backend" src="https://img.shields.io/badge/sprint-3-0ea5e9?style=flat-square">
  <img alt="UI: Next.js and Tailwind" src="https://img.shields.io/badge/ui-Next.js%20%2B%20Tailwind-000000?style=flat-square&logo=nextdotjs&logoColor=white">
  <img alt="API: FastAPI" src="https://img.shields.io/badge/api-FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white">
  <img alt="Database: PostgreSQL on Neon" src="https://img.shields.io/badge/db-PostgreSQL%20on%20Neon-336791?style=flat-square&logo=postgresql&logoColor=white">
  <img alt="Node.js 20+" src="https://img.shields.io/badge/node-20%2B-339933?style=flat-square&logo=nodedotjs&logoColor=white">
  <img alt="Tests: 87 passing" src="https://img.shields.io/badge/tests-87%20passing-brightgreen?style=flat-square">
  <img alt="License: academic project" src="https://img.shields.io/badge/license-academic-lightgrey?style=flat-square">
</p>

<p align="center">
  <a href="#features">Features</a> ·
  <a href="#whats-new-in-sprint-3">What's new</a> ·
  <a href="#getting-started">Getting started</a> ·
  <a href="#usage">Usage</a> ·
  <a href="#deployment">Deployment</a> ·
  <a href="#roadmap">Roadmap</a> ·
  <a href="#license">License</a>
</p>

**Live site:** [cos-40005-fyp-1.vercel.app](https://cos-40005-fyp-1.vercel.app)  
**Testing site:** [dev-testing-backup preview](https://cos-40005-fyp-1-git-dev-testing-backup-epstein-survivors.vercel.app)

## Table of contents

- [About](#about)
- [Features](#features)
- [What's new in Sprint 3](#whats-new-in-sprint-3)
- [Getting started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Run locally](#run-locally)
  - [Configuration](#configuration)
- [Usage](#usage)
- [Deployment](#deployment)
- [Configuration and data](#configuration-and-data)
- [Project structure](#project-structure)
- [Tech stack](#tech-stack)
- [Documentation](#documentation)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [Security and privacy](#security-and-privacy)
- [Contributing](#contributing)
- [Changelog](#changelog)
- [Team](#team)
- [License](#license)

## About

Tandem connects volunteers with community NGOs. A volunteer builds a profile with skills and availability, finds an opportunity, applies, registers for an event and shows up. The NGO reviews applications, runs the events and sees who actually attended. Attendance is recorded by scanning a QR code at the event, and the hours flow into the volunteer's contribution history without anyone retyping them.

It is a two-part app: a Next.js front end on Vercel, and a FastAPI back end that talks to a PostgreSQL database on Neon. The back end runs on a team machine and is exposed over HTTPS with Tailscale Funnel, so the whole stack stays on free tiers.

## Features

**Volunteers**

- Sign up, profile with skills and availability, password reset by email
- Browse opportunities with distance, view project details, apply and withdraw
- Register for events, with an automatic waitlist when an event is full and email when a place opens up
- Check in and out by scanning the event QR code
- Contribution history, hours chart, skills gained and post-event feedback
- In-app notification bell and email reminders 24 hours before an event

**NGO administrators and project coordinators**

- Organisation profile, project and event management, publish, complete or cancel a project
- Review applications, approve or reject, manage the team and assign a coordinator
- Rotating QR code per event, live attendance list, and corrections (adjust times or mark absent)
- Verify or reject contributions, and read the feedback summary for each event
- Dashboard with counts for projects, applicants and volunteers

**System administrators**

- Approve, reject or suspend organisations
- Search every account, suspend or reactivate a user, trigger a password reset
- Read the audit log of every change made through the API

**Everywhere**

- Role based access (volunteer, NGO administrator, coordinator, system administrator)
- Emails shown in Malaysia time, while the database stays in UTC
- 71 documented API endpoints, see [backend/docs/API.md](backend/docs/API.md)

## What's new in Sprint 3

| Area | Change |
| --- | --- |
| Email | Brevo transactional email behind one mailer, with registration confirmation, waitlist promotion, reminders, event updates and a post-event thank-you |
| Notifications | In-app bell endpoints (list, unread count, mark read), with the notification table doubling as the email queue |
| Scheduler | One APScheduler job sends 24 hour reminders and thank-yous, and a restart never repeats a mail |
| QR attendance | Rotating event token, first scan is check-in and second is check-out, hours calculated automatically |
| Contributions | Created on check-out, staff can verify or reject, skills shown on the volunteer's history |
| Feedback | 1 to 5 rating and comments from attended volunteers, with a coordinator summary |
| Audit log | Every mutating request is logged (who, route, status, IP, never request bodies) |
| Hardening | The backend refuses to start in production with a default secret, an insecure cookie or localhost CORS |

Upgrading from Sprint 2 needs migration `004_sprint3_indexes.sql` on the database (indexes only, safe to run twice).

## Getting started

### Prerequisites

- Node.js 20 or newer and npm
- Python 3 (the team develops on 3.14)
- [Git](https://git-scm.com/downloads)
- A Neon PostgreSQL database with `backend/schema.sql` loaded, or just use SQLite for tests
- A Brevo account, optional, only to send real email

### Run locally

Back end (PowerShell, from `backend/`):

```powershell
..\.venv\Scripts\Activate.ps1          # the virtual environment lives in the repo root; create it with: python -m venv .venv
pip install -r requirements.txt
copy .env.example .env                  # then set DATABASE_URL and JWT_SECRET
uvicorn app.main:app --reload
```

Front end (second terminal, from `frontend/`):

```powershell
npm install
npm run dev
```

The app is at `http://localhost:3000` and the API docs at `http://localhost:8000/docs`. The front end proxies `/auth` and `/api` to the back end, so the refresh cookie stays first party.

Create the first system administrator (from `backend/`):

```powershell
python -m scripts.create_admin you@example.com "Your Name"
```

### Configuration

Copy `backend/.env.example` to `.env`. Secrets are never committed.

| Setting | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon connection string (`postgresql+psycopg://...`) |
| `JWT_SECRET` | Signs access tokens. Generate with `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `CORS_ORIGINS` / `FRONTEND_URL` | The front end origin, needed for cookies and password reset links |
| `COOKIE_SECURE` / `COOKIE_SAMESITE` | `false` / `lax` locally, `true` over HTTPS |
| `EMAIL_BACKEND` | `log` prints mail in the server console, `brevo` sends real email |
| `BREVO_API_KEY` / `MAIL_FROM_EMAIL` | Needed for `brevo`. The sender must be verified in Brevo |
| `SCHEDULER_ENABLED` | Reminders and thank-yous. Turn off when not demoing |
| `ENVIRONMENT` | `production` makes the backend refuse an unsafe configuration |

The full list, including QR and scheduler timings, is in [backend/.env.example](backend/.env.example).

## Usage

| I want to… | Do this |
| --- | --- |
| Sign up as a volunteer or an NGO administrator | Use the sign-up page. Coordinators are added by an NGO administrator, and system administrators come from `create_admin` |
| Apply to a project | Open an opportunity, choose **Apply**, then register for an event once approved |
| Check in to an event | Scan the coordinator's QR code. Scan again when you leave to check out |
| Show the QR code (coordinator) | Open the event's attendance page. The code rotates every 5 minutes |
| Fix someone's attendance | Edit their times or mark them absent on the attendance list |
| Verify hours (coordinator) | Open the project's contributions and verify or reject each one |
| Reset a password | **Forgot password** on the login page, then follow the emailed link |
| Test email locally | Keep `EMAIL_BACKEND=log` and read the link in the backend console |

## Deployment

Staging runs the front end on Vercel, the database on Neon and the back end on a team machine through Tailscale Funnel. The full command list is in [backend/README.md](backend/README.md#staging-item-30-vercel--neon--this-backend-on-your-machine-through-tailscale-funnel). The short form:

```powershell
# backend/.env: ENVIRONMENT=production, COOKIE_SECURE=true, CORS_ORIGINS and FRONTEND_URL = the Vercel URL
uvicorn app.main:app --host 127.0.0.1 --port 8000     # one process, no --reload, no --workers
tailscale funnel 8000
# Vercel -> Settings -> Environment Variables: BACKEND_URL = the https://....ts.net URL, then redeploy
python -m scripts.smoke_staging --url https://YOUR.ts.net --origin https://cos-40005-fyp-1.vercel.app --email you@example.com --password "..."
```

**Post-deploy checklist**

- [ ] Sign in works on the Vercel URL and the refresh cookie is set
- [ ] A volunteer can apply, and an NGO administrator can approve
- [ ] A registration confirmation email arrives (when Brevo is configured)
- [ ] A QR scan checks a volunteer in and out and creates a contribution
- [ ] `smoke_staging` passes for HTTPS, CORS and the cookie
- [ ] Neon has migrations 001 to 004 applied

Run exactly one back end process. The scheduler lives inside it, so extra workers would send every reminder more than once.

## Configuration and data

| Item | Location |
| --- | --- |
| Users, organisations, projects, events, registrations, attendance, feedback | Neon PostgreSQL, shared schema in `backend/schema.sql` (23 tables) |
| Refresh tokens and password reset tokens | API-owned tables from migrations 001 and 003 |
| Notifications and the email queue | `notification` table |
| Audit log | `audit_log` table, readable at `GET /audit-logs` by system administrators |
| Test data | In-memory SQLite, or a throw-away PostgreSQL via `TEST_DATABASE_URL` |

## Project structure

```text
frontend/        Next.js app (pages, components, API client in src/lib/api)
backend/app/     FastAPI app: routers, models, notifications, scheduler, mailer, audit
backend/migrations/  Plain SQL migrations 001 to 004
backend/scripts/ create_admin, export_api_docs, smoke_staging
backend/tests/   87 tests (pytest)
backend/docs/    API reference, functional test checklist, handoff notes
backend/schema.sql  Shared Neon schema (ERD v3)
```

## Tech stack

| Layer | Technology |
| --- | --- |
| Front end | Next.js, React, TypeScript, Tailwind CSS, Vercel |
| API | FastAPI, SQLAlchemy, Pydantic |
| Auth | Custom JWT (PyJWT), Argon2id passwords (pwdlib), rotating httpOnly refresh cookie |
| Database | PostgreSQL on Neon (SQLite for tests) |
| Email | Brevo transactional API |
| Scheduling | APScheduler (in-process) |
| Hosting | Vercel for the front end, Tailscale Funnel for the back end |
| Tests | pytest on SQLite and PostgreSQL |

## Documentation

- [Backend and API guide](backend/README.md)
- [API reference (71 endpoints)](backend/docs/API.md)
- [Functional test checklist](backend/docs/FUNCTIONAL_TEST_CHECKLIST.md)
- [Frontend and backend integration status](frontend/BACKEND_INTEGRATION.md)
- [Sprint 3 handoff notes](backend/docs/SPRINT3_HANDOFF.md)

## Troubleshooting

| Problem | Things to check |
| --- | --- |
| `.venv\Scripts\Activate.ps1` not found in `backend/` | The virtual environment is in the repo root, so run `..\.venv\Scripts\Activate.ps1` |
| Login works but the session is lost | `CORS_ORIGINS`, `COOKIE_SECURE` and `COOKIE_SAMESITE` must match how the browser reaches the API |
| Backend will not start in production | `JWT_SECRET` is the default or too short, `COOKIE_SECURE` is false, or CORS still lists localhost |
| No emails arrive | `EMAIL_BACKEND` is still `log`, or the Brevo sender is not verified, or the daily free send limit is reached |
| Reminders sent twice | More than one back end process is running |
| First request after a while is slow | Neon compute was asleep and is waking up |
| Cannot connect to the database | The Neon branch was deleted or expired, or `DATABASE_URL` points at the wrong branch |
| Tests fail on PostgreSQL | `TEST_DATABASE_URL` must be a throw-away database with `schema.sql` loaded, because tests truncate every table |

## Roadmap

| Feature | Status |
| --- | --- |
| Front end for the notification bell, QR scan, attendance, feedback and contributions | Planned |
| Coordinator attendance page on live data (still sample data) | Planned |
| Sprint 2 UI fixes and bug fixes | Not started |
| Live Brevo email test | Planned |
| Staging deployment with Tailscale Funnel and the smoke test | Planned |
| Certificates | Planned |
| Rate limiting on login and password reset | Planned |
| AI-assisted opportunity recommendations | Parked |
| Production deployment with Docker | Planned |

## Security and privacy

- Short-lived access tokens and a rotating httpOnly refresh cookie with reuse detection.
- Passwords are hashed with Argon2id.
- Password reset links are single use, expire after 30 minutes, and the request always answers the same whether or not the account exists.
- Role checks come from the database, not from the token alone.
- Suspending a user signs them out everywhere.
- The audit log records who did what and from where, and never stores request bodies.
- QR codes rotate every 5 minutes and scans are checked against the event window.
- No analytics or telemetry.

## Contributing

This is a university group project. Work goes on `dev-testing-backup` and reaches `main` through a pull request that a teammate reviews. Before opening one:

```powershell
cd backend
pytest -q
cd ..\frontend
npx tsc --noEmit
npm run lint
```

## Changelog

**Week 13** – Project renamed from VolunteerHub to Tandem, with a new logo, favicon and brand kit in `branding/`.

**Sprint 3 (weeks 12 to 13)** – Brevo email, notifications and reminders, QR attendance, contributions, feedback, audit log, production config check, API docs and a staging smoke test. Needs migration `004`.

**Sprint 2 (weeks 9 to 11)** – Custom JWT auth, volunteer profile and history, NGO, project and event management, applications, registrations with waitlist, admin panel, password reset. Needs migrations `001` to `003`.

**Sprint 1 (weeks 1 to 8)** – Requirements, ERD v3, Neon schema and the tech stack.

## Team

| Name | Focus |
| --- | --- |
| Vishvaaraj | Back end, API, database, email and attendance |
| Nigel | Front end for NGO and admin pages, shared items |
| Trishanth | Design in Figma and front end |

## License

This is an academic project for COS 40005 at Swinburne University of Technology. It is not licensed for commercial use. All rights remain with the project team.
