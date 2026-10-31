import type { Metadata } from "next";
import { ProjectForm } from "@/components/ngo/ProjectForm";
import { getLikelyMatches, getNewProjectDraft, getProjectFormOptions } from "@/lib/api/ngo";

export const metadata: Metadata = { title: "Create a project · VolunteerHub" };

export default async function NewProjectPage() {
  const [draft, options, matches] = await Promise.all([
    getNewProjectDraft(),
    getProjectFormOptions(),
    getLikelyMatches(),
  ]);
  return <ProjectForm initialDraft={draft} options={options} matches={matches} />;
}
