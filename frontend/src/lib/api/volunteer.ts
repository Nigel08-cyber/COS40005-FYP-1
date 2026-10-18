/*
  Data access for the volunteer pages.
  Pages and components only call these functions. Right now they return fake data;
  when the backend is ready, replace each body with a real request and delete src/lib/fake/.
*/
import { opportunitiesFake } from "@/lib/fake/opportunitiesFake";
import type { VolunteerProfile } from "@/lib/types";
import {
  applicationsFake,
  certificatesFake,
  contributionHistoryFake,
  monthlyHoursFake,
  pastActivitiesFake,
  profileOptionsFake,
  saveVolunteerProfileFake,
  skillsContributedFake,
  todayFake,
  volunteerFake,
  volunteerProfileFake,
  volunteerStatsFake,
} from "@/lib/fake/volunteerFake";

export async function getCurrentVolunteer() {
  return volunteerFake;
}

export async function getOpportunities() {
  return opportunitiesFake;
}

export async function getOpportunity(id: string) {
  return opportunitiesFake.find((o) => o.id === id) ?? null;
}

export async function getMyApplications() {
  return applicationsFake;
}

export async function getVolunteerStats() {
  return volunteerStatsFake;
}

export async function getContributionHistory() {
  return contributionHistoryFake;
}

export async function getMonthlyHours() {
  return monthlyHoursFake;
}

export async function getSkillsContributed() {
  return skillsContributedFake;
}

export async function getCertificates() {
  return certificatesFake;
}

export async function getPastActivities() {
  return pastActivitiesFake;
}

/** Today's date as "YYYY-MM-DD". Replace with the real date once real data is used. */
export function getToday() {
  return todayFake;
}

export async function getVolunteerProfile() {
  return volunteerProfileFake;
}

export async function getProfileOptions() {
  return profileOptionsFake;
}

/** Currently calls the FAKE save (nothing is stored) — replace with the real API call. */
export async function saveVolunteerProfile(profile: VolunteerProfile) {
  return saveVolunteerProfileFake(profile);
}
