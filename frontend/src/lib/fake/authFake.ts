// FAKE AUTH — remove when the backend is connected (see ./README.md)
// Any email/password is accepted and nothing is saved to a database.
// The "session" is just a flag in the browser so Log out has something to clear.
import type { Role } from "@/lib/types";

const SESSION_KEY_FAKE = "volunteerhub-session-fake";
const LOGIN_DELAY_MS_FAKE = 600;

export async function signInFake(role: Role) {
  await new Promise((r) => setTimeout(r, LOGIN_DELAY_MS_FAKE));
  try {
    localStorage.setItem(SESSION_KEY_FAKE, role);
  } catch {
    // Private mode / blocked storage: the fake login still works for this page view
  }
  return { ok: true as const, role };
}

export async function signOutFake() {
  try {
    localStorage.removeItem(SESSION_KEY_FAKE);
  } catch {
    // Nothing to clear
  }
}

/** True if the fake session flag exists (set by signInFake, cleared by signOutFake). */
export function hasSessionFake() {
  try {
    return localStorage.getItem(SESSION_KEY_FAKE) !== null;
  } catch {
    // Storage blocked: treat as signed in so the pages stay usable
    return true;
  }
}
