/*
  Data shapes for the NGO Administrator and Project Coordinator pages
  (wireframes 10, 12, 13 and 15a). These are the "contract" the backend should return.
*/

export interface StaffUser {
  fullName: string;
  initials: string;
  email: string;
  roleLabel: string;
  organisation: string;
}

// ---------- 10 · Organisation profile ----------

export interface OrgProfile {
  name: string;
  type: string;
  description: string;
  logoName: string;
  registrationNo: string;
  areasOfActivity: string[];
  state: string;
  serviceAreas: string[];
  contactPerson: string;
  email: string;
  phone: string;
  website: string;
  officeAddress: string;
  standingSkills: string[];
  typicalVolunteers: string;
}

export interface OrgProfileOptions {
  types: string[];
  activities: string[];
  states: string[];
  skills: string[];
}

// ---------- 12 · Project creation ----------

export interface Coordinator {
  id: string;
  name: string;
}

export interface ProjectDraft {
  title: string;
  category: string;
  coordinatorId: string;
  description: string;
  /** "YYYY-MM-DD" */
  date: string;
  /** "HH:mm" */
  startTime: string;
  endTime: string;
  repeatWeekly: boolean;
  venue: string;
  area: string;
  volunteersRequired: string;
  minExperience: string;
  language: string;
  skills: string[];
  preferredDay: string;
  preferredFrom: string;
  preferredTo: string;
  additionalRequirements: string;
  requireApproval: boolean;
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

export interface LikelyMatch {
  label: string;
  reason: string;
}

export interface LikelyMatches {
  potentialCount: number;
  top: LikelyMatch[];
}

// ---------- Projects list (/ngo/projects) ----------

export interface ProjectListItem {
  id: string;
  title: string;
  coordinator: string;
  /** "YYYY-MM-DD" */
  date: string;
  registered: number;
  needed: number;
  completed: boolean;
}

export interface ProjectDraftItem {
  id: string;
  title: string;
  category: string;
  /** "YYYY-MM-DD", empty when not chosen yet */
  date: string;
  /** "YYYY-MM-DD" */
  lastEdited: string;
  /** Required fields that are still empty */
  missing: string[];
}

// ---------- 13 · NGO dashboard ----------

export interface StatTile {
  label: string;
  value: string;
  note: string;
  noteTone?: "success" | "warning" | "muted";
}

export interface ProjectRequirement {
  project: string;
  registered: number;
  needed: number;
}

export interface SkillGap {
  skill: string;
  volunteersRequired: number;
}

export interface ChartPoint {
  label: string;
  value: number;
}

export interface SkillShare {
  skill: string;
  percent: number;
}

export interface AiInsight {
  tag: string;
  text: string;
}

export interface UpcomingProject {
  id: string;
  project: string;
  coordinator: string;
  /** "YYYY-MM-DD" */
  date: string;
  registered: number;
  needed: number;
}

export interface NgoDashboardData {
  organisation: string;
  period: string;
  volunteerStats: StatTile[];
  projectStats: StatTile[];
  applicationsToReview: number;
  aiRecommendationSetsReady: number;
  requirements: ProjectRequirement[];
  skillsGap: SkillGap[];
  participationTrend: ChartPoint[];
  peakParticipation: ChartPoint[];
  requestedSkills: SkillShare[];
  insights: AiInsight[];
  upcomingProjects: UpcomingProject[];
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
