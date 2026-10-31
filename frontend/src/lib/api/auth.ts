/*
  Authentication against the FastAPI backend (backend/app/routers/auth.py).

  - Requests go to /auth/* on this site; next.config.ts forwards them to BACKEND_URL,
    so the refresh-token cookie is first-party and httpOnly (JavaScript cannot read it).
  - The short-lived access token is kept in memory only (never localStorage), so a script
    injected into the page cannot steal a long-lived credential.
  - After a page reload the session is restored by calling /auth/refresh (the cookie is sent
    automatically). Use restoreSession() / getAccessToken() before calling protected APIs.
*/
import type { Role } from "@/lib/types";

/** Every role the backend knows. Only "volunteer" and "ngo_admin" can sign up themselves. */
export type AccountRole = Role | "project_coordinator" | "system_admin";

export interface AuthUser {
  id: number;
  email: string;
  fullName: string;
  role: AccountRole;
}

export type AuthField = "fullName" | "email" | "password";

export interface AuthError {
  /** Message for the whole form (wrong password, server down...) */
  message?: string;
  /** Messages for single fields (email already used, password too short...) */
  fields?: Partial<Record<AuthField, string>>;
}

export type AuthResult = { ok: true; user: AuthUser } | { ok: false; error: AuthError };

export interface SignUpInput {
  role: Role;
  fullName: string;
  email: string;
  password: string;
}

export interface LogInInput {
  email: string;
  password: string;
}

interface TokenOut {
  access_token: string;
  expires_in: number;
  user: { id: number; email: string; full_name: string; role: AccountRole };
}

const UNREACHABLE = "Can't reach the server right now. Please try again in a moment.";
/** Refresh a little before the access token really expires. */
const EXPIRY_MARGIN_MS = 30_000;

let accessToken: string | null = null;
let expiresAt = 0;
let currentUser: AuthUser | null = null;
let refreshing: Promise<AuthUser | null> | null = null;

function saveSession(data: TokenOut): AuthUser {
  accessToken = data.access_token;
  expiresAt = Date.now() + data.expires_in * 1000;
  currentUser = {
    id: data.user.id,
    email: data.user.email,
    fullName: data.user.full_name,
    role: data.user.role,
  };
  return currentUser;
}

function clearSession() {
  accessToken = null;
  expiresAt = 0;
  currentUser = null;
}

async function post(path: string, body?: unknown) {
  return fetch(path, {
    method: "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "same-origin",
    cache: "no-store",
  });
}

const FIELD_FROM_API: Record<string, AuthField> = { full_name: "fullName", email: "email", password: "password" };

/** Turns a FastAPI error response into messages the form can show. */
async function toAuthError(res: Response): Promise<AuthError> {
  if (res.status >= 500) return { message: UNREACHABLE };
  const data = (await res.json().catch(() => null)) as { detail?: unknown } | null;
  const detail = data?.detail;

  // 422: [{ loc: ["body", "password"], type: "string_too_short", msg: "..." }, ...]
  if (Array.isArray(detail)) {
    const fields: AuthError["fields"] = {};
    for (const item of detail as { loc?: string[]; type?: string; msg?: string }[]) {
      const field = FIELD_FROM_API[item.loc?.[1] ?? ""];
      if (!field || fields[field]) continue;
      if (field === "password" && item.type === "string_too_short") fields.password = "Use at least 8 characters.";
      else if (field === "email") fields.email = "Please enter a valid email address.";
      else fields[field] = item.msg ?? "Please check this field.";
    }
    return Object.keys(fields).length ? { fields } : { message: "Please check the form and try again." };
  }

  const text = typeof detail === "string" ? detail : "Something went wrong. Please try again.";
  if (res.status === 409) return { fields: { email: text } };
  return { message: text };
}

async function authenticate(path: string, body: unknown): Promise<AuthResult> {
  try {
    const res = await post(path, body);
    if (!res.ok) return { ok: false, error: await toAuthError(res) };
    return { ok: true, user: saveSession((await res.json()) as TokenOut) };
  } catch {
    return { ok: false, error: { message: UNREACHABLE } };
  }
}

/** POST /auth/register. Self sign-up is allowed for volunteers and NGO administrators. */
export async function signUp(input: SignUpInput): Promise<AuthResult> {
  return authenticate("/auth/register", {
    full_name: input.fullName.trim(),
    email: input.email.trim(),
    password: input.password,
    role: input.role,
  });
}

/** POST /auth/login. The role comes from the account, not from the form. */
export async function logIn(input: LogInInput): Promise<AuthResult> {
  return authenticate("/auth/login", { email: input.email.trim(), password: input.password });
}

/** POST /auth/logout: revokes the refresh token on the server and clears the cookie. */
export async function logOut() {
  clearSession();
  try {
    await post("/auth/logout");
  } catch {
    // Offline: the in-memory session is already gone; the cookie expires on its own
  }
}

/**
 * The signed-in user, or null. Uses the in-memory session while the access token is fresh,
 * otherwise asks the backend for a new one with the refresh-token cookie.
 */
export async function restoreSession(): Promise<AuthUser | null> {
  if (currentUser && Date.now() < expiresAt - EXPIRY_MARGIN_MS) return currentUser;
  refreshing ??= post("/auth/refresh")
    .then(async (res) => (res.ok ? saveSession((await res.json()) as TokenOut) : (clearSession(), null)))
    .catch(() => (clearSession(), null))
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** Access token for the Authorization header of protected API calls, or null when signed out. */
export async function getAccessToken() {
  return (await restoreSession()) ? accessToken : null;
}

/** Where each role lands after logging in. */
export function homeFor(role: AccountRole) {
  switch (role) {
    case "volunteer":
      return "/dashboard";
    case "project_coordinator":
      return "/coordinator/attendance";
    default:
      // ngo_admin, and system_admin (allowed everywhere by the backend; no admin pages yet)
      return "/ngo/dashboard";
  }
}

/** Where a brand-new account goes right after signing up. */
export function firstPageFor(role: Role) {
  return role === "ngo_admin" ? "/ngo/profile" : "/profile";
}
