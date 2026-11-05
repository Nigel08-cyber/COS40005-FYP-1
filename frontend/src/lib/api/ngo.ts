/*
  Data access for the NGO Administrator pages (wireframes 10, 12, 13 and the projects list),
  connected to the FastAPI backend (backend/README.md lists the endpoints).
  Project details, application review and team members live in projects.ts (shared with coordinators).
  Call these from the browser (through <DataView>) because the access token only exists there.
  Fields the backend does not store yet are kept in the forms and marked "Not saved yet"
  (see BACKEND_INTEGRATION.md, section 4).
*/
import { api, shortDay, todayInMalaysia, utcToLocal } from "@/lib/api/http";
import {
  type EventApi,
  type ProjectApi,
  categoryLabel,
  coordinatorOptions,
  experienceLabel,
  getEvents,
  getMembers,
  getMyNgo,
  pickSession,
  toListItem,
  type NgoApi,
} from "@/lib/api/projects";
import {
  AREAS,
  CATEGORIES,
  DAYS,
  EXPERIENCE_LEVELS,
  LANGUAGES,
  ORG_ACTIVITIES,
  ORG_TYPES,
  STANDING_SKILLS,
  STATES,
  TIMES,
} from "@/lib/ngoOptions";
import type {
  ExistingProject,
  NgoDashboardData,
  OrgProfile,
  OrgProfileData,
  OrgProfileOptions,
  ProjectDraft,
  ProjectDraftItem,
  ProjectFormData,
  ProjectListItem,
  ProjectsData,
} from "@/lib/staffTypes";

/* ---------------- API shapes ---------------- */

interface DashboardApi {
  volunteers_total: number;
  pending_applications: number;
  total_hours: number;
  hours_this_month: number;
  projects_by_status: Record<string, number>;
  upcoming_events: number;
  requirement_fill: { title: string; volunteers_needed: number | null; approved_volunteers: number; fill_percent: number | null }[];
  skills_gap: { skill_name: string; gap: number }[];
}

/* ---------------- helpers ---------------- */

/** A project counts as "needing volunteers" below this share of filled spots (same rule as the tables). */
const NEEDS_VOLUNTEERS_BELOW = 0.6;
const UPCOMING_ON_DASHBOARD = 5;

const splitList = (s: string | null) => (s ?? "").split(",").map((x) => x.trim()).filter(Boolean);
const joinList = (items: string[]) => (items.length ? items.join(", ") : null);
const orNull = (s: string) => (s.trim() ? s.trim() : null);

const categoryCode = (label: string) => CATEGORIES.find((c) => c.label === label)?.code ?? null;

/** Malaysia local "YYYY-MM-DD" + "HH:mm" -> naive UTC "YYYY-MM-DDTHH:mm:00" (what the backend stores). */
function localToUtc(date: string, hhmm: string) {
  const utc = new Date(`${date}T${hhmm}:00+08:00`);
  return utc.toISOString().slice(0, 19);
}

/** Name of the signed-in user's organisation ("" when none) — for the nav bar user menu. */
export async function getMyOrganisationName() {
  return (await getMyNgo())?.name ?? "";
}

/* ---------------- 10 · organisation profile ---------------- */

const emptyProfile: OrgProfile = {
  name: "",
  type: ORG_TYPES[0],
  description: "",
  logoName: "",
  registrationNo: "",
  areasOfActivity: [],
  state: "Selangor",
  serviceAreas: [],
  contactPerson: "",
  email: "",
  phone: "",
  website: "",
  officeAddress: "",
  standingSkills: [],
  typicalVolunteers: "",
};

export function getOrgProfileOptions(): OrgProfileOptions {
  return { types: ORG_TYPES, activities: ORG_ACTIVITIES, states: STATES, skills: STANDING_SKILLS };
}

export async function getOrgProfile(): Promise<OrgProfileData> {
  const ngo = await getMyNgo();
  if (!ngo) return { ngoId: null, status: null, profile: emptyProfile };
  return {
    ngoId: ngo.ngo_id,
    status: ngo.status,
    profile: {
      ...emptyProfile,
      name: ngo.name,
      description: ngo.description ?? "",
      registrationNo: ngo.registration_no,
      areasOfActivity: splitList(ngo.focus_areas),
      state: ngo.state ?? "",
      serviceAreas: splitList(ngo.service_areas),
      email: ngo.email ?? "",
      phone: ngo.phone ?? "",
      website: ngo.website ?? "",
      officeAddress: ngo.address ?? "",
    },
  };
}

/**
 * Creates the organisation (POST /ngos, starts as "pending" until a platform admin approves it)
 * or updates it (PATCH /ngos/{id}). Fields marked "Not saved yet" are not sent.
 */
export async function saveOrgProfile(profile: OrgProfile, ngoId: number | null): Promise<OrgProfileData> {
  const body = {
    name: profile.name.trim(),
    description: orNull(profile.description),
    focus_areas: joinList(profile.areasOfActivity),
    service_areas: joinList(profile.serviceAreas),
    email: orNull(profile.email),
    phone: orNull(profile.phone),
    website: orNull(profile.website),
    address: orNull(profile.officeAddress),
    state: orNull(profile.state),
  };
  const ngo =
    ngoId === null
      ? await api<NgoApi>("/ngos", { method: "POST", json: { ...body, registration_no: profile.registrationNo.trim() } })
      : await api<NgoApi>(`/ngos/${ngoId}`, { method: "PATCH", json: body });
  return { ngoId: ngo.ngo_id, status: ngo.status, profile };
}

/* ---------------- projects list ---------------- */

async function memberNames(ngoId: number) {
  return new Map((await getMembers(ngoId)).map((m) => [m.user_id, m.full_name]));
}

function missingFields(p: ProjectApi) {
  const missing: string[] = [];
  if (!p.title.trim()) missing.push("Project title");
  if (!p.start_date) missing.push("Date");
  if (!p.location) missing.push("Venue / address");
  if (!p.coordinator_id) missing.push("Project coordinator");
  if (!p.volunteers_needed) missing.push("Volunteers required");
  return missing;
}

async function listProjects(ngo: NgoApi): Promise<{ projects: ProjectListItem[]; drafts: ProjectDraftItem[] }> {
  const [all, names] = await Promise.all([api<ProjectApi[]>("/projects"), memberNames(ngo.ngo_id)]);
  const mine = all.filter((p) => p.ngo_id === ngo.ngo_id);

  const drafts = mine
    .filter((p) => p.status === "draft")
    .map<ProjectDraftItem>((p) => ({
      id: String(p.project_id),
      title: p.title || "Untitled project",
      category: categoryLabel(p.category),
      date: p.start_date ?? "",
      created: (p.created_at ?? "").slice(0, 10),
      missing: missingFields(p),
    }));

  const projects = await Promise.all(mine.filter((p) => p.status !== "draft").map((p) => toListItem(p, names)));
  return { projects, drafts };
}

export async function getProjectsData(): Promise<ProjectsData> {
  const ngo = await getMyNgo();
  if (!ngo) return { ngoId: null, status: null, organisation: "", projects: [], drafts: [] };
  const { projects, drafts } = await listProjects(ngo);
  return { ngoId: ngo.ngo_id, status: ngo.status, organisation: ngo.name, projects, drafts };
}

/* ---------------- 12 · create / edit a project ---------------- */

const emptyDraft: ProjectDraft = {
  title: "",
  category: CATEGORIES[0].label,
  coordinatorId: "",
  description: "",
  date: "",
  startTime: "08:00",
  endTime: "13:00",
  repeatWeekly: false,
  venue: "",
  area: AREAS[0],
  volunteersRequired: "",
  minExperience: EXPERIENCE_LEVELS[0].label,
  language: LANGUAGES[0],
  skills: [],
  preferredDay: "Saturday",
  preferredFrom: "08:00",
  preferredTo: "13:00",
  additionalRequirements: "",
  requireApproval: true,
  generateAiRecommendations: true,
};

/** "Dewan Komuniti, SS 15, Subang Jaya" -> venue "Dewan Komuniti, SS 15" + area "Subang Jaya" */
function splitLocation(location: string | null) {
  const text = location ?? "";
  const area = AREAS.find((a) => text === a || text.endsWith(`, ${a}`));
  if (!area) return { venue: text, area: AREAS[0] };
  return { venue: text.slice(0, Math.max(0, text.length - area.length - 2)), area };
}

/** A saved project turned back into the form's fields, plus what is needed to update it. */
async function loadExisting(id: string, ngoId: number): Promise<{ draft: ProjectDraft; existing: ExistingProject } | null> {
  if (!/^\d+$/.test(id)) return null;
  let p: ProjectApi;
  try {
    p = await api<ProjectApi>(`/projects/${id}`);
  } catch {
    return null;
  }
  if (p.ngo_id !== ngoId) return null;
  const [events, skills] = await Promise.all([getEvents(id), api<{ skill_name: string }[]>(`/projects/${id}/skills`)]);
  const session: EventApi | null = pickSession(events);
  const start = session ? utcToLocal(session.start_datetime) : "";
  const end = session ? utcToLocal(session.end_datetime) : "";
  const { venue, area } = splitLocation(p.location);
  const experience = experienceLabel(p.min_experience_years);

  return {
    existing: {
      projectId: id,
      status: p.status,
      eventId: session?.event_id ?? null,
      coordinatorId: p.coordinator_id ? String(p.coordinator_id) : "",
    },
    draft: {
      ...emptyDraft,
      title: p.title,
      category: categoryLabel(p.category) === "Uncategorised" ? emptyDraft.category : categoryLabel(p.category),
      coordinatorId: p.coordinator_id ? String(p.coordinator_id) : "",
      description: p.description ?? "",
      date: start.slice(0, 10) || (p.start_date ?? ""),
      startTime: start.slice(11, 16) || emptyDraft.startTime,
      endTime: end.slice(11, 16) || emptyDraft.endTime,
      venue: session?.venue ?? venue,
      area,
      volunteersRequired: p.volunteers_needed ? String(p.volunteers_needed) : "",
      minExperience: EXPERIENCE_LEVELS.some((e) => e.label === experience) ? experience : emptyDraft.minExperience,
      skills: skills.map((s) => s.skill_name),
      preferredDay: p.preferred_day ? DAYS[p.preferred_day - 1] : emptyDraft.preferredDay,
      preferredFrom: p.preferred_start_time?.slice(0, 5) || emptyDraft.preferredFrom,
      preferredTo: p.preferred_end_time?.slice(0, 5) || emptyDraft.preferredTo,
    },
  };
}

/**
 * Form data for "Create a project", or for editing project `editId` (draft or published).
 * `existing` is null and `draft` empty when the project is not found or belongs to another organisation;
 * the edit page checks `notFound`.
 */
export async function getProjectFormData(editId?: string): Promise<ProjectFormData & { notFound: boolean }> {
  const ngo = await getMyNgo();
  const [members, skills, loaded] = await Promise.all([
    ngo ? getMembers(ngo.ngo_id) : Promise.resolve([]),
    api<{ skill_id: number; skill_name: string }[]>("/skills"),
    ngo && editId ? loadExisting(editId, ngo.ngo_id) : Promise.resolve(null),
  ]);
  skillIds = new Map(skills.map((s) => [s.skill_name, s.skill_id]));
  return {
    ngoId: ngo?.ngo_id ?? null,
    status: ngo?.status ?? null,
    draft: loaded?.draft ?? emptyDraft,
    existing: loaded?.existing ?? null,
    notFound: !!editId && !loaded,
    options: {
      categories: CATEGORIES.map((c) => c.label),
      coordinators: coordinatorOptions(members),
      areas: AREAS,
      experienceLevels: EXPERIENCE_LEVELS.map((e) => e.label),
      languages: LANGUAGES,
      skills: skills.map((s) => s.skill_name),
      days: DAYS,
      times: TIMES,
    },
  };
}

/** Skill name -> id, filled by getProjectFormData() (skills come from GET /skills). */
let skillIds = new Map<string, number>();

function projectFields(draft: ProjectDraft) {
  return {
    title: draft.title.trim(),
    description: orNull(draft.description),
    category: categoryCode(draft.category),
    location: [draft.venue.trim(), draft.area].filter(Boolean).join(", ") || null,
    start_date: draft.date || null,
    end_date: draft.date || null,
    volunteers_needed: Number(draft.volunteersRequired) || null,
    min_experience_years: EXPERIENCE_LEVELS.find((e) => e.label === draft.minExperience)?.years ?? null,
    preferred_day: DAYS.indexOf(draft.preferredDay) + 1 || null,
    preferred_start_time: draft.preferredFrom ? `${draft.preferredFrom}:00` : null,
    preferred_end_time: draft.preferredTo ? `${draft.preferredTo}:00` : null,
  };
}

function sessionFields(draft: ProjectDraft) {
  return {
    title: draft.title.trim(),
    venue: orNull(draft.venue),
    start_datetime: localToUtc(draft.date, draft.startTime),
    end_datetime: localToUtc(draft.date, draft.endTime),
    capacity: Number(draft.volunteersRequired) || null,
  };
}

/**
 * New project: POST /projects (status draft or active).
 * Saved project: PATCH /projects/{id}, PUT /projects/{id}/coordinator when the coordinator changed, and
 * PATCH /projects/{id}/status to publish a draft.
 * Then PUT /projects/{id}/skills, and for a published project create (POST /projects/{id}/events) or
 * update (PATCH /events/{id}) its session so volunteers can register.
 */
export async function saveProject(
  draft: ProjectDraft,
  ngoId: number,
  mode: "draft" | "publish" | "update",
  existing: ExistingProject | null = null,
) {
  let projectId: string;
  if (existing) {
    projectId = existing.projectId;
    await api(`/projects/${projectId}`, { method: "PATCH", json: projectFields(draft) });
    if (draft.coordinatorId !== existing.coordinatorId) {
      await api(`/projects/${projectId}/coordinator`, {
        method: "PUT",
        json: { coordinator_id: draft.coordinatorId ? Number(draft.coordinatorId) : null },
      });
    }
  } else {
    const project = await api<ProjectApi>("/projects", {
      method: "POST",
      json: {
        ngo_id: ngoId,
        ...projectFields(draft),
        coordinator_id: draft.coordinatorId ? Number(draft.coordinatorId) : null,
        status: mode === "publish" ? "active" : "draft",
      },
    });
    projectId = String(project.project_id);
  }

  const skills = draft.skills.map((s) => skillIds.get(s)).filter((id): id is number => id !== undefined);
  if (existing || skills.length) {
    await api(`/projects/${projectId}/skills`, { method: "PUT", json: skills.map((skill_id) => ({ skill_id })) });
  }

  const published = mode === "publish" || (mode === "update" && existing?.status !== "draft");
  if (published && draft.date) {
    if (existing?.eventId) {
      await api(`/events/${existing.eventId}`, { method: "PATCH", json: sessionFields(draft) });
    } else {
      await api(`/projects/${projectId}/events`, { method: "POST", json: { ...sessionFields(draft), status: "active" } });
    }
  }
  if (existing && mode === "publish") {
    await api(`/projects/${projectId}/status`, { method: "PATCH", json: { status: "active" } });
  }
  return { id: projectId };
}

/* ---------------- 13 · dashboard ---------------- */

export async function getNgoDashboard(): Promise<NgoDashboardData> {
  const ngo = await getMyNgo();
  if (!ngo) {
    return {
      ngoId: null, status: null, organisation: "", volunteerStats: [], projectStats: [],
      applicationsToReview: 0, requirements: [], skillsGap: [], upcomingProjects: [],
    };
  }
  const [d, { projects }] = await Promise.all([api<DashboardApi>(`/ngos/${ngo.ngo_id}/dashboard`), listProjects(ngo)]);
  const today = todayInMalaysia();
  const upcoming = projects
    .filter((p) => p.state === "active" && (!p.date || p.date >= today))
    .sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
  const needVolunteers = d.requirement_fill.filter(
    (r) => r.volunteers_needed && r.approved_volunteers / r.volunteers_needed < NEEDS_VOLUNTEERS_BELOW,
  ).length;
  const nextDate = upcoming.find((p) => p.date)?.date;

  return {
    ngoId: ngo.ngo_id,
    status: ngo.status,
    organisation: ngo.name,
    volunteerStats: [
      { label: "Total volunteers", value: String(d.volunteers_total), note: "approved across all projects", noteTone: "muted" },
      { label: "Active volunteers", value: null, note: "Coming soon" },
      { label: "New volunteers", value: null, note: "Coming soon" },
      { label: "Returning volunteers", value: null, note: "Coming soon" },
    ],
    projectStats: [
      {
        label: "Active projects",
        value: String(d.projects_by_status.active ?? 0),
        note: needVolunteers ? `${needVolunteers} ${needVolunteers === 1 ? "needs" : "need"} volunteers` : "all on track",
        noteTone: needVolunteers ? "warning" : "muted",
      },
      {
        label: "Upcoming sessions",
        value: String(d.upcoming_events),
        note: nextDate ? `next: ${shortDay(nextDate)}` : "none scheduled",
        noteTone: "muted",
      },
      { label: "Completed projects", value: String(d.projects_by_status.completed ?? 0), note: "all time", noteTone: "muted" },
    ],
    applicationsToReview: d.pending_applications,
    requirements: d.requirement_fill.map((r) => ({ project: r.title, approved: r.approved_volunteers, needed: r.volunteers_needed })),
    skillsGap: d.skills_gap.filter((g) => g.gap > 0).map((g) => ({ skill: g.skill_name, volunteersRequired: g.gap })),
    upcomingProjects: upcoming.slice(0, UPCOMING_ON_DASHBOARD),
  };
}
