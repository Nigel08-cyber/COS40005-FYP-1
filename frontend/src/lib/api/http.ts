/*
  Calls the FastAPI backend through the site's /api/* proxy (see next.config.ts) with the signed-in
  user's access token. Only use these helpers from client code: the token lives in browser memory.
*/
import { getAccessToken } from "@/lib/api/auth";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : "Something went wrong. Please try again.";
}

function detailOf(data: unknown, status: number) {
  const detail = (data as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    // FastAPI validation errors: [{ loc: ["body", "field"], msg: "..." }]
    const first = detail[0] as { loc?: unknown[]; msg?: string } | undefined;
    const field = first?.loc?.slice(1).join(".");
    return first?.msg ? `${field ? `${field}: ` : ""}${first.msg}` : "Please check the form and try again.";
  }
  return status >= 500 ? "The server had a problem. Please try again in a moment." : "Something went wrong.";
}

export async function api<T>(path: string, init: { method?: string; json?: unknown } = {}): Promise<T> {
  const token = await getAccessToken();
  if (!token) throw new ApiError(401, "Your session has ended. Please sign in again.");
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.json !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
      cache: "no-store",
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError(0, "Can't reach the server right now. Please try again in a moment.");
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new ApiError(res.status, detailOf(data, res.status));
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

/* ---------- time: the database stores naive UTC, the screens show Malaysia time (UTC+8) ---------- */

const MYT_OFFSET_MS = 8 * 3600_000;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** "2026-10-17T01:00:00" (UTC from the API) -> "2026-10-17T09:00" (Malaysia local time) */
export function utcToLocal(utc: string) {
  const d = new Date(new Date(`${utc}Z`).getTime() + MYT_OFFSET_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** Today's date in Malaysia as "YYYY-MM-DD". */
export function todayInMalaysia() {
  return utcToLocal(new Date().toISOString().slice(0, 19)).slice(0, 10);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-15" -> "15 Oct" */
export function shortDay(date: string) {
  const [, m, d] = date.slice(0, 10).split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

/** "2026-05" -> "May" */
export function monthName(month: string) {
  return MONTHS[Number(month.slice(5, 7)) - 1] ?? month;
}
