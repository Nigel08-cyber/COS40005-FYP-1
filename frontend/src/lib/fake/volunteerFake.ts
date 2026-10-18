// FAKE DATA — remove when the backend is connected (see ./README.md)
import type {
  Application,
  Certificate,
  ContributionRecord,
  MonthlyHours,
  PastActivity,
  ProfileOptions,
  VolunteerProfile,
  Volunteer,
  VolunteerStats,
} from "@/lib/types";

export const volunteerFake: Volunteer = {
  id: "vol-fake-001",
  fullName: "Aisha Rahman",
  firstName: "Aisha",
  initials: "AR",
  email: "aisha.fake@example.com",
  roleLabel: "Volunteer",
};

export const applicationsFake: Application[] = [
  { opportunityId: "opp-fake-002", status: "pending" },
  { opportunityId: "opp-fake-004", status: "approved" },
  { opportunityId: "opp-fake-005", status: "registered" },
  { opportunityId: "opp-fake-001", status: "registered" },
];

export const volunteerStatsFake: VolunteerStats = {
  totalHours: 42,
  hoursThisMonth: 6,
  projectsCompleted: 8,
  upcomingThisWeek: 1,
  skillsContributed: 5,
  skillsPreview: "Logistics, Tutoring, +3",
  certificates: 2,
  certificatesReady: 1,
};

export const contributionHistoryFake: ContributionRecord[] = [
  { id: "c-fake-1", activity: "Food Distribution", date: "15 Oct", hours: 5, role: "Logistics" },
  { id: "c-fake-2", activity: "Beach Cleanup", date: "20 Oct", hours: 4, role: "Volunteer" },
  { id: "c-fake-3", activity: "Tutoring Programme", date: "25 Oct", hours: 3, role: "Tutor" },
];

export const monthlyHoursFake: MonthlyHours[] = [
  { month: "May", hours: 4 },
  { month: "Jun", hours: 5 },
  { month: "Jul", hours: 4.5 },
  { month: "Aug", hours: 7 },
  { month: "Sep", hours: 6.5 },
  { month: "Oct", hours: 11 },
];

export const skillsContributedFake: string[] = [
  "Logistics",
  "Tutoring",
  "Food handling",
  "Customer interaction",
  "First Aid",
];

export const certificatesFake: Certificate[] = [
  { id: "cert-fake-1", title: "Volunteer Certificate · 40+ hours", status: "ready" },
  { id: "cert-fake-2", title: "Food Distribution Champion", status: "issued", issuedOn: "Issued 23 Sep" },
];

export const pastActivitiesFake: PastActivity[] = [
  { id: "past-fake-1", title: "Food Distribution", date: "2026-10-15", area: "Subang Jaya", hours: 5, role: "Logistics" },
  { id: "past-fake-2", title: "Beach Cleanup", date: "2026-09-20", area: "Port Dickson", hours: 4, role: "Volunteer" },
  { id: "past-fake-3", title: "Tutoring Programme", date: "2026-08-25", area: "Petaling Jaya", hours: 3, role: "Tutor" },
];

/** The fake "today" used for date filters, so the design's October dates stay upcoming. */
export const todayFake = "2026-10-16";

export const volunteerProfileFake: VolunteerProfile = {
  fullName: "Aisha Rahman",
  email: "aisha.fake@example.com",
  phone: "+60 12-345 6789",
  photoName: "",
  skills: ["Food handling", "Logistics", "First Aid", "Community interaction"],
  qualifications: "",
  languages: ["English", "Bahasa Malaysia"],
  interests: ["Food distribution", "Environment", "Community outreach"],
  availability: ["Sat-Morning", "Sun-Morning", "Sat-Afternoon", "Wed-Evening"],
  frequency: "2–4 times a month",
  preferredTime: "Weekend mornings",
  state: "Selangor",
  area: "Subang Jaya",
  maxDistanceKm: 15,
  experience: "",
};

export const profileOptionsFake: ProfileOptions = {
  skills: [
    "Food handling", "Logistics", "First Aid", "Community interaction", "Tutoring",
    "Childcare", "Event setup", "Driving", "Translation",
  ],
  languages: ["English", "Bahasa Malaysia", "Mandarin", "Tamil"],
  interests: [
    "Food distribution", "Environment", "Community outreach", "Education", "Fundraising",
    "Disaster assistance", "Support for vulnerable communities", "Healthcare",
  ],
  frequencies: ["Once a month", "2–4 times a month", "Every week", "Occasionally"],
  preferredTimes: ["Weekend mornings", "Weekend afternoons", "Weekday evenings", "Flexible"],
  states: ["Selangor", "Kuala Lumpur", "Negeri Sembilan", "Penang", "Johor", "Perak"],
  distancesKm: [5, 10, 15, 25, 50],
};

/** Pretends to save the profile. Nothing is stored anywhere. */
export async function saveVolunteerProfileFake(profile: VolunteerProfile) {
  await new Promise((r) => setTimeout(r, 600));
  return { ok: true as const, profile };
}
