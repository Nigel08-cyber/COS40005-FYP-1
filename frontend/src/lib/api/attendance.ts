/*
  QR attendance, connected to the backend (backend/app/routers/attendance.py).
  Volunteer: POST /attendance/scan (first scan checks in, second checks out), GET /events/{id}/attendance/me.
  Staff: GET/POST /events/{id}/qr, GET /events/{id}/attendance, PUT /events/{id}/attendance/{userId}.
*/
import { restoreSession } from "@/lib/api/auth";
import { ApiError, api, localToUtc, utcToLocal } from "@/lib/api/http";
import { type ProjectApi, getEvents, getMyNgo } from "@/lib/api/projects";
import { formatShortDate, formatTime } from "@/lib/format";

/* ---------------- volunteer ---------------- */

export interface ActivityApi {
  event_id: number;
  event_title: string;
  project_id: number;
  project_title: string;
  venue: string | null;
  start_datetime: string;
  end_datetime: string;
  registration_status: "registered" | "waitlisted";
}

export interface CheckInEvent {
  id: number;
  projectId: number;
  title: string;
  /** Malaysia local time, "YYYY-MM-DDTHH:mm" */
  start: string;
  end: string;
  venue: string;
}

export interface MyAttendance {
  status: "not_arrived" | "checked_in" | "checked_out" | "absent";
  check_in_time: string | null;
  check_out_time: string | null;
  hours_served: number | null;
}

export interface ScanResult {
  event_id: number;
  event_title: string;
  action: "checked_in" | "checked_out";
  check_in_time: string | null;
  check_out_time: string | null;
  hours_served: number | null;
}

export const toCheckInEvent = (a: ActivityApi): CheckInEvent => ({
  id: a.event_id,
  projectId: a.project_id,
  title: a.project_title,
  start: utcToLocal(a.start_datetime),
  end: utcToLocal(a.end_datetime),
  venue: a.venue ?? "",
});

/** Null when the volunteer is not registered for that event. */
export async function getMyAttendance(eventId: number) {
  try {
    return await api<MyAttendance>(`/events/${eventId}/attendance/me`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

/** Upcoming and past events the volunteer signed up for. These also work once a project is completed. */
export async function getMyEvents() {
  const [upcoming, past] = await Promise.all([
    api<ActivityApi[]>("/me/activities"),
    api<ActivityApi[]>("/me/activities?past=true"),
  ]);
  return { upcoming: upcoming.filter((a) => a.registration_status === "registered"), past };
}

/** Check-out stays open for 3 hours after an event ends, so a recent event can still be the one in progress. */
const CHECK_OUT_WINDOW_MS = 3 * 3600_000;

/**
 * The event the check-in page is about: the requested one, otherwise the one the volunteer is
 * checked in to, otherwise their next event.
 */
export async function getCheckInContext(eventId: number | null) {
  const { upcoming, past } = await getMyEvents();
  if (eventId) {
    const found = [...upcoming, ...past].find((a) => a.event_id === eventId);
    if (found) return { event: toCheckInEvent(found), attendance: await getMyAttendance(eventId) };
  }
  const cutoff = new Date(Date.now() - CHECK_OUT_WINDOW_MS).toISOString().slice(0, 19);
  const candidates = [...past.filter((a) => a.end_datetime >= cutoff), ...upcoming].slice(0, 5);
  const statuses = await Promise.all(candidates.map((a) => getMyAttendance(a.event_id)));
  const onSite = statuses.findIndex((s) => s?.status === "checked_in");
  const next = upcoming[0];
  if (onSite >= 0) return { event: toCheckInEvent(candidates[onSite]), attendance: statuses[onSite] };
  if (!next) return { event: null, attendance: null };
  return { event: toCheckInEvent(next), attendance: statuses[candidates.indexOf(next)] ?? null };
}

export async function scanAttendance(token: string) {
  return api<ScanResult>("/attendance/scan", { method: "POST", json: { token } });
}

/* ---------------- staff: which events ---------------- */

export interface StaffEvent {
  id: number;
  projectId: number;
  title: string;
  start: string;
  end: string;
  venue: string;
  status: string;
}

export const staffEventLabel = (e: StaffEvent) => `${e.title} · ${formatShortDate(e.start)} · ${formatTime(e.start)}`;

/** Published events the signed-in staff member runs: running and upcoming first, then the most recent past ones. */
export async function getStaffEvents(): Promise<StaffEvent[]> {
  const me = await restoreSession();
  let projects: ProjectApi[];
  if (me?.role === "ngo_admin") {
    const ngo = await getMyNgo();
    projects = ngo ? (await api<ProjectApi[]>("/projects")).filter((p) => p.ngo_id === ngo.ngo_id) : [];
  } else if (me?.role === "system_admin") {
    projects = await api<ProjectApi[]>("/projects");
  } else {
    projects = await api<ProjectApi[]>("/me/coordinated-projects");
  }
  const published = projects.filter((p) => p.status !== "draft");
  const lists = await Promise.all(
    published.map(async (p) =>
      (await getEvents(p.project_id))
        .filter((e) => e.status === "active" || e.status === "completed")
        .map<StaffEvent>((e) => ({
          id: e.event_id,
          projectId: p.project_id,
          title: p.title,
          start: utcToLocal(e.start_datetime),
          end: utcToLocal(e.end_datetime),
          venue: e.venue ?? "",
          status: e.status,
        })),
    ),
  );
  const now = utcToLocal(new Date().toISOString().slice(0, 19));
  const all = lists.flat();
  const open = all.filter((e) => e.end >= now).sort((a, b) => a.start.localeCompare(b.start));
  const ended = all.filter((e) => e.end < now).sort((a, b) => b.start.localeCompare(a.start));
  return [...open, ...ended];
}

/* ---------------- staff: QR and roster ---------------- */

export interface EventQr {
  token: string;
  scan_url: string;
  expires_at: string;
  ttl_seconds: number;
}

export type RosterStatus = "not_arrived" | "checked_in" | "checked_out" | "absent";

export interface RosterRow {
  user_id: number;
  full_name: string;
  email: string;
  status: RosterStatus;
  check_in_time: string | null;
  check_out_time: string | null;
  hours_served: number | null;
}

export interface EventRoster {
  registered: number;
  checked_in: number;
  checked_out: number;
  not_arrived: number;
  total_hours: number;
  rows: RosterRow[];
}

/** Hands out a new code by itself once the old one has expired. */
export const getEventQr = (eventId: number) => api<EventQr>(`/events/${eventId}/qr`);

/** Replaces the code now; the old one stops working. */
export const rotateEventQr = (eventId: number) => api<EventQr>(`/events/${eventId}/qr`, { method: "POST" });

export const getEventRoster = (eventId: number) => api<EventRoster>(`/events/${eventId}/attendance`);

const nowUtc = () => new Date().toISOString().slice(0, 19);

export const manualCheckIn = (eventId: number, userId: number) =>
  api(`/events/${eventId}/attendance/${userId}`, { method: "PUT", json: { check_in_time: nowUtc() } });

export const markAbsent = (eventId: number, userId: number) =>
  api(`/events/${eventId}/attendance/${userId}`, { method: "PUT", json: { absent: true } });

/** Corrects a volunteer's times ("HH:mm", Malaysia time) on the given local date. */
export const correctTimes = (eventId: number, userId: number, date: string, checkIn: string, checkOut: string) =>
  api(`/events/${eventId}/attendance/${userId}`, {
    method: "PUT",
    json: { check_in_time: localToUtc(date, checkIn), check_out_time: checkOut ? localToUtc(date, checkOut) : null },
  });

/** Marks the event as finished: its QR code stops working. */
export const closeEvent = (eventId: number) =>
  api(`/events/${eventId}`, { method: "PATCH", json: { status: "completed" } });
