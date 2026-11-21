/* Fixed pick-lists for the NGO forms (not data from the database). */

/** Backend category codes (schemas.py → Category) and the labels the screens show. */
export const CATEGORIES: { code: string; label: string }[] = [
  { code: "food_aid", label: "Food distribution" },
  { code: "education", label: "Education" },
  { code: "environment", label: "Environment" },
  { code: "health", label: "Health" },
  { code: "community", label: "Community outreach" },
  { code: "disaster_relief", label: "Disaster assistance" },
  { code: "fundraising", label: "Fundraising" },
];

export const ORG_TYPES = [
  "NGO / Charity / Community group",
  "Religious organisation",
  "School / University club",
  "Social enterprise",
  "Government agency",
];

/** Stored in the backend's `focus_areas` as a comma-separated list. */
export const ORG_ACTIVITIES = [
  "Food distribution",
  "Education",
  "Environmental",
  "Community outreach",
  "Fundraising",
  "Disaster assistance",
  "Vulnerable communities",
  "Healthcare",
];

export const STATES = [
  "Selangor", "Kuala Lumpur", "Putrajaya", "Negeri Sembilan", "Melaka", "Johor", "Pahang", "Perak",
  "Penang", "Kedah", "Perlis", "Kelantan", "Terengganu", "Sabah", "Sarawak", "Labuan",
];

/** Standing requirements on the organisation profile (not stored by the backend yet). */
export const STANDING_SKILLS = ["First Aid", "Logistics", "Food handling", "Tutoring", "Driving"];

export const AREAS = ["Subang Jaya", "Petaling Jaya", "Shah Alam", "Kuala Lumpur", "Klang", "Port Dickson"];

/** Backend `min_experience_years` for each option. */
export const EXPERIENCE_LEVELS: { label: string; years: number | null }[] = [
  { label: "No experience needed", years: null },
  { label: "At least 1 year", years: 1 },
  { label: "At least 2 years", years: 2 },
  { label: "At least 3 years", years: 3 },
];

export const LANGUAGES = ["English, Bahasa Malaysia", "English", "Bahasa Malaysia", "Mandarin", "Tamil", "Any language"];

/** Index + 1 is the backend's `preferred_day` (1 = Monday .. 7 = Sunday). */
export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** Session start / end times: every hour of the day, 12:00 AM to 11:00 PM. */
export const SESSION_TIMES = Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, "0")}:00`);

