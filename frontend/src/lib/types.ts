export type Role = "volunteer" | "ngo_admin";

export type Category =
  | "Food distribution"
  | "Education"
  | "Environment"
  | "Fundraising"
  | "Disaster assistance"
  | "Health";

export type Language = "English" | "Bahasa Malaysia" | "Mandarin" | "Tamil";

/** The volunteer's relationship to an opportunity. "none" = not applied yet. */
export type ApplicationStatus = "none" | "pending" | "approved" | "registered" | "waitlisted";

export interface Volunteer {
  id: string;
  fullName: string;
  firstName: string;
  initials: string;
  email: string;
  roleLabel: string;
}

export interface Opportunity {
  id: string;
  title: string;
  organisation: string;
  organisationInitials: string;
  category: Category;
  /** Local (Malaysia) time, "YYYY-MM-DDTHH:mm" */
  start: string;
  end: string;
  area: string;
  state: string;
  address: string;
  distanceKm: number;
  skills: string[];
  volunteersNeeded: number;
  /** Registered volunteers, not counting the signed-in volunteer */
  volunteersRegisteredOthers: number;
  /** AI match score for the signed-in volunteer, if the AI suggested it */
  matchPercent?: number;
  matchReasons?: string[];
  summary: string;
  tasks: string[];
  preferredAvailability: string;
  languages: Language[];
  experience: string;
}

export interface Application {
  opportunityId: string;
  status: Exclude<ApplicationStatus, "none">;
}

export interface VolunteerStats {
  totalHours: number;
  hoursThisMonth: number;
  projectsCompleted: number;
  upcomingThisWeek: number;
  skillsContributed: number;
  skillsPreview: string;
  certificates: number;
  certificatesReady: number;
}

export interface ContributionRecord {
  id: string;
  activity: string;
  date: string;
  hours: number;
  role: string;
}

export interface MonthlyHours {
  month: string;
  hours: number;
}

export interface Certificate {
  id: string;
  title: string;
  status: "ready" | "issued";
  issuedOn?: string;
}

export interface PastActivity {
  id: string;
  title: string;
  date: string;
  area: string;
  hours: number;
  role: string;
}

export type DayPart = "Morning" | "Afternoon" | "Evening";
export type Weekday = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
/** An availability cell, e.g. "Sat-Morning" */
export type AvailabilitySlot = `${Weekday}-${DayPart}`;

export interface VolunteerProfile {
  fullName: string;
  email: string;
  phone: string;
  photoName: string;
  skills: string[];
  qualifications: string;
  languages: string[];
  interests: string[];
  availability: AvailabilitySlot[];
  frequency: string;
  preferredTime: string;
  state: string;
  area: string;
  maxDistanceKm: number;
  experience: string;
}

/** The pick-lists shown on the profile form (chips and dropdowns). */
export interface ProfileOptions {
  skills: string[];
  languages: string[];
  interests: string[];
  frequencies: string[];
  preferredTimes: string[];
  states: string[];
  distancesKm: number[];
}
