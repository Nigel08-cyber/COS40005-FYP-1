/*
  Data access for the System Administrator pages (wireframe 16 · Admin panel), connected to the backend.
  What the backend offers today: every organisation (GET /ngos as a platform admin), approve / suspend
  (PATCH /ngos/{id}/status), each organisation's members and dashboard, and all projects.
  Users page: GET /users (every account with roles and organisations) and PATCH /users/{id}/status.
  Still missing: invite user, change role, last login and the audit log — those say "Coming soon"
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
