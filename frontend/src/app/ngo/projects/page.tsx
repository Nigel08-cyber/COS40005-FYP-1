import type { Metadata } from "next";
import { ProjectsOverview } from "@/components/ngo/ProjectsOverview";
import { getCurrentNgoAdmin, getMyProjects, getProjectDrafts } from "@/lib/api/ngo";

export const metadata: Metadata = { title: "Projects · VolunteerHub" };

export default async function ProjectsPage() {
  const [admin, projects, drafts] = await Promise.all([getCurrentNgoAdmin(), getMyProjects(), getProjectDrafts()]);
  return <ProjectsOverview organisation={admin.organisation} projects={projects} drafts={drafts} />;
}
