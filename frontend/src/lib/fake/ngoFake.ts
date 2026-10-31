// FAKE DATA — remove when the backend is connected (see ./README.md)
// NGO Administrator pages: organisation profile (10), projects list, project creation (12), dashboard (13).
import type {
  LikelyMatches,
  NgoDashboardData,
  OrgProfile,
  OrgProfileOptions,
  ProjectDraft,
  ProjectDraftItem,
  ProjectFormOptions,
  ProjectListItem,
  StaffUser,
} from "@/lib/staffTypes";

export const ngoAdminFake: StaffUser = {
  fullName: "Mei Ling Tan",
  initials: "MLT",
  email: "meiling.fake@example.com",
  roleLabel: "NGO Administrator",
  organisation: "Harapan Community Kitchen",
};

// ---------- 10 · Organisation profile ----------

export const orgProfileFake: OrgProfile = {
  name: "Harapan Community Kitchen",
  type: "NGO / Charity / Community group",
  description: "",
  logoName: "",
  registrationNo: "",
  areasOfActivity: ["Food distribution", "Education", "Environmental", "Community outreach"],
  state: "Selangor",
  serviceAreas: ["Subang Jaya", "Petaling Jaya", "Shah Alam"],
  contactPerson: "Mei Ling Tan",
  email: "hello.fake@harapankitchen.org",
  phone: "",
  website: "",
  officeAddress: "No. 12, Jalan SS 15/4, Subang Jaya, Selangor",
  standingSkills: ["First Aid", "Logistics", "Food handling"],
  typicalVolunteers: "",
};

export const orgProfileOptionsFake: OrgProfileOptions = {
  types: ["NGO / Charity / Community group", "Religious organisation", "School / University club", "Social enterprise", "Government agency"],
  activities: [
    "Food distribution", "Education", "Environmental", "Community outreach", "Fundraising",
    "Disaster assistance", "Vulnerable communities", "Healthcare",
  ],
  states: ["Selangor", "Kuala Lumpur", "Negeri Sembilan", "Penang", "Johor", "Perak"],
  skills: ["First Aid", "Logistics", "Food handling", "Tutoring", "Driving"],
};

/** Pretends to save the organisation profile. Nothing is stored anywhere. */
export async function saveOrgProfileFake(profile: OrgProfile, mode: "draft" | "final") {
  await new Promise((r) => setTimeout(r, 600));
  return { ok: true as const, profile, mode };
}

// ---------- 12 · Project creation ----------

export const projectFormOptionsFake: ProjectFormOptions = {
  categories: ["Food distribution", "Education", "Environment", "Fundraising", "Disaster assistance", "Health"],
  coordinators: [
    { id: "coord-fake-1", name: "Daniel Lim" },
    { id: "coord-fake-2", name: "Priya Nair" },
    { id: "coord-fake-3", name: "Siti Aminah" },
  ],
  areas: ["Subang Jaya", "Petaling Jaya", "Shah Alam", "Kuala Lumpur", "Klang", "Port Dickson"],
  experienceLevels: ["No experience needed", "Some experience preferred", "Experienced volunteers only"],
  languages: ["English, Bahasa Malaysia", "English", "Bahasa Malaysia", "Mandarin", "Tamil", "Any language"],
  skills: ["Food handling", "Logistics", "Customer / community interaction", "First Aid", "Driving"],
  days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  times: [
    "06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00",
    "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00",
  ],
};

export const projectDraftFake: ProjectDraft = {
  title: "Community Food Distribution",
  category: "Food distribution",
  coordinatorId: "",
  description: "",
  date: "2026-10-17",
  startTime: "08:00",
  endTime: "13:00",
  repeatWeekly: false,
  venue: "Dewan Komuniti, SS 15, Subang Jaya",
  area: "Subang Jaya",
  volunteersRequired: "20",
  minExperience: "No experience needed",
  language: "English, Bahasa Malaysia",
  skills: ["Food handling", "Logistics", "Customer / community interaction"],
  preferredDay: "Saturday",
  preferredFrom: "08:00",
  preferredTo: "13:00",
  additionalRequirements: "",
  requireApproval: true,
  generateAiRecommendations: true,
};

export const likelyMatchesFake: LikelyMatches = {
  potentialCount: 34,
  top: [
    { label: "Volunteer A", reason: "Strong skills match" },
    { label: "Volunteer B", reason: "Availability & location match" },
    { label: "Volunteer C", reason: "Relevant previous experience" },
  ],
};

/** Pretends to save / publish a project. Nothing is stored anywhere. */
export async function saveProjectFake(project: ProjectDraft, mode: "draft" | "publish") {
  await new Promise((r) => setTimeout(r, 700));
  return { ok: true as const, id: "proj-fake-new", project, mode };
}

// ---------- 13 · NGO dashboard ----------

export const ngoDashboardFake: NgoDashboardData = {
  organisation: "Harapan Community Kitchen",
  period: "Last 30 days",
  volunteerStats: [
    { label: "Total volunteers", value: "248", note: "+12 vs last month", noteTone: "success" },
    { label: "Active volunteers", value: "132", note: "53% of total", noteTone: "muted" },
    { label: "New volunteers", value: "27", note: "this month", noteTone: "muted" },
    { label: "Returning volunteers", value: "105", note: "42% retention", noteTone: "muted" },
  ],
  projectStats: [
    { label: "Active projects", value: "6", note: "2 need volunteers", noteTone: "warning" },
    { label: "Upcoming projects", value: "4", note: "next: 17 Oct", noteTone: "muted" },
    { label: "Completed projects", value: "21", note: "all time", noteTone: "muted" },
  ],
  applicationsToReview: 8,
  aiRecommendationSetsReady: 2,
  requirements: [
    { project: "Food Distribution", registered: 16, needed: 20 },
    { project: "Community Tutoring", registered: 7, needed: 10 },
    { project: "Flood Relief Packing", registered: 12, needed: 25 },
    { project: "Health Screening", registered: 5, needed: 12 },
  ],
  skillsGap: [
    { skill: "First Aid", volunteersRequired: 3 },
    { skill: "Logistics", volunteersRequired: 5 },
    { skill: "Tutoring", volunteersRequired: 2 },
    { skill: "Driving", volunteersRequired: 1 },
  ],
  participationTrend: [
    { label: "W1", value: 46 },
    { label: "W2", value: 52 },
    { label: "W3", value: 44 },
    { label: "W4", value: 58 },
    { label: "W5", value: 55 },
    { label: "W6", value: 63 },
    { label: "W7", value: 71 },
    { label: "W8", value: 68 },
  ],
  peakParticipation: [
    { label: "Mon", value: 6 },
    { label: "Tue", value: 8 },
    { label: "Wed", value: 7 },
    { label: "Thu", value: 8 },
    { label: "Fri", value: 10 },
    { label: "Sat", value: 42 },
    { label: "Sun", value: 30 },
  ],
  requestedSkills: [
    { skill: "Logistics", percent: 82 },
    { skill: "Food handling", percent: 70 },
    { skill: "First Aid", percent: 48 },
    { skill: "Tutoring", percent: 35 },
  ],
  insights: [
    { tag: "AI Insight", text: "The organisation frequently requires volunteers with logistics skills." },
    { tag: "AI Insight", text: "Weekend community projects have higher volunteer participation." },
    {
      tag: "AI Insight · Retention",
      text: "68% of volunteers returned within 60 days. Popular categories: Food distribution, Education.",
    },
  ],
  upcomingProjects: [
    { id: "proj-fake-1", project: "Community Food Distribution", coordinator: "Daniel Lim", date: "2026-10-17", registered: 16, needed: 20 },
    { id: "proj-fake-2", project: "Weekend Tutoring Programme", coordinator: "Priya Nair", date: "2026-10-24", registered: 7, needed: 10 },
    { id: "proj-fake-3", project: "Flood Relief Packing Day", coordinator: "Daniel Lim", date: "2026-10-31", registered: 12, needed: 25 },
    { id: "proj-fake-4", project: "Community Health Screening", coordinator: "Siti Aminah", date: "2026-11-01", registered: 5, needed: 12 },
  ],
};

// ---------- Projects list (/ngo/projects) ----------

export const myProjectsFake: ProjectListItem[] = [
  { id: "proj-fake-1", title: "Community Food Distribution", coordinator: "Daniel Lim", date: "2026-10-17", registered: 16, needed: 20, completed: false },
  { id: "proj-fake-2", title: "Weekend Tutoring Programme", coordinator: "Priya Nair", date: "2026-10-24", registered: 7, needed: 10, completed: false },
  { id: "proj-fake-3", title: "Flood Relief Packing Day", coordinator: "Daniel Lim", date: "2026-10-31", registered: 12, needed: 25, completed: false },
  { id: "proj-fake-4", title: "Community Health Screening", coordinator: "Siti Aminah", date: "2026-11-01", registered: 5, needed: 12, completed: false },
  { id: "proj-fake-5", title: "Food Bank Sorting Shift", coordinator: "Daniel Lim", date: "2026-11-05", registered: 6, needed: 10, completed: false },
  { id: "proj-fake-6", title: "Charity Fun Run Marshal", coordinator: "Priya Nair", date: "2026-11-08", registered: 21, needed: 40, completed: false },
  { id: "proj-fake-7", title: "Back-to-School Book Drive", coordinator: "Siti Aminah", date: "2026-09-27", registered: 18, needed: 18, completed: true },
  { id: "proj-fake-8", title: "Ramadan Meal Packing", coordinator: "Daniel Lim", date: "2026-09-13", registered: 30, needed: 30, completed: true },
];

export const projectDraftsFake: ProjectDraftItem[] = [
  {
    id: "draft-fake-1",
    title: "Senior Home Visit",
    category: "Health",
    date: "2026-11-15",
    lastEdited: "2026-10-28",
    missing: ["Project coordinator"],
  },
  {
    id: "draft-fake-2",
    title: "Mangrove Replanting",
    category: "Environment",
    date: "",
    lastEdited: "2026-10-25",
    missing: ["Date", "Venue / address"],
  },
  {
    id: "draft-fake-3",
    title: "Untitled project",
    category: "Education",
    date: "",
    lastEdited: "2026-10-20",
    missing: ["Project title", "Date", "Project coordinator", "Volunteers required"],
  },
];
