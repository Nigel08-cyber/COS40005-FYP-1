"use client";

import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ApplicationReview } from "@/components/staff/ApplicationReview";
import type { ApplicationsData } from "@/lib/staffTypes";

/**
 * /ngo/volunteers and /coordinator/applications · every application to the user's projects,
 * with search (name, email, skill, #ID), status tabs, a project filter and Approve / Reject.
 */
export function ApplicationsPage({ data }: { data: ApplicationsData }) {
  const isNgo = data.scope === "ngo";
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={isNgo ? "Volunteers" : "Applications"}
        subtitle={
          isNgo
            ? "Volunteers who applied to your organisation's projects. Approve them so they can register for sessions."
            : "Volunteers who applied to the projects you coordinate."
        }
      />
      <Card className="p-5">
        <ApplicationReview
          applications={data.applications}
          projects={data.projects}
          empty={
            data.projects.length
              ? "No volunteers have applied yet."
              : isNgo
                ? "Publish a project to start receiving applications."
                : "No projects are assigned to you yet. Your NGO administrator assigns coordinators to projects."
          }
        />
      </Card>
    </div>
  );
}
