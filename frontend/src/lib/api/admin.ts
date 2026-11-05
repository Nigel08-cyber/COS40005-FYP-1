/*
  Data access for the System Administrator pages (wireframe 16 · Admin panel), connected to the backend.
  What the backend offers today: every organisation (GET /ngos as a platform admin), approve / suspend
  (PATCH /ngos/{id}/status), each organisation's members and dashboard, and all projects.
  It has no API yet to list every user (volunteers included), suspend users, send password resets or read
  the audit log — those parts of the pages say "Coming soon" (see BACKEND_INTEGRATION.md, section 4).
*/
import { restoreSession } from "@/lib/api/auth";
import { api } from "@/lib/api/http";
import type { MemberApi, NgoApi, ProjectApi } from "@/lib/api/projects";
import type { AdminOrganisation, AdminOrganisationsData, AdminUser, AdminUsersData, NgoStatus } from "@/lib/staffTypes";

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

/**
 * Staff users: the signed-in system admin plus every organisation's admins and coordinators
 * (GET /ngos/{id}/members). Volunteers are not included: the backend has no "list users" API yet.
 */
export async function getAdminUsers(): Promise<AdminUsersData> {
  const [me, ngos] = await Promise.all([restoreSession(), api<NgoApi[]>("/ngos")]);
  const users: AdminUser[] = [];
  if (me) {
    users.push({
      key: `${me.id}-platform`, userId: me.id, name: me.fullName, email: me.email,
      role: "system_admin", organisation: "Platform", status: "active",
    });
  }
  const lists = await Promise.all(ngos.map(async (n) => ({ ngo: n, members: await membersOf(n.ngo_id) })));
  for (const { ngo, members } of lists) {
    for (const m of members) {
      users.push({
        key: `${m.user_id}-${ngo.ngo_id}`, userId: m.user_id, name: m.full_name, email: m.email,
        role: m.member_role, organisation: ngo.name, status: m.status,
      });
    }
  }
  users.sort((a, b) => a.name.localeCompare(b.name));
  return { users, organisations: ngos.map((n) => n.name).sort() };
}
