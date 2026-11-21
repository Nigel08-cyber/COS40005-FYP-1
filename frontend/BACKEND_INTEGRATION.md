# Backend integration guide

What the frontend reads from the FastAPI backend, what is still placeholder, and what the backend
still needs to add. Endpoints are listed in `backend/README.md`.

## Status at a glance

| Area | Frontend file | Status |
| --- | --- | --- |
| Log in, sign up, log out, login + role check | `src/lib/api/auth.ts`, `src/lib/useSessionGuard.ts` | ✅ Connected |
| Volunteer pages (dashboard, browse, details, my activities, profile, apply / withdraw / register / cancel) | `src/lib/api/volunteer.ts` | ✅ Connected |
| NGO organisation profile, projects list, create project, NGO dashboard | `src/lib/api/ngo.ts` | ✅ Connected — some fields marked **"Not saved yet"**, AI blocks show **"Coming soon"** (section 4) |
| Project details, edit project / continue draft, publish / complete / cancel, assign coordinator | `src/lib/api/projects.ts`, `ngo.ts` | ✅ Connected |
| Application review (approve / reject + search & filter), Team (add / remove coordinators) | `src/lib/api/projects.ts` | ✅ Connected — volunteers show as **"Volunteer #ID"** until the backend sends names (section 4) |
| Coordinator My projects, project details, Applications | `src/lib/api/projects.ts` | ✅ Connected |
| Admin panel: Organisations (list, approve / reject / suspend, stats), Users (every account, suspend / reactivate, send password reset), Audit log | `src/lib/api/admin.ts` | ✅ Connected — invite user, change role and last login show **"Coming soon"** (section 4) |
| Password reset (forgot password → email link → new password, expired-link screen) | `src/lib/api/auth.ts`, `components/auth/PasswordReset.tsx` | ✅ Connected — with `EMAIL_BACKEND=log` the link is printed in the backend terminal instead of emailed |
| QR check-in / check-out, coordinator attendance | `src/lib/api/attendance.ts` | ✅ Connected — the camera needs HTTPS (or localhost) |
| Volunteer feedback, coordinator feedback results | `src/lib/api/feedback.ts` | ✅ Connected |
| Volunteer hours review on project details | `src/lib/api/contributions.ts` | ✅ Connected |

Search the code for `NotSavedHint`, `ComingSoonCard`, `TODO(backend)` and `TODO(frontend)` to find every
open item.

## How the code is organised

```
src/
├─ lib/
│  ├─ types.ts           ← data shapes for the volunteer pages
│  ├─ staffTypes.ts      ← data shapes for the NGO Administrator / Project Coordinator pages
│  ├─ ngoOptions.ts      ← fixed pick-lists for the NGO forms (categories, states, times...)
│  ├─ useSessionGuard.ts ← login + role check used by every protected page group
│  ├─ api/               ← the ONLY place pages get data from
│  │  ├─ http.ts         ← api() helper: calls /api/* with the access token, UTC ↔ Malaysia time
│  │  ├─ auth.ts         ← log in / sign up / log out / session (section 1)
│  │  ├─ volunteer.ts    ← volunteer pages
│  │  ├─ ngo.ts          ← NGO Administrator pages: profile, projects list, create / edit, dashboard (section 3)
│  │  ├─ projects.ts     ← shared by NGO admins and coordinators: project details, applications, team (section 3)
│  │  ├─ admin.ts        ← System Administrator pages (admin panel, audit log, section 3)
│  │  ├─ attendance.ts   ← QR check-in / check-out and the coordinator's attendance board
│  │  ├─ feedback.ts     ← volunteer feedback and coordinator results
│  │  └─ contributions.ts ← staff review of volunteer hours
├─ app/                  ← pages (routes): volunteer pages, /ngo/..., /coordinator/...
└─ components/           ← UI pieces (volunteer/, ngo/, coordinator/, staff/ for the staff page frame)
```

Pages that need the signed-in user load their data **in the browser** (the access token only lives in
memory): the page file renders a client "view" that uses `<DataView load={...}>`, which shows a skeleton
while loading and an error with "Try again" if a call fails.

---

## 1. Authentication (`src/lib/api/auth.ts`)

| Function | Backend call |
| --- | --- |
| `signUp(input)` | `POST /auth/register` |
| `logIn(input)` | `POST /auth/login` |
| `logOut()` | `POST /auth/logout` |
| `restoreSession()` | `POST /auth/refresh` when the access token is missing or about to expire |
| `getAccessToken()` | used by `api()` in `http.ts` for every protected call |
| `requestPasswordReset(email)` | `POST /auth/password-reset` ("Send reset link", "Resend email", admin "Send password reset") |
| `checkResetToken(token)` | `POST /auth/password-reset/check` when `/reset-password?token=...` opens (400 → expired screen) |
| `confirmPasswordReset(token, pw)` | `POST /auth/password-reset/confirm` ("Reset password"; 400 → expired screen) |

- **Password reset links.** The backend emails `FRONTEND_URL/reset-password?token=...`. The page reads the token
  once, removes it from the address bar, checks it, then shows the form or the expired screen. On Vercel the backend's
  `FRONTEND_URL` must be the Vercel site address. Until Brevo (item 26) is connected, `EMAIL_BACKEND=log` prints the
  link in the backend terminal.

- **Proxy, not direct calls.** The browser calls `/auth/*` and `/api/*` on the frontend's own domain;
  `next.config.ts` forwards them to `BACKEND_URL`. The refresh-token cookie is therefore first-party
  (works in Safari, no CORS needed).
- **Tokens.** The access token lives in memory only; the refresh token is the backend's `httpOnly`
  cookie (`Path=/auth`).
- **Roles.** The login response's `role` (the account's highest role) decides the landing page
  (`homeFor` in `auth.ts`) and which page groups the user may open (`useSessionGuard`): volunteer pages →
  `volunteer`; `/ngo` → `ngo_admin`, `system_admin`; `/coordinator` → `project_coordinator`, `ngo_admin`,
  `system_admin`; `/admin` → `system_admin` only. The backend still checks roles on every API call. A coordinator
  lands on `/coordinator/projects`, a system admin on `/admin/organisations`.

## 2. Volunteer pages (`src/lib/api/volunteer.ts`)

Connected by the backend team (see the comments in that file). Gaps found while testing locally:

- Profile → **"How often can you volunteer?"** and **"Preferred time of day"** are not stored by
  `PUT /me/profile`, so they are empty again after saving.
- Profile → **State**: when the saved state is empty the dropdown shows the first option ("Selangor")
  although nothing is selected, so saving keeps it empty (frontend: add a "Select a state" placeholder).
- Placeholder buttons (show a notice only): **Download summary**, certificate **Download**, certificate
  **Generate** (`TODO(backend)` in `components/volunteer/Dashboard.tsx`).
- `/check-in` scans the coordinator's QR (`POST /attendance/scan`): the first scan checks in, the second checks out.
  The QR holds `FRONTEND_URL/check-in?token=...`, so the backend's `FRONTEND_URL` must be the deployed site. The token
  is long and random, so there is no manual code entry. A signed-out volunteer returns to the link after logging in.
- `/feedback/[eventId]` is the page linked from the thank-you email. Only volunteers who checked in can submit, once.

## 3. NGO Administrator pages (`src/lib/api/ngo.ts`)

| Page (route) | Wireframe | Backend calls |
| --- | --- | --- |
| `/ngo/profile` | 10 · Organisation profile | `GET /ngos?mine=true`; first save `POST /ngos` (starts **pending** until a platform admin approves it), later saves `PATCH /ngos/{id}` |
| `/ngo/projects` | Projects list | `GET /projects` (filtered to the admin's NGO), `GET /ngos/{id}/members` (coordinator names), `GET /projects/{id}/events` (next session date and registered count) |
| `/ngo/projects/new` | 12 · Create a project | `GET /skills`, `GET /ngos/{id}/members`; **Save draft** → `POST /projects` (status `draft`) + one draft event per date; **Publish** → `POST /projects` (status `active`) + one active event per date (`POST /projects/{id}/events`); both also `PUT /projects/{id}/skills` |
| `/ngo/dashboard` | 13 · NGO dashboard | `GET /ngos/{id}/dashboard` + the projects list for "Upcoming projects" |
| `/ngo/projects/[id]` | Project details (no wireframe) | `GET /projects/{id}`, `/events`, `/skills`, `/applications`, `GET /ngos/{id}/members`; **Mark as completed** / **Cancel project** → `PATCH /projects/{id}/status` (cancel also sets each open session to cancelled with `PATCH /events/{id}`); coordinator dropdown → `PUT /projects/{id}/coordinator`; **Approve / Reject** → `PATCH /applications/{id}` (reject reason → `coordinator_note`) |
| `/ngo/projects/[id]/edit` | 12 (edit mode) | Same form as Create. Saves with `PATCH /projects/{id}`, `PUT /projects/{id}/skills`, `PUT /projects/{id}/coordinator` if changed; saved dates are updated with `PATCH /events/{id}`, new dates use `POST /projects/{id}/events`, and removed dates are cancelled (a date with registered or waitlisted volunteers cannot be removed); **Publish** on a draft makes its events active + `PATCH /projects/{id}/status` (active) |
| `/ngo/volunteers` | Volunteers (no wireframe) | Applications to every published project of the NGO (`GET /projects/{id}/applications` per project), with search, status tabs and a project filter |
| `/ngo/team` | Team (no wireframe) | `GET / POST /ngos/{id}/members` (adds an existing account by email as coordinator or admin), `DELETE /ngos/{id}/members/{user_id}` |

**Project Coordinator pages** (`src/lib/api/projects.ts`, same components as the NGO pages, without edit / coordinator change):

| Page (route) | Backend calls |
| --- | --- |
| `/coordinator/projects` | `GET /me/coordinated-projects` (published ones) + events |
| `/coordinator/projects/[id]` | Same as `/ngo/projects/[id]`; review applications, complete or cancel |
| `/coordinator/applications` | Applications to every coordinated project, with search and filters |
| `/coordinator/attendance` | `GET /events/{id}/qr` (re-read every 30 s), `POST /events/{id}/qr` (Refresh now), `GET /events/{id}/attendance` (every 10 s), `PUT /events/{id}/attendance/{user_id}` (manual check-in, correct times, mark absent), `PATCH /events/{id}` `completed` (Close event) |
| `/coordinator/feedback` | `GET /events/{id}/feedback` for the chosen session: average, star counts and comments |

Project details (NGO and coordinator) also list volunteer hours: `GET /projects/{id}/contributions`, **Verify** / **Reject** → `PATCH /contributions/{id}`.

Behaviour worth knowing:

- An admin without an organisation sees "Create your organisation profile first" on Dashboard, Projects
  and Create project.
- While the organisation is **pending** (or suspended) a banner explains it, and "Create project" /
  "Publish" are disabled (the backend would answer 409).
- **Registration no.** is assigned by the frontend as `PPM-001-01-00001`, `00002`... when the field is clicked. Pending
  organisations are hidden from `GET /ngos`, so on a 409 the save moves to the next number; the database UNIQUE rule
  prevents duplicates. It is read-only afterwards (not in `NgoUpdate`).
- **Areas of activity** and **service areas** are saved as comma-separated text in `focus_areas` /
  `service_areas`.
- **Minimum experience** maps to `min_experience_years` (none / 1 / 2 / 3 years); **preferred day** to
  `preferred_day` (1 = Monday).
- Dashboard **"Volunteer requirements"** shows *approved* volunteers vs required (what
  `requirement_fill` returns); the projects table shows *registered* volunteers of the next session.
- A project is **"Open"** while at least 60% of spots are filled, otherwise **"Needs volunteers"**
  (`OPEN_FILL_RATIO` in `components/ngo/ProjectTables.tsx`).

**System Administrator pages — wireframe 16 · Admin panel** (`src/lib/api/admin.ts`):

| Page (route) | Backend calls |
| --- | --- |
| `/admin/organisations` | `GET /ngos` (every organisation for a platform admin), `GET /projects` (project counts, active projects), `GET /ngos/{id}/members` (NGO administrator), `GET /ngos/{id}/dashboard` (volunteers, hours this month); **Approve** → `PATCH /ngos/{id}/status` `active`, **Reject** / **Suspend** → `suspended`, **Reactivate** → `active` |
| `/admin/users` | `GET /users?limit=500` (every account with `roles[]`, `organisations[]`, `account_status`, `created_at`); search and filters run in the browser; **Suspend user** / **Reactivate user** → `PATCH /users/{id}/status` (not offered on your own account); **Send password reset** → `POST /auth/password-reset` with that user's email; **Export CSV** builds the file in the browser |
| `/admin/audit-log` | `GET /audit-logs` (25 per page, filter by activity and user), `GET /users` for names. Read-only |

## 4. What the backend still needs

Fields and blocks below are visible on the pages but marked **"Not saved yet"** or **"Coming soon"**.

**Organisation profile (`NgoIn` / `NgoUpdate`)**
- Organisation type
- Logo (needs an upload endpoint)
- Contact person
- Standing volunteer requirements: skills + typical volunteers per project

**Projects (`ProjectIn`)**
- Language requirement
- Additional requirements (free text)
- Repeat weekly (recurring sessions)
- Application settings: "must apply and be approved", "generate AI recommendations"
- `updated_at` (drafts show the creation date instead of "last edited")
- AI **Likely matches** for a draft project

**Applications (`ApplicationOut`) — needed for the review screens**
- Add the volunteer's `full_name`, `email`, `skills` (list of skill names) and `applied_at` to
  `GET /projects/{id}/applications`. Today only `user_id` is sent and there is no other endpoint an NGO can
  use to look a volunteer up, so the screens show "Volunteer #12". The frontend already reads these four
  fields (`ApplicationApi` in `src/lib/api/projects.ts`) — no frontend change needed once they exist.
- A volunteer search / directory endpoint (search by name, skill, availability) for a full "Volunteers"
  list; today the search only covers people who applied.
- A per-session roster (`GET /events/{id}/registrations`, with names) — also needed for attendance.

**Multi-date projects**
- `GET /opportunities` and `GET /opportunities/{id}` return only the **next** active event. The volunteer detail
  page therefore reads every date from `GET /projects/{id}/events` and `GET /me/registrations`, and registers or
  cancels per date. No backend change is required. Returning all events in `/opportunities` would let the browse
  list show every date without an extra request per project.

**NGO dashboard (`NgoDashboardOut`)**
- Active / new / returning volunteer counts
- AI recommendation sets ready
- AI analytics: participation trend (volunteers per week), peak participation by weekday, frequently
  requested skills, AI insights
- Export report

**Admin panel (wireframe 16)**
- Last login time in `GET /users` (the details panel shows "Not available yet").
- Invite a user, and change a user's role from the panel (`PATCH /auth/users/{id}/system-role` only
  promotes / demotes platform admins).
- `GET /users` returns at most 500 accounts per call; add paging in the UI if the platform grows past that.
- Overview page: no wireframe yet (greyed out as "Soon").

**Other**
- Real email sending for password reset (Brevo, item 26). Until then `EMAIL_BACKEND=log` prints the link in
  the backend terminal.
- Email verification.
- Rate limiting on `/auth/login`.

## 5. Frontend items still open

- Project details, Volunteers and Team pages have no wireframe yet; they follow the style of the other
  NGO pages. Update them when the wireframes exist.
- Nav links still without a page are greyed out as "Soon": AI recommendations, Reports, coordinator
  Dashboard and admin Overview. The notification bell, certificate page (16a) and AI recommendation review
  (16b) are not started.
- Admin "Change role" and "Invite user" only show a notice until the backend has those APIs.

## 6. Running and deploying

**Locally**
1. Start the backend on port 8000 (see `backend/README.md`).
2. `npm run dev` in `frontend/`. `BACKEND_URL` defaults to `http://localhost:8000`
   (override in `frontend/.env.local`, see `frontend/.env.example`).
3. A new NGO starts as **pending**: a platform admin must set it to active
   (`PATCH /ngos/{id}/status`) before projects can be created.

**Vercel**
- Set `BACKEND_URL` (Settings → Environment Variables) to the public HTTPS backend URL and redeploy.
  Without it, every login and data call fails with "Can't reach the server".
- Backend `.env`: a long random `JWT_SECRET` and `COOKIE_SECURE=true`. Because of the proxy,
  `COOKIE_SAMESITE=lax` is enough and CORS is not needed for these calls.

## 7. Checklist

- [x] Log in / sign up / log out / login check use the backend
- [x] Volunteer pages use the backend
- [x] NGO pages use the backend (except the fields in section 4)
- [x] Project details, application review, team and coordinator pages use the backend
- [ ] Backend sends volunteer name, email, skills and applied_at with applications (section 4)
- [ ] Backend adds the fields in section 4, frontend removes the matching `NotSavedHint` / `ComingSoonCard`
- [x] Attendance / QR API connected and the sample data deleted
- [ ] `BACKEND_URL` set on Vercel, backend `JWT_SECRET` set
- [ ] Searching for `Fake`, `TODO(backend)` and `TODO(frontend)` returns nothing
- [x] `npm run lint` and `npm run build` pass
