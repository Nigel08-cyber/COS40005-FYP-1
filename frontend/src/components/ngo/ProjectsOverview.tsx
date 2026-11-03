"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import type { ProjectDraftItem, ProjectListItem } from "@/lib/staffTypes";
import { DraftTable, ProjectTable } from "./ProjectTables";

type Filter = "all" | "upcoming" | "completed";

/** /ngo/projects · the organisation's projects, a "Create new project" button and unpublished drafts. */
export function ProjectsOverview({
  organisation,
  projects,
  drafts,
}: {
  organisation: string;
  projects: ProjectListItem[];
  drafts: ProjectDraftItem[];
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const upcoming = projects.filter((p) => !p.completed).sort((a, b) => a.date.localeCompare(b.date));
  const completed = projects.filter((p) => p.completed).sort((a, b) => b.date.localeCompare(a.date));
  const rows = filter === "upcoming" ? upcoming : filter === "completed" ? completed : [...upcoming, ...completed];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Projects"
        subtitle={`Projects created by ${organisation}`}
        actions={
          <Button href="/ngo/projects/new" variant="primary">
            + Create new project
          </Button>
        }
      />

      <Card className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <CardTitle>Your projects</CardTitle>
            <p className="text-xs text-muted">Click a project to see its details</p>
          </div>
          <Tabs
            id="ngo-projects"
            items={[
              { value: "all", label: `All (${projects.length})` },
              { value: "upcoming", label: `Upcoming (${upcoming.length})` },
              { value: "completed", label: `Completed (${completed.length})` },
            ]}
            value={filter}
            onChange={setFilter}
          />
        </div>
        <div className="mt-4">
          <ProjectTable
            rows={rows}
            empty={filter === "completed" ? "No completed projects yet." : "No projects yet. Create your first one."}
          />
        </div>
      </Card>

      <Card className="mt-6 p-5">
        <div className="flex items-center gap-2">
          <CardTitle>Drafts</CardTitle>
          <Badge>{drafts.length}</Badge>
        </div>
        <p className="text-xs text-muted">Saved but not published yet. Volunteers cannot see these.</p>
        <div className="mt-4">
          <DraftTable drafts={drafts} />
        </div>
      </Card>
    </div>
  );
}
