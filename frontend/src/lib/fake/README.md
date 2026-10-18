# Fake data (temporary)

Everything in this folder is placeholder data / behaviour used until the backend and database are ready.

| File | What it fakes |
| --- | --- |
| `authFake.ts` | Log in / sign up / log out. **Any** email and password is accepted; nothing is saved. |
| `opportunitiesFake.ts` | Volunteer opportunities shown on Browse / details / dashboard. |
| `volunteerFake.ts` | The signed-in volunteer, applications, stats, history, certificates, profile and the fake "save profile". |

- Every export ends with `Fake` (e.g. `opportunitiesFake`, `signInFake`) so it is easy to find:
  search the project for `Fake` or for `@/lib/fake`.
- Pages never import from here directly. They go through `src/lib/api/` (`auth.ts`, `volunteer.ts`).
- **Full list of what to replace: [`../../../BACKEND_INTEGRATION.md`](../../../BACKEND_INTEGRATION.md)**

## Removing it later

1. Replace the body of each function in `src/lib/api/` with a real API call.
2. Delete this `fake/` folder.
3. Search for `Fake` — there should be no results left.
