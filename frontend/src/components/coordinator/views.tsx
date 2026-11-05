"use client";

/* Page bodies for the Project Coordinator pages: each loads its data in the browser (the access token lives there). */
import { ApplicationsPage } from "@/components/staff/ApplicationsPage";
import { ProjectDetails, ProjectNotFound } from "@/components/staff/ProjectDetails";
import { DataView } from "@/components/volunteer/DataView";
import { getApplications, getCoordinatedProjects, getProjectDetail } from "@/lib/api/projects";
import { MyProjects } from "./MyProjects";

export function MyProjectsView() {
  return <DataView load={getCoordinatedProjects}>{(data) => <MyProjects data={data} />}</DataView>;
}

export function CoordinatorProjectView({ id }: { id: string }) {
  return (
    <DataView load={() => getProjectDetail(id, "coordinator")}>
      {(data) => (data.project ? <ProjectDetails data={data} /> : <ProjectNotFound backHref="/coordinator/projects" />)}
    </DataView>
  );
}

export function CoordinatorApplicationsView() {
  return <DataView load={() => getApplications("coordinator")}>{(data) => <ApplicationsPage data={data} />}</DataView>;
}
