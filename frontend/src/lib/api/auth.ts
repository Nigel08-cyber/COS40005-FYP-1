/*
  Authentication. Right now these call the FAKE auth in src/lib/fake/authFake.ts,
  which accepts anything. When the backend is ready, replace the bodies with real
  requests (and send the form values through).
*/
import { hasSessionFake, signInFake, signOutFake } from "@/lib/fake/authFake";
import type { Role } from "@/lib/types";

export interface SignUpInput {
  role: Role;
  fullName: string;
  email: string;
  password: string;
}

export interface LogInInput {
  role: Role;
  email: string;
  password: string;
}

export async function signUp(input: SignUpInput) {
  return signInFake(input.role);
}

export async function logIn(input: LogInInput) {
  return signInFake(input.role);
}

export async function logOut() {
  return signOutFake();
}

/** Whether someone is logged in. Runs in the browser only (reads the FAKE session for now). */
export function isLoggedIn() {
  return hasSessionFake();
}
