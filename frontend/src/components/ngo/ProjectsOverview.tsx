"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { ApprovalBanner } from "@/components/staff/StaffNotices";
import type { ProjectsData } from "@/lib/staffTypes";
import { DraftTable, ProjectTable } from "./ProjectTables";

type Filter = "all" | "active" | "past";

/** /ngo/projects · the organisation's projects, a "Create new project" button and unpublished drafts. */
export function ProjectsOverview({ data }: { data: ProjectsData }) {
  const [filter, setFilter] = useState<Filter>("all");
  const byDate = (a: { date: string }, b: { date: string }) => (a.date || "9999").localeCompare(b.date || "9999");
  const active = data.projects.filter((p) => p.state === "active").sort(byDate);
  const past = data.projects.filter((p) => p.state !== "active").sort((a, b) => byDate(b, a));
  const rows = filter === "active" ? active : filter === "past" ? past : [...active, ...past];
  const canCreate = data.status === "active";

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Projects"
        subtitle={`Projects created by ${data.organisation}`}
        actions={
          canCreate ? (
            <Button href="/ngo/projects/new" variant="primary">
              + Create new project
            </Button>
          ) : (
            <Button variant="primary" disabled title="Your organisation needs to be approved first">
              + Create new project
            </Button>
          )
        }
      />
      <ApprovalBanner status={data.status} />

      <Card className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <CardTitle>Your projects</CardTitle>
            <p className="text-xs text-muted">Click a project to see its details</p>
          </div>
          <Tabs
            id="ngo-projects"
            items={[
              { value: "all", label: `All (${data.projects.length})` },
              { value: "active", label: `Active (${active.length})` },
              { value: "past", label: `Completed / cancelled (${past.length})` },
            ]}
            value={filter}
            onChange={setFilter}
          />
        </div>
        <div className="mt-4">
          <ProjectTable
            rows={rows}
            empty={filter === "past" ? "No completed or cancelled projects yet." : "No published projects yet. Create your first one."}
          />
        </div>
      </Card>

      <Card className="mt-6 p-5">
        <div className="flex items-center gap-2">
          <CardTitle>Drafts</CardTitle>
          <Badge>{data.drafts.length}</Badge>
        </div>
        <p className="text-xs text-muted">Saved but not published yet. Volunteers cannot see these.</p>
        <div className="mt-4">
          <DraftTable drafts={data.drafts} />
        </div>
      </Card>
    </div>
  );
}
