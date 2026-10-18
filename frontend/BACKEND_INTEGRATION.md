# Backend integration guide (replacing the fake data)

The frontend currently runs **without a backend**. Every piece of data, and every action that should
talk to a server, is faked so the pages can be built and tested. This file lists everything that has to
change when the real API / database is connected.

## TL;DR

1. Replace the body of each function in **`src/lib/api/`** (`auth.ts`, `volunteer.ts`) with a real request.
   Pages and components only call these functions, so they do not need to change.
2. Do the items in [Actions that only change the browser](#3-actions-that-only-change-the-browser) and
   [Buttons that only show a notice](#4-buttons-that-only-show-a-notice).
3. Delete the **`src/lib/fake/`** folder.
4. Search the project for `Fake` and `TODO(backend)`. When both searches return nothing, you are done.

## How the code is organised

```
src/
├─ lib/
│  ├─ types.ts          ← data shapes the UI expects (the "contract" for the API)
│  ├─ api/              ← the ONLY place pages get data from  ← replace these bodies
│  │  ├─ auth.ts        ← log in / sign up / log out / session check
│  │  └─ volunteer.ts   ← everything for the volunteer pages
│  └─ fake/             ← placeholder data and behaviour      ← delete at the end
│     ├─ authFake.ts           (accepts any login)
│     ├─ opportunitiesFake.ts  (12 sample opportunities)
│     └─ volunteerFake.ts      (volunteer, applications, stats, profile...)
├─ app/                 ← pages (routes)
└─ components/          ← UI pieces
```

Naming rule: everything fake ends in `Fake` (`opportunitiesFake`, `signInFake`...) and IDs contain
`fake` (`opp-fake-001`).

---

## 1. Data the pages read (`src/lib/api/volunteer.ts`)

The return types are in `src/lib/types.ts`; make the API return the same shape (or map it in the function).
Endpoints are only suggestions.

| Function | Returns (type) | Used by page | Fake source | Suggested endpoint |
| --- | --- | --- | --- | --- |
| `getCurrentVolunteer()` | `Volunteer` | nav bar (all volunteer pages), Dashboard | `volunteerFake` | `GET /me` |
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

## 2. Authentication (`src/lib/api/auth.ts`)

| Function | Used by | What the fake does now | What it should do |
| --- | --- | --- | --- |
| `signUp(input)` | `components/auth/AuthCard.tsx` (Sign up tab) | Accepts **anything**, saves nothing | Create the account; return an error to show if it fails |
| `logIn(input)` | `components/auth/AuthCard.tsx` (Log in tab) | Accepts **anything** | Check the credentials; return an error to show if they are wrong |
| `logOut()` | `components/volunteer/UserMenu.tsx` | Removes a flag from `localStorage` | End the real session |
| `isLoggedIn()` | `components/volunteer/VolunteerProvider.tsx` | Checks the `localStorage` flag | Check the real session (ideally on the server, before the page renders) |

Also update:

- **`AuthCard.tsx`** has **no validation** on purpose (anything logs in). Add field errors when the
  backend returns them (email format, password rules, passwords match, terms accepted).
- **Logging in as NGO Administrator** only shows a notice, because the NGO pages are not built yet.
- **Redirect after login**: sign up → `/profile`, log in → `/dashboard` (in `AuthCard.tsx`).

## 3. Actions that only change the browser

These update state in memory, so a page refresh undoes them. Search `TODO(backend)`.

| Where | Action | Needs |
| --- | --- | --- |
| `components/volunteer/VolunteerProvider.tsx` → `act()` | Apply, Withdraw, Register, Cancel participation, Join / leave waitlist, Accept recommendation | One API call per action; update the status after it succeeds |
| `components/volunteer/VolunteerProvider.tsx` → `useEffect` | Redirect to `/login` when signed out | Real session check (see section 2) |
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
| `components/auth/AuthCard.tsx` | Forgot password? | "Password reset will be available once accounts are connected." |

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

## 6. Final checklist

- [ ] Every function in `src/lib/api/` calls the real backend
- [ ] Section 3 actions call the API
- [ ] Section 4 buttons do their real job (or stay as notices until that feature is built)
- [ ] `getToday()` uses the real date
- [ ] `src/lib/fake/` deleted
- [ ] Searching for `Fake` returns nothing
- [ ] Searching for `TODO(backend)` returns nothing
- [ ] `npm run lint` and `npm run build` pass
