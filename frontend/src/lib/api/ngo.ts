/*
  Data access for the NGO Administrator pages (wireframes 10, 12, 13 and the projects list).
  Pages and components only call these functions. Right now they return FAKE data from
  src/lib/fake/ngoFake.ts; when the backend is ready, replace each body with a real request.
*/
import {
  likelyMatchesFake,
  myProjectsFake,
  ngoAdminFake,
  ngoDashboardFake,
  orgProfileFake,
  orgProfileOptionsFake,
  projectDraftsFake,
  projectDraftFake,
  projectFormOptionsFake,
  saveOrgProfileFake,
  saveProjectFake,
} from "@/lib/fake/ngoFake";
import type { OrgProfile, ProjectDraft } from "@/lib/staffTypes";

export async function getCurrentNgoAdmin() {
  return ngoAdminFake;
}

export async function getOrgProfile() {
  return orgProfileFake;
}

export async function getOrgProfileOptions() {
  return orgProfileOptionsFake;
}

/** Currently calls the FAKE save (nothing is stored) — replace with the real API call. */
export async function saveOrgProfile(profile: OrgProfile, mode: "draft" | "final") {
  return saveOrgProfileFake(profile, mode);
}

export async function getProjectFormOptions() {
  return projectFormOptionsFake;
}

/** Starting values for the "Create a project" form. */
export async function getNewProjectDraft() {
  return projectDraftFake;
}

/** AI preview of matching volunteers for a draft project. */
export async function getLikelyMatches() {
  return likelyMatchesFake;
}

/** Currently calls the FAKE save (nothing is stored) — replace with the real API call. */
export async function saveProject(project: ProjectDraft, mode: "draft" | "publish") {
  return saveProjectFake(project, mode);
}

export async function getNgoDashboard() {
  return ngoDashboardFake;
}

/** Projects this NGO Administrator's organisation has published. */
export async function getMyProjects() {
  return myProjectsFake;
}

/** Projects saved as draft and not published yet. */
export async function getProjectDrafts() {
  return projectDraftsFake;
}
