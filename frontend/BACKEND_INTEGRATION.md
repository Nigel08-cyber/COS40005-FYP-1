# Backend integration guide (replacing the fake data)

**Log in, sign up, log out and the login check are connected to the real backend** (section 2).
Everything else (page data and actions) is still faked so the pages can be built and tested.
This file lists everything that has to change when the rest of the real API / database is connected.

## TL;DR

1. Replace the body of each function in **`src/lib/api/`** (`volunteer.ts`, `ngo.ts`, `coordinator.ts`)
   with a real request (`auth.ts` is already real). Send `Authorization: Bearer <token>` using
   `getAccessToken()` from `auth.ts`, and call the backend through `/api/...` (see section 2).
   Pages and components only call these functions, so they do not need to change.
2. Do the items in [Actions that only change the browser](#3-actions-that-only-change-the-browser) and
   [Buttons that only show a notice](#4-buttons-that-only-show-a-notice).
3. Delete the **`src/lib/fake/`** folder.
4. Search the project for `Fake` and `TODO(backend)`. When both searches return nothing, you are done.

## How the code is organised

```
src/
├─ lib/
│  ├─ types.ts          ← data shapes for the volunteer pages (the "contract" for the API)
│  ├─ staffTypes.ts     ← data shapes for the NGO Administrator / Project Coordinator pages
│  ├─ useSessionGuard.ts ← login + role check used by every protected page group
│  ├─ api/              ← the ONLY place pages get data from  ← replace these bodies
│  │  ├─ auth.ts        ← REAL: log in / sign up / log out / session (section 2)
│  │  ├─ volunteer.ts   ← everything for the volunteer pages
│  │  ├─ ngo.ts         ← NGO Administrator pages (section 6)
│  │  └─ coordinator.ts ← Project Coordinator pages (section 6)
│  └─ fake/             ← placeholder data and behaviour      ← delete at the end
│     ├─ opportunitiesFake.ts  (12 sample opportunities)
│     ├─ volunteerFake.ts      (volunteer, applications, stats, profile...)
│     ├─ ngoFake.ts            (NGO admin, organisation profile, project form, NGO dashboard)
│     └─ coordinatorFake.ts    (coordinator, attendance event, roster, QR token)
├─ app/                 ← pages (routes): volunteer pages, /ngo/..., /coordinator/...
└─ components/          ← UI pieces (ngo/, coordinator/, staff/ for the staff pages)
```

Naming rule: everything fake ends in `Fake` (`opportunitiesFake`, `saveProjectFake`...) and IDs contain
`fake` (`opp-fake-001`).

---

## 1. Data the pages read (`src/lib/api/volunteer.ts`)

The return types are in `src/lib/types.ts`; make the API return the same shape (or map it in the function).
Endpoints are only suggestions.

| Function | Returns (type) | Used by page | Fake source | Suggested endpoint |
| --- | --- | --- | --- | --- |
| `getCurrentVolunteer()` | `Volunteer` | volunteer pages (name/email are replaced by the real account) | `volunteerFake` | `GET /auth/me` (+ volunteer details) |
| `getOpportunities()` | `Opportunity[]` | Browse, Details, My activities, Dashboard | `opportunitiesFake` | `GET /opportunities` |
| `getOpportunity(id)` | `Opportunity \| null` | Details `/opportunities/[id]` | `opportunitiesFake` | `GET /opportunities/:id` |
| `getMyApplications()` | `Application[]` | all volunteer pages (status badges/buttons) | `applicationsFake` | `GET /me/applications` |
| `getVolunteerStats()` | `VolunteerStats` | Dashboard (4 stat tiles) | `volunteerStatsFake` | `GET /me/stats` |
| `getContributionHistory()` | `ContributionRecord[]` | Dashboard, Profile | `contributionHistoryFake` | `GET /me/contributions` |
| `getMonthlyHours()` | `MonthlyHours[]` | Dashboard (bar chart) | `monthlyHoursFake` | `GET /me/hours?by=month` |
| `getSkillsContributed()` | `string[]` | Dashboard | `skillsContributedFake` | `GET /me/skills-contributed` |
| `getCertificates()` | `Certificate[]` | Dashboard | `certificatesFake` | `GET /me/certificates` |
| `getPastActivities()` | `PastActivity[]` | My activities → Past tab | `pastActivitiesFake` | `GET /me/activities?past=true` |
| `getVolunteerProfile()` | `VolunteerProfile` | Profile | `volunteerProfileFake` | `GET /me/profile` |
| `getProfileOptions()` | `ProfileOptions` | Profile (chip lists, dropdowns) | `profileOptionsFake` | `GET /profile-options` (or keep as constants) |
| `saveVolunteerProfile(p)` | `{ ok }` | Profile → Save profile | `saveVolunteerProfileFake` (stores nothing) | `PUT /me/profile` |
| `getToday()` | `"YYYY-MM-DD"` | Browse (date filter), My activities, Dashboard (check-in window) | `todayFake` = `2026-10-16` | no API: use the real current date |

> `getToday()` is fixed to 16 Oct 2026 only so the October dates in the designs stay "upcoming".
> Switch it to the real date (Malaysia time) once real data is used.

## 2. Authentication (`src/lib/api/auth.ts`) — ✅ connected to the backend

Uses the FastAPI endpoints in `backend/app/routers/auth.py`.

| Function | Used by | Backend call |
| --- | --- | --- |
| `signUp(input)` | `components/auth/AuthCard.tsx` (Sign up tab) | `POST /auth/register` |
| `logIn(input)` | `components/auth/AuthCard.tsx` (Log in tab) | `POST /auth/login` |
| `logOut()` | `UserMenu.tsx` (volunteer), `StaffShell.tsx` (NGO / coordinator) | `POST /auth/logout` |
| `restoreSession()` | `lib/useSessionGuard.ts` (every protected page group) | `POST /auth/refresh` when the access token is missing or about to expire |
| `getAccessToken()` | not used yet — use it for every protected API call | — |

**How it is wired**

- **Proxy, not direct calls.** The browser calls `/auth/*` and `/api/*` on the frontend's own domain;
  `next.config.ts` forwards them to `BACKEND_URL`. So the refresh-token cookie is first-party (works in
  Safari, no CORS needed). New endpoints go through `/api/...`, e.g. `fetch("/api/projects")` reaches
  `BACKEND_URL/projects`.
- **Tokens.** The access token (15 min) lives in memory only. The refresh token is the backend's
  `httpOnly` cookie (`Path=/auth`), which JavaScript cannot read. On reload, `restoreSession()` calls
  `/auth/refresh` to get a new access token.
- **Login check + roles** (`lib/useSessionGuard.ts`): signed-out visitors go to `/login`; a signed-in
  user opening another role's pages is sent to their own home. Volunteer pages allow `volunteer`;
  `/ngo` allows `ngo_admin`, `system_admin`; `/coordinator` allows `project_coordinator`, `ngo_admin`,
  `system_admin`. The check runs in the browser; the backend must still check roles on every API call
  (it does, with `require_roles`).
- **Where people land** (`homeFor` / `firstPageFor` in `auth.ts`): sign up → `/profile` (volunteer) or
  `/ngo/profile` (NGO admin). Log in → by the account's role: `/dashboard`, `/ngo/dashboard` or
  `/coordinator/attendance`.
- **Validation** (`AuthCard.tsx`): checked in the browser first (name, email format, password 8–128
  characters like the backend, passwords match, terms), then the backend's errors are shown (email
  already used, wrong password, server unreachable).
- **Real name** in the nav bars and the volunteer "Welcome back" comes from the account. The rest of the
  page data is still fake (e.g. Aisha's stats and profile).

**Running it locally**

1. Start the backend on port 8000 (see `backend/`), e.g. `uvicorn app.main:app --port 8000`.
2. Start the frontend with `npm run dev`. `BACKEND_URL` defaults to `http://localhost:8000`
   (override in `frontend/.env.local`, see `frontend/.env.example`).

**Deploying (Vercel)**

- Set `BACKEND_URL` in Vercel (Settings → Environment Variables) to the public HTTPS backend URL, then
  redeploy. If it is missing, login fails with "Can't reach the server".
- Backend `.env`: set a long random `JWT_SECRET` (the default `dev-only-change-me` must never be used in
  production) and `COOKIE_SECURE=true`. Because of the proxy, `COOKIE_SAMESITE=lax` is enough and CORS
  is not needed for these calls.

**Still to do (backend team)**

- No rate limiting on `/auth/login` yet (brute-force protection).
- No password reset or email verification ("Forgot password?" only shows a notice).

## 3. Actions that only change the browser

These update state in memory, so a page refresh undoes them. Search `TODO(backend)`.

| Where | Action | Needs |
| --- | --- | --- |
| `components/volunteer/VolunteerProvider.tsx` → `act()` | Apply, Withdraw, Register, Cancel participation, Join / leave waitlist, Accept recommendation | One API call per action; update the status after it succeeds |
| `components/volunteer/Dashboard.tsx` → `CertificatesCard` | Generate certificate | API that generates the PDF + verification code |

The spots-filled counts are calculated as `volunteersRegisteredOthers` + 1 if this volunteer is
registered. If the API returns the total count instead, change `registeredCount()` in
`VolunteerProvider.tsx`.

## 4. Buttons that only show a notice

Search the message text to find each one.

| File | Button | Notice text now |
| --- | --- | --- |
| `components/volunteer/Dashboard.tsx` | Check in (QR) | "QR check-in will be added in a later sprint." |
| `components/volunteer/MyActivities.tsx` | Scan to check in | "QR check-in will be added in a later sprint." |
| `components/volunteer/Dashboard.tsx` | Download summary | "Summary download will be available once data is connected." |
| `components/volunteer/Dashboard.tsx` | Certificate → Download | "PDF download will be available once data is connected." |
| `components/auth/AuthCard.tsx` | Forgot password? | "Password reset is not available yet. Please contact your NGO administrator." |

Also: **Profile photo** (`components/volunteer/ProfileForm.tsx` → `PhotoField`) only keeps the file
name. It needs a real upload endpoint and should show the uploaded image.

"Add to calendar (.ics)" works without a backend (the file is created in the browser), so it does not
need changing.

## 5. Things to watch out for

- **Next.js 16 with Cache Components is enabled.** The fake functions return data instantly. A real
  `fetch` is "dynamic", so wrap the part of the page that uses it in `<Suspense fallback={...}>` or
  cache it with `"use cache"`, otherwise `next dev` shows an error. See
  `node_modules/next/dist/docs/01-app/01-getting-started/06-fetching-data.md` and `08-caching.md`.
- **The details page** (`app/(volunteer)/opportunities/[id]/page.tsx`) uses `generateStaticParams()`
  from `getOpportunities()`. With many real opportunities you may want to remove it and rely on
  the `<Suspense>` skeleton that is already there.
- **Dates** are stored as Malaysia local time strings, e.g. `"2026-10-17T09:00"`, and formatted in
  `src/lib/format.ts`. If the API sends ISO/UTC timestamps, convert them in the API function.
- **Who is "the volunteer"**: the `/me/...` endpoints assume the backend knows the current user
  from the session, so the frontend does not pass a user id.

## 6. NGO Administrator & Project Coordinator pages

Added for wireframes 10, 12, 13 and 15a. They use their own page frame (`components/staff/StaffShell.tsx`:
top nav, sidebar, user menu with Log out, toasts, real login + role check). Nav links without a wireframe yet
(Volunteers, AI recommendations, Reports, Applications, Feedback...) are greyed out as "Soon".

| Page (route) | Wireframe |
| --- | --- |
| `/ngo/profile` | 10 · Create your organisation profile |
| `/ngo/projects` | Projects list (no wireframe): the organisation's projects, "+ Create new project", drafts |
| `/ngo/projects/new` | 12 · Create a project (opened from "+ Create new project") |
| `/ngo/dashboard` | 13 · NGO dashboard (+ AI analytics) |
| `/coordinator/attendance` | 15a · Coordinator: event QR & live attendance |

`/ngo` redirects to `/ngo/dashboard` and `/coordinator` to `/coordinator/attendance`.

### 6.1 Data the pages read (`src/lib/api/ngo.ts`, `src/lib/api/coordinator.ts`)

Return types are in `src/lib/staffTypes.ts`. Endpoints are only suggestions.

| Function | Returns (type) | Used by page | Fake source | Suggested endpoint |
| --- | --- | --- | --- | --- |
| `getCurrentNgoAdmin()` | `StaffUser` | all `/ngo` pages (nav bar, user menu) | `ngoAdminFake` | `GET /auth/me` + organisation |
| `getOrgProfile()` | `OrgProfile` | `/ngo/profile` | `orgProfileFake` | `GET /organisations/me` |
| `getOrgProfileOptions()` | `OrgProfileOptions` | `/ngo/profile` (types, activity chips, states, skills) | `orgProfileOptionsFake` | `GET /organisation-options` (or constants) |
| `saveOrgProfile(p, mode)` | `{ ok }` | `/ngo/profile` → Save as draft / Save & create first project | `saveOrgProfileFake` (stores nothing) | `PUT /organisations/me` |
| `getProjectFormOptions()` | `ProjectFormOptions` | `/ngo/projects/new` (categories, **coordinators**, areas, skills, times) | `projectFormOptionsFake` | `GET /project-options` + `GET /organisations/me/coordinators` |
| `getNewProjectDraft()` | `ProjectDraft` | `/ngo/projects/new` (starting values) | `projectDraftFake` | none: start from an empty draft, or `GET /projects/drafts/:id` |
| `getLikelyMatches()` | `LikelyMatches` | `/ngo/projects/new` → Likely matches | `likelyMatchesFake` | `POST /projects/preview-matches` (AI) |
| `saveProject(p, mode)` | `{ ok, id }` | `/ngo/projects/new` → Save draft / Publish project | `saveProjectFake` (stores nothing) | `POST /projects` (backend already has this, with fewer fields) |
| `getNgoDashboard()` | `NgoDashboardData` | `/ngo/dashboard` (all tiles, charts, insights, table) | `ngoDashboardFake` | `GET /organisations/me/dashboard` |
| `getMyProjects()` | `ProjectListItem[]` | `/ngo/projects` → Your projects (All / Upcoming / Completed) | `myProjectsFake` | `GET /organisations/me/projects` (backend has `GET /projects`, without coordinator / registered count) |
| `getProjectDrafts()` | `ProjectDraftItem[]` | `/ngo/projects` → Drafts | `projectDraftsFake` | `GET /organisations/me/projects?status=draft` |
| `getCurrentCoordinator()` | `StaffUser` | all `/coordinator` pages | `coordinatorFake` | `GET /auth/me` |
| `getAttendanceEvent()` | `AttendanceEvent` | `/coordinator/attendance` | `attendanceEventFake` | `GET /events/:id` |
| `getAttendanceRoster()` | `AttendanceRecord[]` | `/coordinator/attendance` → Live attendance | `attendanceRosterFake` | `GET /events/:id/attendance` (poll or websocket for "live") |
| `getQrToken(mode)` | `string` | `/coordinator/attendance` → QR code, every 60 s | `nextQrTokenFake` (random text) | `POST /events/:id/qr-token?mode=check_in` (signed, with expiry) |

### 6.2 Actions that only change the browser (search `TODO(backend)`)

| Where | Action | Needs |
| --- | --- | --- |
| `components/coordinator/AttendanceBoard.tsx` → `manualCheckIn` | Manual check-in | API call that records who checked the volunteer in |
| `components/coordinator/AttendanceBoard.tsx` → `closeEvent` | Close event | API call that locks attendance |

### 6.3 Buttons that only show a notice

| File | Button | Notice text now |
| --- | --- | --- |
| `components/ngo/NgoDashboard.tsx` | Export report | "Export report will be available once data is connected." |
| `components/ngo/ProjectTables.tsx` → `ProjectTable` | Click a project row (`/ngo/projects` and dashboard "Upcoming projects") | "Details for “…” will open here in a later sprint." |
| `components/ngo/ProjectTables.tsx` → `DraftTable` | Click a draft row | "Editing the draft “…” will be available in a later sprint." |
| `components/ngo/NgoDashboard.tsx` | View volunteers with matching skills → | "Volunteer matching by skill will be available once data is connected." |
| `components/ngo/NgoDashboard.tsx` | View underlying data → (AI insights) | "The underlying data will be available once data is connected." |

### 6.4 Things that work without a backend (no change needed)

- **Download attendance** builds a CSV in the browser from the roster.
- **Full screen** shows the QR code full screen.

### 6.5 Other things to replace

- **QR code image**: `components/coordinator/FakeQr.tsx` only draws a QR-looking pattern; it cannot be
  scanned. Replace it with a QR library (for example `qrcode`) that encodes the real token.
- **Logo / profile photo upload** (`components/staff/FormParts.tsx` → `FileField`) only keeps the file name.
- **No validation** on the organisation and project forms (required fields marked * are not enforced yet);
  show the backend's errors when it rejects a save.
- **Open / Needs volunteers / Completed** in the project tables is decided in the frontend: a project is
  "Open" while at least 60% of spots are filled (`OPEN_FILL_RATIO` in `components/ngo/ProjectTables.tsx`).
  Move this rule to the backend if it should be the same everywhere.
- **Project and draft rows are clickable** (hover, press animation, Enter/Space) but only show a notice.
  Search `TODO(frontend)` in `ProjectTables.tsx`: project rows should open `/ngo/projects/[id]` once the
  project details page is designed, and draft rows should reopen `/ngo/projects/new` with that draft.
- **Login, landing pages and role checks** are real now — see section 2.

## 7. Final checklist

- [x] Log in / sign up / log out / login check use the real backend (`auth.ts`)
- [ ] `BACKEND_URL` set on Vercel, backend `JWT_SECRET` set
- [ ] Every function in `src/lib/api/` calls the real backend
- [ ] Section 3 actions call the API
- [ ] Section 4 buttons do their real job (or stay as notices until that feature is built)
- [ ] `getToday()` uses the real date
- [ ] `src/lib/fake/` deleted
- [ ] Searching for `Fake` returns nothing
- [ ] Searching for `TODO(backend)` returns nothing
- [ ] `npm run lint` and `npm run build` pass
