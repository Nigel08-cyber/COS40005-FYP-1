"use client";

/* Page bodies for the NGO pages: each loads its data in the browser (the access token lives there). */
import { ApplicationsPage } from "@/components/staff/ApplicationsPage";
import { ProjectDetails, ProjectNotFound } from "@/components/staff/ProjectDetails";
import { NoOrganisationCard } from "@/components/staff/StaffNotices";
import { DataView } from "@/components/volunteer/DataView";
import { getNgoDashboard, getOrgProfile, getOrgProfileOptions, getProjectFormData, getProjectsData } from "@/lib/api/ngo";
import { getApplications, getProjectDetail, getTeam } from "@/lib/api/projects";
import { NgoDashboard } from "./NgoDashboard";
import { OrgProfileForm } from "./OrgProfileForm";
import { ProjectForm } from "./ProjectForm";
import { ProjectsOverview } from "./ProjectsOverview";
import { TeamPage } from "./TeamPage";

export function OrgProfileView() {
  return <DataView load={getOrgProfile}>{(data) => <OrgProfileForm data={data} options={getOrgProfileOptions()} />}</DataView>;
}

export function ProjectsView() {
  return (
    <DataView load={getProjectsData}>{(data) => (data.ngoId === null ? <NoOrganisationCard /> : <ProjectsOverview data={data} />)}</DataView>
  );
}

export function NewProjectView() {
  return (
    <DataView load={() => getProjectFormData()}>{(data) => (data.ngoId === null ? <NoOrganisationCard /> : <ProjectForm data={data} />)}</DataView>
  );
}

export function NgoDashboardView() {
  return (
    <DataView load={getNgoDashboard}>{(data) => (data.ngoId === null ? <NoOrganisationCard /> : <NgoDashboard data={data} />)}</DataView>
  );
}

export function NgoProjectView({ id }: { id: string }) {
  return (
    <DataView load={() => getProjectDetail(id, "ngo")}>
      {(data) => (data.project ? <ProjectDetails data={data} /> : <ProjectNotFound backHref="/ngo/projects" />)}
    </DataView>
  );
}

export function EditProjectView({ id }: { id: string }) {
  return (
    <DataView load={() => getProjectFormData(id)}>
      {(data) =>
        data.ngoId === null ? (
          <NoOrganisationCard />
        ) : data.notFound ? (
          <ProjectNotFound backHref="/ngo/projects" />
        ) : (
          <ProjectForm data={data} />
        )
      }
    </DataView>
  );
}

export function NgoVolunteersView() {
  return (
    <DataView load={() => getApplications("ngo")}>
      {(data) => (data.ngoId === null ? <NoOrganisationCard /> : <ApplicationsPage data={data} />)}
    </DataView>
  );
}

export function TeamView() {
  return <DataView load={getTeam}>{(data) => (data.ngoId === null ? <NoOrganisationCard /> : <TeamPage data={data} />)}</DataView>;
}
