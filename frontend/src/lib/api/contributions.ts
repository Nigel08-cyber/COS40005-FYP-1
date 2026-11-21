/*
  Staff review of volunteer hours (backend/app/routers/contributions.py). A QR check-out creates a verified
  contribution; rejected hours no longer count in the volunteer's totals.
*/
import { api } from "@/lib/api/http";

export type ContributionStatus = "pending" | "verified" | "rejected";

export interface StaffContribution {
  contribution_id: number;
  volunteer_name: string;
  role: string | null;
  hours: number;
  contribution_date: string;
  status: ContributionStatus;
}

export const getProjectContributions = (projectId: string) =>
  api<StaffContribution[]>(`/projects/${projectId}/contributions`);

export const setContributionStatus = (id: number, status: "verified" | "rejected") =>
  api<StaffContribution>(`/contributions/${id}`, { method: "PATCH", json: { status } });
