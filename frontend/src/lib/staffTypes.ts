/*
  Data shapes for the NGO Administrator and Project Coordinator pages
  (wireframes 10, 12, 13 and 15a). src/lib/api/ngo.ts maps the backend's responses to these.
*/

export interface StaffUser {
  fullName: string;
  initials: string;
  email: string;
  roleLabel: string;
  organisation: string;
}

export type NgoStatus = "pending" | "active" | "suspended";

// ---------- 10 · Organisation profile ----------

export interface OrgProfile {
  name: string;
  /** Not stored by the backend yet */
  type: string;
  description: string;
  /** Not stored by the backend yet (no upload endpoint) */
  logoName: string;
  /** Required when the organisation is created; cannot be changed afterwards */
  registrationNo: string;
  areasOfActivity: string[];
  state: string;
  serviceAreas: string[];
  /** Not stored by the backend yet */
  contactPerson: string;
  email: string;
  phone: string;
  website: string;
  officeAddress: string;
  /** Not stored by the backend yet */
  standingSkills: string[];
  /** Not stored by the backend yet */
  typicalVolunteers: string;
}

export interface OrgProfileOptions {
  types: string[];
  activities: string[];
  states: string[];
  skills: string[];
}

/** The signed-in admin's organisation, or null when they have not created one yet. */
export interface OrgProfileData {
  ngoId: number | null;
  status: NgoStatus | null;
  profile: OrgProfile;
}

// ---------- 12 · Project creation ----------

export interface Coordinator {
  /** backend user_id */
  id: string;
  name: string;
}

export interface ProjectDraft {
  title: string;
  /** Category label, e.g. "Food distribution" */
  category: string;
  coordinatorId: string;
  description: string;
  /** "YYYY-MM-DD" */
  date: string;
  /** "HH:mm" */
  startTime: string;
  endTime: string;
  /** Not stored by the backend yet */
  repeatWeekly: boolean;
  venue: string;
  area: string;
  volunteersRequired: string;
  /** Label from EXPERIENCE_LEVELS */
  minExperience: string;
  /** Not stored by the backend yet */
  language: string;
  /** Skill names (from GET /skills) */
  skills: string[];
  preferredDay: string;
  preferredFrom: string;
  preferredTo: string;
  /** Not stored by the backend yet */
  additionalRequirements: string;
  /** Not stored by the backend yet */
  requireApproval: boolean;
  /** Not stored by the backend yet */
  generateAiRecommendations: boolean;
}

export interface ProjectFormOptions {
  categories: string[];
  coordinators: Coordinator[];
  areas: string[];
  experienceLevels: string[];
  languages: string[];
  skills: string[];
  days: string[];
  /** "HH:mm" values offered in the time dropdowns */
  times: string[];
}

export interface ProjectFormData {
  ngoId: number | null;
  status: NgoStatus | null;
  draft: ProjectDraft;
  options: ProjectFormOptions;
  /** Set when editing a saved project (draft or published) instead of creating a new one */
  existing: ExistingProject | null;
}

export interface ExistingProject {
  projectId: string;
  status: "draft" | "active" | "completed" | "cancelled";
  /** The session that is updated when the date / time / venue change (null = none yet) */
  eventId: number | null;
  /** Coordinator saved on the project, to know whether it changed */
  coordinatorId: string;
}

// ---------- Projects list (/ngo/projects) ----------

export type ProjectState = "active" | "completed" | "cancelled";

export interface ProjectListItem {
  id: string;
  title: string;
  coordinator: string;
  /** "YYYY-MM-DD" of the next session (or the project start); empty when not set */
  date: string;
  registered: number;
  needed: number | null;
  state: ProjectState;
}

export interface ProjectDraftItem {
  id: string;
  title: string;
  category: string;
  /** "YYYY-MM-DD", empty when not chosen yet */
  date: string;
  /** "YYYY-MM-DD" the draft was created */
  created: string;
  /** Required fields that are still empty */
  missing: string[];
}

export interface ProjectsData {
  ngoId: number | null;
  status: NgoStatus | null;
  organisation: string;
  projects: ProjectListItem[];
  drafts: ProjectDraftItem[];
}

// ---------- 13 · NGO dashboard ----------

export interface StatTile {
  label: string;
  /** null = the backend does not provide this number yet */
  value: string | null;
  note: string;
  noteTone?: "success" | "warning" | "muted";
}

export interface ProjectRequirement {
  project: string;
  approved: number;
  needed: number | null;
}

export interface SkillGap {
  skill: string;
  volunteersRequired: number;
}

export interface NgoDashboardData {
  ngoId: number | null;
  status: NgoStatus | null;
  organisation: string;
  volunteerStats: StatTile[];
  projectStats: StatTile[];
  applicationsToReview: number;
  requirements: ProjectRequirement[];
  skillsGap: SkillGap[];
  upcomingProjects: ProjectListItem[];
}

// ---------- 15a · Attendance (Project Coordinator) ----------

export type AttendanceStatus = "checked_in" | "checked_out" | "not_arrived";

export interface AttendanceRecord {
  id: string;
  volunteer: string;
  role: string;
  /** "HH:mm" */
  checkIn?: string;
  checkOut?: string;
  status: AttendanceStatus;
}

export interface AttendanceEvent {
  id: string;
  title: string;
  /** Local Malaysia time, "YYYY-MM-DDTHH:mm" */
  start: string;
  end: string;
  area: string;
  expectedVolunteers: number;
  /** How long one QR token is valid before it rotates */
  qrRefreshSeconds: number;
}

// ---------- Project details, applications and team (NGO Administrator + Project Coordinator) ----------

export type ProjectStatus = "draft" | ProjectState;
export type ApplicationStatus = "pending" | "approved" | "rejected" | "withdrawn";

export interface ApplicationItem {
  id: number;
  projectId: string;
  projectTitle: string;
  volunteerId: number;
  /** Volunteer's name, or "Volunteer #12" while the backend does not send names */
  volunteer: string;
  /** False while the backend only sends the volunteer's user id */
  hasName: boolean;
  email: string | null;
  /** null = not provided by the backend */
  skills: string[] | null;
  /** "YYYY-MM-DD" (Malaysia), null when not provided */
  appliedOn: string | null;
  status: ApplicationStatus;
  decidedBy: string | null;
  /** "YYYY-MM-DD" (Malaysia) */
  decidedOn: string | null;
  note: string | null;
}

export interface SessionItem {
  id: number;
  title: string;
  /** Malaysia local time, "YYYY-MM-DDTHH:mm" */
  start: string;
  end: string;
  venue: string;
  capacity: number | null;
  registered: number;
  waitlisted: number;
  status: string;
}

export interface ProjectDetail {
  id: string;
  title: string;
  description: string;
  category: string;
  status: ProjectStatus;
  location: string;
  /** "YYYY-MM-DD", empty when not set */
  date: string;
  coordinatorId: string;
  coordinator: string;
  volunteersNeeded: number | null;
  minExperience: string;
  preferredAvailability: string;
  skills: string[];
  /** "YYYY-MM-DD" */
  created: string;
}

/** Who is looking at the project decides which actions are offered. */
export type StaffScope = "ngo" | "coordinator";

export interface ProjectDetailData {
  scope: StaffScope;
  ngoStatus: NgoStatus | null;
  /** null = not found, or not a project of the user's organisation */
  project: ProjectDetail | null;
  sessions: SessionItem[];
  applications: ApplicationItem[];
  coordinators: Coordinator[];
  /** Only NGO admins may link a different coordinator (PUT /projects/{id}/coordinator) */
  canAssignCoordinator: boolean;
}

export interface ApplicationsData {
  scope: StaffScope;
  /** Projects the list can be filtered by */
  projects: { id: string; title: string }[];
  applications: ApplicationItem[];
  /** null = the user has no organisation (NGO) */
  ngoId: number | null;
}

export interface MemberItem {
  userId: number;
  name: string;
  email: string;
  role: "ngo_admin" | "coordinator";
  isYou: boolean;
}

export interface TeamData {
  ngoId: number | null;
  organisation: string;
  members: MemberItem[];
}

export interface CoordinatorProjectsData {
  projects: ProjectListItem[];
}

// ---------- 16 · Admin panel (System Administrator) ----------

export interface AdminOrganisation {
  id: number;
  name: string;
  registrationNo: string;
  status: NgoStatus;
  /** Name of the first NGO administrator, "—" when none */
  administrator: string;
  projects: number;
  /** Approved volunteers across the organisation's projects */
  volunteers: number;
  hoursThisMonth: number;
  description: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  state: string;
  focusAreas: string;
}

export interface AdminOrganisationsData {
  organisations: AdminOrganisation[];
  activeProjects: number;
}

/** Effective roles, in the backend's vocabulary (GET /users → roles[]) */
export type AdminUserRole = "system_admin" | "ngo_admin" | "project_coordinator" | "volunteer";
export type AccountStatus = "active" | "suspended" | "deactivated";

export interface AdminUser {
  userId: number;
  name: string;
  email: string;
  /** Every role the account has, highest first */
  roles: AdminUserRole[];
  /** Names of the organisations the user belongs to (empty for volunteers) */
  organisations: string[];
  status: AccountStatus;
  /** "YYYY-MM-DD" (Malaysia) the account was created */
  joined: string;
  /** The signed-in admin (cannot suspend themselves) */
  isYou: boolean;
}

export interface AdminUsersData {
  users: AdminUser[];
  organisations: string[];
}
