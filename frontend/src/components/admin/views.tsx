"use client";

/* Page bodies for the System Administrator pages: each loads its data in the browser (the access token lives there). */
import { DataView } from "@/components/volunteer/DataView";
import { getAdminOrganisations, getAdminUsers } from "@/lib/api/admin";
import { OrganisationsPage } from "./OrganisationsPage";
import { UsersPage } from "./UsersPage";

export function AdminOrganisationsView() {
  return <DataView load={getAdminOrganisations}>{(data) => <OrganisationsPage data={data} />}</DataView>;
}

export function AdminUsersView() {
  return <DataView load={getAdminUsers}>{(data) => <UsersPage data={data} />}</DataView>;
}
