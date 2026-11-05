/*
  Project details, application review and team members, shared by the NGO Administrator pages (/ngo/...)
  and the Project Coordinator pages (/coordinator/...). Connected to the FastAPI backend.
  Call these from the browser (through <DataView>) because the access token only exists there.
*/
import { restoreSession } from "@/lib/api/auth";
import { api, utcToLocal } from "@/lib/api/http";
import { CATEGORIES, DAYS, EXPERIENCE_LEVELS } from "@/lib/ngoOptions";
import { formatTime } from "@/lib/format";
import type {
  ApplicationItem,
  ApplicationStatus,
  ApplicationsData,
  Coordinator,
  CoordinatorProjectsData,
  MemberItem,
  NgoStatus,
  ProjectDetailData,
  ProjectListItem,
  ProjectStatus,
  SessionItem,
  StaffScope,
  TeamData,
} from "@/lib/staffTypes";

/* ---------------- API shapes ---------------- */

export interface NgoApi {
  ngo_id: number;
  registration_no: string;
  name: string;
  description: string | null;
  focus_areas: string | null;
  service_areas: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  status: NgoStatus;
}

export interface MemberApi {
  user_id: number;
  full_name: string;
  email: string;
  member_role: "ngo_admin" | "coordinator";
  status: string;
}

export interface ProjectApi {
  project_id: number;
  ngo_id: number;
  coordinator_id: number | null;
  title: string;
  description: string | null;
  category: string | null;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  volunteers_needed: number | null;
  min_experience_years: number | null;
  preferred_day: number | null;
  preferred_start_time: string | null;
  preferred_end_time: string | null;
  status: ProjectStatus;
  created_at: string | null;
}

export interface EventApi {
  event_id: number;
  project_id: number;
  title: string;
  venue: string | null;
  start_datetime: string;
  end_datetime: string;
  capacity: number | null;
  status: string;
  registered_count: number;
  waitlist_count: number;
}

/**
 * GET /projects/{id}/applications. The backend only sends the volunteer's user_id today; the optional
 * fields are read as soon as the backend adds them (see BACKEND_INTEGRATION.md, section 4).
 */
interface ApplicationApi {
  application_id: number;
  project_id: number;
  user_id: number;
  status: ApplicationStatus;
  decided_by: number | null;
  decided_at: string | null;
  coordinator_note: string | null;
  full_name?: string | null;
  email?: string | null;
  skills?: (string | { skill_name: string })[] | null;
  applied_at?: string | null;
}

/* ---------------- shared helpers ---------------- */

export const categoryLabel = (code: string | null) => CATEGORIES.find((c) => c.code === code)?.label ?? "Uncategorised";

/** The signed-in user's first organisation, or null if they have none. */
export async function getMyNgo(): Promise<NgoApi | null> {
  const rows = await api<NgoApi[]>("/ngos?mine=true");
  return rows[0] ?? null;
}

export async function getMembers(ngoId: number) {
  return (await api<MemberApi[]>(`/ngos/${ngoId}/members`)).filter((m) => m.status === "active");
}

export const coordinatorOptions = (members: MemberApi[]): Coordinator[] =>
  members.map((m) => ({ id: String(m.user_id), name: m.member_role === "ngo_admin" ? `${m.full_name} (admin)` : m.full_name }));

export async function getEvents(projectId: number | string) {
  return api<EventApi[]>(`/projects/${projectId}/events`);
}

/** Next upcoming active session of a project, or its latest one. */
export function pickSession(events: EventApi[]) {
  const now = new Date().toISOString().slice(0, 19);
  return events.find((e) => e.status === "active" && e.end_datetime >= now) ?? events.at(-1) ?? null;
}

/** A published project as a row of the project tables. */
export async function toListItem(p: ProjectApi, names: Map<number, string>): Promise<ProjectListItem> {
  const session = pickSession(await getEvents(p.project_id));
  return {
    id: String(p.project_id),
    title: p.title,
    coordinator: (p.coordinator_id && names.get(p.coordinator_id)) || "Not assigned",
    date: session ? utcToLocal(session.start_datetime).slice(0, 10) : (p.start_date ?? ""),
    registered: session?.registered_count ?? 0,
    needed: p.volunteers_needed ?? session?.capacity ?? null,
    state: p.status as ProjectListItem["state"],
  };
}

const localDate = (utc: string | null | undefined) => (utc ? utcToLocal(utc).slice(0, 10) : null);

function toApplication(a: ApplicationApi, projectTitle: string, names: Map<number, string>): ApplicationItem {
  const name = a.full_name?.trim();
  return {
    id: a.application_id,
    projectId: String(a.project_id),
    projectTitle,
    volunteerId: a.user_id,
    volunteer: name || `Volunteer #${a.user_id}`,
    hasName: !!name,
    email: a.email ?? null,
    skills: a.skills ? a.skills.map((s) => (typeof s === "string" ? s : s.skill_name)) : null,
    appliedOn: localDate(a.applied_at),
    status: a.status,
    decidedBy: a.decided_by ? (names.get(a.decided_by) ?? `User #${a.decided_by}`) : null,
    decidedOn: localDate(a.decided_at),
    note: a.coordinator_note,
  };
}

async function applicationsFor(projects: ProjectApi[], names: Map<number, string>) {
  const lists = await Promise.all(
    projects.map(async (p) =>
      (await api<ApplicationApi[]>(`/projects/${p.project_id}/applications`)).map((a) => toApplication(a, p.title, names)),
    ),
  );
  return lists.flat();
}

/** Names of everyone in the user's organisations (coordinators, admins), for "decided by" and table columns. */
async function staffNames(ngoIds: number[]) {
  const lists = await Promise.all(ngoIds.map((id) => getMembers(id)));
  return new Map(lists.flat().map((m) => [m.user_id, m.full_name]));
}

/* ---------------- project details ---------------- */

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : "");

function preferredAvailability(p: ProjectApi) {
  const day = p.preferred_day ? DAYS[p.preferred_day - 1] : "";
  const from = hhmm(p.preferred_start_time);
  const to = hhmm(p.preferred_end_time);
  const time = from && to ? `${formatTime(`2000-01-01T${from}`)}–${formatTime(`2000-01-01T${to}`)}` : "";
  return [day, time].filter(Boolean).join(", ") || "Any";
}

export function experienceLabel(years: number | null) {
  return EXPERIENCE_LEVELS.find((e) => e.years === years)?.label ?? `At least ${years} years`;
}

function toSession(e: EventApi): SessionItem {
  return {
    id: e.event_id,
    title: e.title,
    start: utcToLocal(e.start_datetime),
    end: utcToLocal(e.end_datetime),
    venue: e.venue ?? "",
    capacity: e.capacity,
    registered: e.registered_count,
    waitlisted: e.waitlist_count,
    status: e.status,
  };
}

/**
 * GET /projects/{id} + events, required skills, applications and the organisation's members.
 * Returns project: null when the project does not exist or belongs to another organisation.
 */
export async function getProjectDetail(id: string, scope: StaffScope): Promise<ProjectDetailData> {
  const empty: ProjectDetailData = {
    scope, ngoStatus: null, project: null, sessions: [], applications: [], coordinators: [], canAssignCoordinator: false,
  };
  if (!/^\d+$/.test(id)) return empty;

  const [me, myNgos] = await Promise.all([restoreSession(), api<NgoApi[]>("/ngos?mine=true")]);
  let p: ProjectApi;
  try {
    p = await api<ProjectApi>(`/projects/${id}`);
  } catch {
    return empty;
  }
  const ngo = myNgos.find((n) => n.ngo_id === p.ngo_id);
  if (!ngo) return empty;

  const [members, events, skills, apps] = await Promise.all([
    getMembers(ngo.ngo_id),
    getEvents(id),
    api<{ skill_name: string }[]>(`/projects/${id}/skills`),
    p.status === "draft" ? Promise.resolve([] as ApplicationApi[]) : api<ApplicationApi[]>(`/projects/${id}/applications`),
  ]);
  const names = new Map(members.map((m) => [m.user_id, m.full_name]));
  const myRole = members.find((m) => m.user_id === me?.id)?.member_role;

  return {
    scope,
    ngoStatus: ngo.status,
    project: {
      id: String(p.project_id),
      title: p.title,
      description: p.description ?? "",
      category: categoryLabel(p.category),
      status: p.status,
      location: p.location ?? "",
      date: p.start_date ?? "",
      coordinatorId: p.coordinator_id ? String(p.coordinator_id) : "",
      coordinator: (p.coordinator_id && names.get(p.coordinator_id)) || "Not assigned",
      volunteersNeeded: p.volunteers_needed,
      minExperience: experienceLabel(p.min_experience_years),
      preferredAvailability: preferredAvailability(p),
      skills: skills.map((s) => s.skill_name),
      created: (p.created_at ?? "").slice(0, 10),
    },
    sessions: events.map(toSession),
    applications: apps.map((a) => toApplication(a, p.title, names)),
    coordinators: coordinatorOptions(members),
    canAssignCoordinator: myRole === "ngo_admin" || me?.role === "system_admin",
  };
}

/** PATCH /projects/{id}/status. Cancelling also cancels the project's open sessions so volunteers see it. */
export async function setProjectStatus(id: string, status: "active" | "completed" | "cancelled") {
  await api(`/projects/${id}/status`, { method: "PATCH", json: { status } });
  if (status === "cancelled") {
    const open = (await getEvents(id)).filter((e) => e.status === "active");
    await Promise.all(open.map((e) => api(`/events/${e.event_id}`, { method: "PATCH", json: { status: "cancelled" } })));
  }
}

/** PUT /projects/{id}/coordinator (NGO admin only). Empty id unlinks the coordinator. */
export async function assignCoordinator(projectId: string, coordinatorId: string) {
  await api(`/projects/${projectId}/coordinator`, {
    method: "PUT",
    json: { coordinator_id: coordinatorId ? Number(coordinatorId) : null },
  });
}

/* ---------------- application review ---------------- */

/** PATCH /applications/{id}. Only pending applications can be decided. */
export async function decideApplication(id: number, decision: "approved" | "rejected", note?: string) {
  const a = await api<ApplicationApi>(`/applications/${id}`, {
    method: "PATCH",
    json: { decision, coordinator_note: note?.trim() || null },
  });
  return { status: a.status, note: a.coordinator_note, decidedOn: localDate(a.decided_at) };
}

/**
 * Every application to the user's published projects: all projects of the organisation (NGO admin)
 * or the projects the user coordinates (coordinator).
 */
export async function getApplications(scope: StaffScope): Promise<ApplicationsData> {
  let projects: ProjectApi[];
  let ngoIds: number[];
  let ngoId: number | null = null;
  if (scope === "ngo") {
    const ngo = await getMyNgo();
    if (!ngo) return { scope, projects: [], applications: [], ngoId: null };
    ngoId = ngo.ngo_id;
    ngoIds = [ngo.ngo_id];
    projects = (await api<ProjectApi[]>("/projects")).filter((p) => p.ngo_id === ngo.ngo_id);
  } else {
    projects = await api<ProjectApi[]>("/me/coordinated-projects");
    ngoIds = [...new Set(projects.map((p) => p.ngo_id))];
  }
  const published = projects.filter((p) => p.status !== "draft");
  const names = await staffNames(ngoIds);
  return {
    scope,
    ngoId,
    projects: published.map((p) => ({ id: String(p.project_id), title: p.title })),
    applications: await applicationsFor(published, names),
  };
}

/* ---------------- coordinator: my projects ---------------- */

/** GET /me/coordinated-projects (published ones; drafts are only managed by the NGO admin). */
export async function getCoordinatedProjects(): Promise<CoordinatorProjectsData> {
  const projects = (await api<ProjectApi[]>("/me/coordinated-projects")).filter((p) => p.status !== "draft");
  const names = await staffNames([...new Set(projects.map((p) => p.ngo_id))]);
  return { projects: await Promise.all(projects.map((p) => toListItem(p, names))) };
}

/* ---------------- team (NGO members) ---------------- */

export async function getTeam(): Promise<TeamData> {
  const [ngo, me] = await Promise.all([getMyNgo(), restoreSession()]);
  if (!ngo) return { ngoId: null, organisation: "", members: [] };
  const members = await getMembers(ngo.ngo_id);
  return {
    ngoId: ngo.ngo_id,
    organisation: ngo.name,
    members: members.map<MemberItem>((m) => ({
      userId: m.user_id,
      name: m.full_name,
      email: m.email,
      role: m.member_role,
      isYou: m.user_id === me?.id,
    })),
  };
}

/** POST /ngos/{id}/members — links an existing VolunteerHub account by email. */
export async function addMember(ngoId: number, email: string, role: "coordinator" | "ngo_admin") {
  await api(`/ngos/${ngoId}/members`, { method: "POST", json: { email: email.trim(), member_role: role } });
}

/** DELETE /ngos/{id}/members/{userId} — their projects lose their coordinator. */
export async function removeMember(ngoId: number, userId: number) {
  await api(`/ngos/${ngoId}/members/${userId}`, { method: "DELETE" });
}
