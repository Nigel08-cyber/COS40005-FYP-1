# Fake data (temporary)

Everything in this folder is placeholder data / behaviour used until the backend and database are ready.
Log in / sign up / log out are already real (`src/lib/api/auth.ts`), so there is no fake auth any more.

| File | What it fakes |
| --- | --- |
| `opportunitiesFake.ts` | Volunteer opportunities shown on Browse / details / dashboard. |
| `volunteerFake.ts` | The signed-in volunteer, applications, stats, history, certificates, profile and the fake "save profile". |
| `ngoFake.ts` | NGO Administrator pages: the admin, organisation profile + fake save, project form options + fake save, likely matches, NGO dashboard, project list and drafts. |
| `coordinatorFake.ts` | Project Coordinator pages: the coordinator, attendance event, roster and the random QR token. |

- Every export ends with `Fake` (e.g. `opportunitiesFake`, `saveProjectFake`) so it is easy to find:
  search the project for `Fake` or for `@/lib/fake`.
- Pages never import from here directly. They go through `src/lib/api/` (`auth.ts`, `volunteer.ts`, `ngo.ts`, `coordinator.ts`).
- **Full list of what to replace: [`../../../BACKEND_INTEGRATION.md`](../../../BACKEND_INTEGRATION.md)**

## Removing it later

1. Replace the body of each function in `src/lib/api/` with a real API call.
2. Delete this `fake/` folder.
3. Search for `Fake` — there should be no results left.
