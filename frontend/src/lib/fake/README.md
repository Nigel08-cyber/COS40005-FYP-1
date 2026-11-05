# Fake data (temporary)

Sample data used until the backend has the matching API.

| File | What it fakes |
| --- | --- |
| `coordinatorFake.ts` | Project Coordinator attendance page: the event, the volunteer roster and the random QR token (no attendance / QR API yet). |

Everything else is connected to the backend: log in / sign up (`src/lib/api/auth.ts`), the volunteer
pages (`volunteer.ts`) and the NGO pages (`ngo.ts`).

- Every export ends with `Fake` (e.g. `attendanceRosterFake`) and IDs contain `fake`, so it is easy to
  find: search the project for `Fake` or for `@/lib/fake`.
- Pages never import from here directly. They go through `src/lib/api/coordinator.ts`.
- **Full status and what the backend still needs: [`../../../BACKEND_INTEGRATION.md`](../../../BACKEND_INTEGRATION.md)**

## Removing it later

1. Replace the body of each function in `src/lib/api/coordinator.ts` with a real API call.
2. Delete this `fake/` folder.
3. Search for `Fake` — there should be no results left.
