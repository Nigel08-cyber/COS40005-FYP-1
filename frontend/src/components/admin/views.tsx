"use client";

/* Page bodies for the System Administrator pages: each loads its data in the browser (the access token lives there). */
import { DataView } from "@/components/volunteer/DataView";
import { getAdminOrganisations, getAdminUsers, getAuditPeople } from "@/lib/api/admin";
import { AuditLogPage } from "./AuditLogPage";
import { OrganisationsPage } from "./OrganisationsPage";
import { UsersPage } from "./UsersPage";

export function AdminAuditLogView() {
  return <DataView load={getAuditPeople}>{(people) => <AuditLogPage people={people} />}</DataView>;
}

export function AdminOrganisationsView() {
  return <DataView load={getAdminOrganisations}>{(data) => <OrganisationsPage data={data} />}</DataView>;
}

export function AdminUsersView() {
  return <DataView load={getAdminUsers}>{(data) => <UsersPage data={data} />}</DataView>;
}
