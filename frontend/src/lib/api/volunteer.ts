/*
  Data access for the volunteer pages, connected to the FastAPI backend (backend/README.md lists the endpoints).
  Pages call these from the browser (through <DataView>) because the access token only exists there.
  The backend speaks in database terms (UTC times, category codes, skill ids); this file maps it to the
  shapes in lib/types.ts.
*/
import { ApiError, api, monthName, shortDay, todayInMalaysia, utcToLocal } from "@/lib/api/http";
import type {
  Application,
  ApplicationStatus,
  AvailabilitySlot,
  Certificate,
  ContributionRecord,
  DayPart,
  MonthlyHours,
  Opportunity,
  PastActivity,
  ProfileOptions,
  VolunteerProfile,
  VolunteerStats,
  Weekday,
} from "@/lib/types";

/* ---------------- API shapes ---------------- */

interface OpportunityApi {
  project_id: number;
  event_id: number | null;
  title: string;
  description: string | null;
  category: string | null;
  ngo_name: string;
  ngo_state: string | null;
  location: string | null;
  venue: string | null;
  start: string;
  end: string;
  volunteers_needed: number;
  registered_count: number;
  waitlist_count: number;
  skills: string[];
  min_experience_years: number | null;
  preferred_day: number | null;
  preferred_start_time: string | null;
  preferred_end_time: string | null;
  distance_km: number | null;
}

interface SkillLink {
  skill_id: number;
  skill_name: string;
  proficiency_level: number;
  years_experience: number | null;
}
interface LanguageLink {
  language: string;
  proficiency: string;
}
interface QualificationLink {
  title: string;
  issuer: string | null;
  year_obtained: number | null;
  expiry_date: string | null;
}
interface AvailabilityRow {
  day_of_week: number;
  start_time: string;
  end_time: string;
}
interface ProfileApi {
  full_name: string;
  email: string;
  phone: string | null;
  experience_summary: string | null;
  city: string | null;
  state: string | null;
  max_travel_km: number | null;
  skills: SkillLink[];
  interests: string[];
  languages: LanguageLink[];
  qualifications: QualificationLink[];
  availability: AvailabilityRow[];
}

/* ---------------- opportunities ---------------- */

const CATEGORY_LABEL: Record<string, Opportunity["category"]> = {
  food_aid: "Food distribution",
  education: "Education",
  environment: "Environment",
  health: "Health",
  community: "Community outreach",
  disaster_relief: "Disaster assistance",
  fundraising: "Fundraising",
};

const WEEKDAY_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function clock(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function preferredAvailability(o: OpportunityApi) {
  const day = o.preferred_day ? WEEKDAY_LONG[o.preferred_day - 1] : "";
  const time = o.preferred_start_time && o.preferred_end_time ? `${clock(o.preferred_start_time)}–${clock(o.preferred_end_time)}` : "";
  return [day, time].filter(Boolean).join(", ") || "Flexible";
}

function initialsOfOrg(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?"
  );
}

function toOpportunity(o: OpportunityApi, myStatus: ApplicationStatus | undefined): Opportunity {
  const parts = (o.location ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return {
    id: String(o.project_id),
    eventId: o.event_id,
    title: o.title,
    organisation: o.ngo_name,
    organisationInitials: initialsOfOrg(o.ngo_name),
    category: CATEGORY_LABEL[o.category ?? ""] ?? "Community outreach",
    start: utcToLocal(o.start),
    end: utcToLocal(o.end),
    area: parts.at(-1) ?? "",
    state: o.ngo_state ?? "",
    address: [o.venue, o.location].filter(Boolean).join(", "),
    distanceKm: o.distance_km,
    skills: o.skills,
    volunteersNeeded: o.volunteers_needed,
    // The API counts everyone registered; the provider adds the signed-in volunteer back on top of "others"
    volunteersRegisteredOthers: Math.max(0, o.registered_count - (myStatus === "registered" ? 1 : 0)),
    summary: o.description ?? "",
    tasks: [],
    preferredAvailability: preferredAvailability(o),
    languages: [],
    experience: o.min_experience_years ? `${o.min_experience_years}+ years` : "None required",
  };
}

export async function getMyApplications(): Promise<Application[]> {
  const rows = await api<{ project_id: number; status: Exclude<ApplicationStatus, "none"> }[]>("/me/applications");
  return rows.map((r) => ({ opportunityId: String(r.project_id), status: r.status }));
}

export async function getOpportunities(): Promise<Opportunity[]> {
  const [rows, mine] = await Promise.all([api<OpportunityApi[]>("/opportunities"), getMyApplications()]);
  const status = new Map(mine.map((a) => [a.opportunityId, a.status]));
  return rows.map((o) => toOpportunity(o, status.get(String(o.project_id))));
}

export async function getOpportunity(id: string): Promise<Opportunity | null> {
  try {
    const [row, mine] = await Promise.all([api<OpportunityApi>(`/opportunities/${encodeURIComponent(id)}`), getMyApplications()]);
    return toOpportunity(row, mine.find((a) => a.opportunityId === id)?.status);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

/* ---------------- actions (used by VolunteerProvider) ---------------- */

export async function applyToProject(id: string) {
  await api(`/projects/${id}/applications`, { method: "POST" });
}

export async function withdrawApplication(id: string) {
  await api(`/projects/${id}/applications/me`, { method: "DELETE" });
}

async function currentEventId(projectId: string) {
  const o = await api<OpportunityApi>(`/opportunities/${projectId}`);
  if (o.event_id === null) throw new ApiError(409, "This activity has no upcoming session to register for yet.");
  return o.event_id;
}

/** Registers for the next event. A full event puts the volunteer on the waitlist instead. */
export async function registerForOpportunity(projectId: string): Promise<"registered" | "waitlisted"> {
  const eventId = await currentEventId(projectId);
  const reg = await api<{ status: "registered" | "waitlisted" }>(`/events/${eventId}/registrations`, { method: "POST" });
  return reg.status;
}

/** Cancels a registration or leaves the waitlist. */
export async function cancelRegistration(projectId: string) {
  const eventId = await currentEventId(projectId);
  await api(`/events/${eventId}/registrations/me`, { method: "DELETE" });
}

/* ---------------- dashboard and history ---------------- */

export async function getVolunteerStats(): Promise<VolunteerStats> {
  const s = await api<{
    total_hours: number;
    hours_this_month: number;
    projects_completed: number;
    upcoming_this_week: number;
    skills_contributed: string[];
    certificates: number;
    certificates_ready: number;
  }>("/me/stats");
  const extra = s.skills_contributed.length - 2;
  return {
    totalHours: s.total_hours,
    hoursThisMonth: s.hours_this_month,
    projectsCompleted: s.projects_completed,
    upcomingThisWeek: s.upcoming_this_week,
    skillsContributed: s.skills_contributed.length,
    skillsPreview: s.skills_contributed.slice(0, 2).join(", ") + (extra > 0 ? `, +${extra}` : "") || "None yet",
    certificates: s.certificates,
    certificatesReady: s.certificates_ready,
  };
}

export async function getContributionHistory(): Promise<ContributionRecord[]> {
  const rows = await api<
    { contribution_id: number; project_title: string; role: string | null; hours: number; contribution_date: string; status: string }[]
  >("/me/contributions");
  return rows
    .filter((c) => c.status !== "rejected")
    .map((c) => ({
      id: String(c.contribution_id),
      activity: c.project_title,
      date: shortDay(c.contribution_date),
      hours: c.hours,
      role: c.role ?? "Volunteer",
    }));
}

export async function getMonthlyHours(): Promise<MonthlyHours[]> {
  const rows = await api<{ month: string; hours: number }[]>("/me/hours?months=6");
  return rows.map((r) => ({ month: monthName(r.month), hours: r.hours }));
}

export async function getSkillsContributed() {
  return (await api<{ skills_contributed: string[] }>("/me/stats")).skills_contributed;
}

export async function getCertificates(): Promise<Certificate[]> {
  const rows = await api<{ certificate_id: number; project_title: string; issued_at: string }[]>("/me/certificates");
  return rows.map((c) => ({
    id: String(c.certificate_id),
    title: c.project_title,
    status: "issued",
    issuedOn: `Issued ${shortDay(utcToLocal(c.issued_at).slice(0, 10))}`,
  }));
}

export async function getPastActivities(): Promise<PastActivity[]> {
  const rows = await api<{ event_id: number; project_title: string; venue: string | null; start_datetime: string; hours: number | null }[]>(
    "/me/activities?past=true",
  );
  return rows.map((a) => ({
    id: String(a.event_id),
    title: a.project_title,
    date: utcToLocal(a.start_datetime).slice(0, 10),
    area: a.venue ?? "",
    hours: a.hours ?? 0,
    role: "Volunteer",
  }));
}

/** Today's date in Malaysia as "YYYY-MM-DD". */
export function getToday() {
  return todayInMalaysia();
}

/* ---------------- profile ---------------- */

const INTEREST_LABEL: Record<string, string> = {
  food_aid: "Food distribution",
  education: "Education",
  environment: "Environment",
  health: "Healthcare",
  community: "Community outreach",
  disaster_relief: "Disaster assistance",
  fundraising: "Fundraising",
};
const INTEREST_CODE = Object.fromEntries(Object.entries(INTEREST_LABEL).map(([code, label]) => [label, code]));

const WEEKDAYS: Weekday[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** Minutes since midnight. A saved availability row covers every slot it overlaps. */
const DAY_PARTS: Record<DayPart, [number, number]> = { Morning: [360, 720], Afternoon: [720, 1020], Evening: [1020, 1260] };

function minutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function clockString(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}:00`;
}

function slotsFromRows(rows: AvailabilityRow[]): AvailabilitySlot[] {
  const slots = new Set<AvailabilitySlot>();
  for (const r of rows) {
    const start = minutes(r.start_time);
    const end = minutes(r.end_time);
    for (const [part, [from, to]] of Object.entries(DAY_PARTS) as [DayPart, [number, number]][]) {
      if (start < to && end > from) slots.add(`${WEEKDAYS[r.day_of_week - 1]}-${part}`);
    }
  }
  return [...slots];
}

function rowsFromSlots(slots: AvailabilitySlot[]): AvailabilityRow[] {
  return slots.map((slot) => {
    const [day, part] = slot.split("-") as [Weekday, DayPart];
    const [from, to] = DAY_PARTS[part];
    return { day_of_week: WEEKDAYS.indexOf(day) + 1, start_time: clockString(from), end_time: clockString(to) };
  });
}

/*
  The database has no columns for "how often" and "preferred time of day", or for the profile photo.
  Until the team adds them, those two answers are kept in this browser only (localStorage) and the photo
  is not saved. See BACKEND_INTEGRATION.md.
*/
const LOCAL_KEY = "volunteerhub:profile-extras";
interface Extras {
  frequency: string;
  preferredTime: string;
}
function readExtras(): Extras {
  try {
    return { frequency: "", preferredTime: "", ...JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "{}") };
  } catch {
    return { frequency: "", preferredTime: "" };
  }
}
function writeExtras(x: Extras) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(x));
  } catch {
    // Private mode / storage blocked: the two answers just are not remembered
  }
}

function toProfile(p: ProfileApi): VolunteerProfile {
  return {
    fullName: p.full_name,
    email: p.email,
    phone: p.phone ?? "",
    photoName: "",
    skills: p.skills.map((s) => s.skill_name),
    qualifications: p.qualifications.map((q) => q.title).join(", "),
    languages: p.languages.map((l) => l.language),
    interests: p.interests.map((c) => INTEREST_LABEL[c] ?? c),
    availability: slotsFromRows(p.availability),
    ...readExtras(),
    state: p.state ?? "",
    area: p.city ?? "",
    maxDistanceKm: p.max_travel_km ?? 15,
    experience: p.experience_summary ?? "",
  };
}

export async function getVolunteerProfile(): Promise<VolunteerProfile> {
  return toProfile(await api<ProfileApi>("/me/profile"));
}

const LANGUAGES = ["English", "Bahasa Malaysia", "Mandarin", "Tamil"];

export async function getProfileOptions(): Promise<ProfileOptions> {
  const skills = await api<{ skill_name: string }[]>("/skills");
  return {
    skills: skills.map((s) => s.skill_name),
    languages: LANGUAGES,
    interests: Object.values(INTEREST_LABEL),
    frequencies: ["Once a month", "2–4 times a month", "Every week", "Occasionally"],
    preferredTimes: ["Weekend mornings", "Weekend afternoons", "Weekday evenings", "Flexible"],
    states: ["Selangor", "Kuala Lumpur", "Negeri Sembilan", "Penang", "Johor", "Perak"],
    distancesKm: [5, 10, 15, 25, 50],
  };
}

/** Saves the profile. Skills the database does not know yet (typed in by the volunteer) are skipped and returned. */
export async function saveVolunteerProfile(profile: VolunteerProfile): Promise<{ profile: VolunteerProfile; skipped: string[] }> {
  const [current, catalogue] = await Promise.all([
    api<ProfileApi>("/me/profile"),
    api<{ skill_id: number; skill_name: string }[]>("/skills"),
  ]);
  const byName = new Map(catalogue.map((s) => [s.skill_name.toLowerCase(), s.skill_id]));
  const existingSkill = new Map(current.skills.map((s) => [s.skill_id, s]));
  const skipped: string[] = [];
  const skills = profile.skills.flatMap((name) => {
    const id = byName.get(name.toLowerCase());
    if (id === undefined) {
      skipped.push(name);
      return [];
    }
    const keep = existingSkill.get(id);
    return [{ skill_id: id, proficiency_level: keep?.proficiency_level ?? 3, years_experience: keep?.years_experience ?? null }];
  });
  const existingLanguage = new Map(current.languages.map((l) => [l.language.toLowerCase(), l.proficiency]));
  const existingQualification = new Map(current.qualifications.map((q) => [q.title.toLowerCase(), q]));
  const qualifications = profile.qualifications
    .split(/[,\n]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((title) => {
      const keep = existingQualification.get(title.toLowerCase());
      return { title, issuer: keep?.issuer ?? null, year_obtained: keep?.year_obtained ?? null, expiry_date: keep?.expiry_date ?? null };
    });

  const saved = await api<ProfileApi>("/me/profile", {
    method: "PUT",
    json: {
      full_name: profile.fullName.trim() || undefined,
      phone: profile.phone.trim() || null,
      city: profile.area.trim() || null,
      state: profile.state || null,
      max_travel_km: profile.maxDistanceKm,
      experience_summary: profile.experience.trim() || null,
      skills,
      interests: profile.interests.flatMap((l) => (INTEREST_CODE[l] ? [INTEREST_CODE[l]] : [])),
      languages: profile.languages.map((language) => ({ language, proficiency: existingLanguage.get(language.toLowerCase()) ?? "conversational" })),
      qualifications,
      availability: rowsFromSlots(profile.availability),
    },
  });
  writeExtras({ frequency: profile.frequency, preferredTime: profile.preferredTime });
  return { profile: toProfile(saved), skipped };
}
