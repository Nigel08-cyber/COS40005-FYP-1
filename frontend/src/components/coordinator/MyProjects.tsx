"use client";

import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProjectTable } from "@/components/ngo/ProjectTables";
import type { CoordinatorProjectsData } from "@/lib/staffTypes";

/** /coordinator/projects · published projects the signed-in user coordinates (GET /me/coordinated-projects). */
export function MyProjects({ data }: { data: CoordinatorProjectsData }) {
  const byDate = (a: { date: string }, b: { date: string }) => (a.date || "9999").localeCompare(b.date || "9999");
  const active = data.projects.filter((p) => p.state === "active").sort(byDate);
  const past = data.projects.filter((p) => p.state !== "active").sort((a, b) => byDate(b, a));
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="My projects" subtitle="Projects you coordinate. Open one to review applications and see its sessions." />
      <Card className="p-5">
        <ProjectTable
          rows={[...active, ...past]}
          basePath="/coordinator/projects"
          empty="No projects are assigned to you yet. Your NGO administrator assigns coordinators to projects."
        />
      </Card>
    </div>
  );
}
