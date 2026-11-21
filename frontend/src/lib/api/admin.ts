/*
  Data access for the System Administrator pages (wireframe 16 · Admin panel), connected to the backend.
  What the backend offers today: every organisation (GET /ngos as a platform admin), approve / suspend
  (PATCH /ngos/{id}/status), each organisation's members and dashboard, and all projects.
  Users page: GET /users (every account with roles and organisations) and PATCH /users/{id}/status.
  Audit log: GET /audit-logs. Still missing: invite user, change role and last login, which say "Coming soon"
  (see BACKEND_INTEGRATION.md, section 4).
*/
import { restoreSession } from "@/lib/api/auth";
import { api, utcToLocal } from "@/lib/api/http";
import type { MemberApi, NgoApi, ProjectApi } from "@/lib/api/projects";
import type {
  AccountStatus,
  AdminOrganisation,
  AdminOrganisationsData,
  AdminUser,
  AdminUserRole,
  AdminUsersData,
  NgoStatus,
} from "@/lib/staffTypes";

interface NgoDashboardApi {
  volunteers_total: number;
  hours_this_month: number;
}

/** Members of an organisation; an empty list if the call fails (so one bad row does not break the page). */
async function membersOf(ngoId: number) {
  try {
    return (await api<MemberApi[]>(`/ngos/${ngoId}/members`)).filter((m) => m.status === "active");
  } catch {
    return [];
  }
}

async function dashboardOf(ngoId: number): Promise<NgoDashboardApi> {
  try {
    return await api<NgoDashboardApi>(`/ngos/${ngoId}/dashboard`);
  } catch {
    return { volunteers_total: 0, hours_this_month: 0 };
  }
}

/** GET /ngos (a platform admin gets every organisation), plus members, dashboard and project counts. */
export async function getAdminOrganisations(): Promise<AdminOrganisationsData> {
  const [ngos, projects] = await Promise.all([api<NgoApi[]>("/ngos"), api<ProjectApi[]>("/projects")]);
  const organisations = await Promise.all(
    ngos.map(async (n): Promise<AdminOrganisation> => {
      const [members, dashboard] = await Promise.all([membersOf(n.ngo_id), dashboardOf(n.ngo_id)]);
      return {
        id: n.ngo_id,
        name: n.name,
        registrationNo: n.registration_no,
        status: n.status,
        administrator: members.find((m) => m.member_role === "ngo_admin")?.full_name ?? "—",
        projects: projects.filter((p) => p.ngo_id === n.ngo_id && p.status !== "draft").length,
        volunteers: dashboard.volunteers_total,
        hoursThisMonth: dashboard.hours_this_month,
        description: n.description ?? "",
        email: n.email ?? "",
        phone: n.phone ?? "",
        website: n.website ?? "",
        address: n.address ?? "",
        state: n.state ?? "",
        focusAreas: n.focus_areas ?? "",
      };
    }),
  );
  return { organisations, activeProjects: projects.filter((p) => p.status === "active").length };
}

/** PATCH /ngos/{id}/status — approve (active), reject or suspend (suspended). */
export async function setOrganisationStatus(ngoId: number, status: NgoStatus) {
  return (await api<NgoApi>(`/ngos/${ngoId}/status`, { method: "PATCH", json: { status } })).status;
}

/* ---------------- users (GET /users, PATCH /users/{id}/status) ---------------- */

interface AdminUserApi {
  user_id: number;
  full_name: string;
  email: string;
  account_status: AccountStatus;
  system_role: string;
  roles: AdminUserRole[];
  organisations: { ngo_id: number; name: string; member_role: string }[];
  created_at: string;
}

/** Highest role first, so the first one is the role the user logs in as. */
const ROLE_ORDER: AdminUserRole[] = ["system_admin", "ngo_admin", "project_coordinator", "volunteer"];
/** The backend returns at most this many users per call (its own maximum). */
const USERS_LIMIT = 500;

function toAdminUser(u: AdminUserApi, myId: number | undefined): AdminUser {
  return {
    userId: u.user_id,
    name: u.full_name,
    email: u.email,
    roles: ROLE_ORDER.filter((r) => u.roles.includes(r)),
    organisations: u.organisations.map((o) => o.name),
    status: u.account_status,
    joined: utcToLocal(u.created_at.slice(0, 19)).slice(0, 10),
    isYou: u.user_id === myId,
  };
}

/** GET /users (System Admin only): every account, sorted by name. Search and filters run in the browser. */
export async function getAdminUsers(): Promise<AdminUsersData> {
  const [me, rows, ngos] = await Promise.all([
    restoreSession(),
    api<AdminUserApi[]>(`/users?limit=${USERS_LIMIT}`),
    api<NgoApi[]>("/ngos"),
  ]);
  return { users: rows.map((u) => toAdminUser(u, me?.id)), organisations: ngos.map((n) => n.name).sort() };
}

/** PATCH /users/{id}/status — suspend (also signs them out everywhere) or reactivate. Not allowed on yourself. */
export async function setUserStatus(userId: number, status: "active" | "suspended") {
  const me = await restoreSession();
  return toAdminUser(await api<AdminUserApi>(`/users/${userId}/status`, { method: "PATCH", json: { account_status: status } }), me?.id);
}

/* ---------------- audit log (GET /audit-logs) ---------------- */

export interface AuditEntry {
  log_id: number;
  user_id: number | null;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  details: { status?: number; path?: string; hours?: number | null } | null;
  ip_address: string | null;
  created_at: string;
}

export interface AuditPeople {
  names: Record<number, string>;
  options: { value: string; label: string }[];
}

const AUDIT_PAGE_SIZE = 25;

/** Readable names for the backend's action codes. Anything not listed shows its technical name. */
const AUDIT_LABELS: Record<string, string> = {
  "POST /auth/login": "Logged in",
  "POST /auth/logout": "Logged out",
  "POST /auth/register": "Created an account",
  "POST /auth/password-reset": "Requested a password reset",
  "POST /auth/password-reset/confirm": "Changed password by reset link",
  "PATCH /auth/users/{user_id}/system-role": "Changed a system role",
  "PATCH /users/{user_id}/status": "Changed a user's status",
  "POST /ngos": "Created an organisation",
  "PATCH /ngos/{ngo_id}": "Edited an organisation",
  "PATCH /ngos/{ngo_id}/status": "Changed an organisation's status",
  "POST /ngos/{ngo_id}/members": "Added a team member",
  "DELETE /ngos/{ngo_id}/members/{user_id}": "Removed a team member",
  "POST /projects": "Created a project",
  "PATCH /projects/{project_id}": "Edited a project",
  "PATCH /projects/{project_id}/status": "Changed a project's status",
  "PUT /projects/{project_id}/coordinator": "Assigned a coordinator",
  "PUT /projects/{project_id}/skills": "Changed required skills",
  "POST /projects/{project_id}/events": "Added a session",
  "PATCH /events/{event_id}": "Edited a session",
  "POST /projects/{project_id}/applications": "Applied to a project",
  "DELETE /projects/{project_id}/applications/me": "Withdrew an application",
  "PATCH /applications/{application_id}": "Reviewed an application",
  "POST /events/{event_id}/registrations": "Registered for a session",
  "DELETE /events/{event_id}/registrations/me": "Cancelled a registration",
  "POST /events/{event_id}/qr": "Refreshed a QR code",
  "POST /attendance/scan": "Scanned a QR code",
  "PUT /events/{event_id}/attendance/{user_id}": "Corrected attendance",
  "POST /events/{event_id}/feedback": "Submitted feedback",
  "PATCH /contributions/{contribution_id}": "Reviewed volunteer hours",
  "PUT /me/profile": "Updated their profile",
  "POST /skills": "Added a skill",
  "attendance.checked_in": "Checked in",
  "attendance.checked_out": "Checked out",
  "attendance.corrected": "Attendance corrected",
  "contribution.status": "Volunteer hours status changed",
};

export const auditActionLabel = (action: string) => AUDIT_LABELS[action] ?? action;

/** The backend matches the start of the action code. */
export const AUDIT_FILTERS = [
  { value: "POST /auth/login", label: "Logins" },
  { value: "POST /auth/register", label: "New accounts" },
  { value: "POST /auth/password-reset", label: "Password resets" },
  { value: "PATCH /users/", label: "User status changes" },
  { value: "PATCH /ngos/", label: "Organisation changes" },
  { value: "PATCH /projects/", label: "Project changes" },
  { value: "PATCH /applications/", label: "Application reviews" },
  { value: "attendance.", label: "Attendance" },
  { value: "contribution.", label: "Volunteer hours" },
];

/** Names for the "who" column and the user filter. */
export async function getAuditPeople(): Promise<AuditPeople> {
  const rows = await api<AdminUserApi[]>(`/users?limit=${USERS_LIMIT}`);
  return {
    names: Object.fromEntries(rows.map((u) => [u.user_id, u.full_name])),
    options: rows.map((u) => ({ value: String(u.user_id), label: `${u.full_name} (${u.email})` })),
  };
}

/** One page, newest first. Asks for one extra row to know whether an older page exists. */
export async function getAuditPage({ action, userId, page }: { action: string; userId: number | null; page: number }) {
  const query = new URLSearchParams({ limit: String(AUDIT_PAGE_SIZE + 1), offset: String(page * AUDIT_PAGE_SIZE) });
  if (action) query.set("action", action);
  if (userId !== null) query.set("user_id", String(userId));
  const rows = await api<AuditEntry[]>(`/audit-logs?${query}`);
  return { rows: rows.slice(0, AUDIT_PAGE_SIZE), hasMore: rows.length > AUDIT_PAGE_SIZE };
}
