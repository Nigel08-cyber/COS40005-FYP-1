import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { BrowseOpportunities } from "@/components/volunteer/BrowseOpportunities";
import { getOpportunities, getToday } from "@/lib/api/volunteer";

export const metadata: Metadata = { title: "Browse opportunities · VolunteerHub" };

export default async function OpportunitiesPage() {
  const opportunities = await getOpportunities();

  return (
    <>
      <PageHeader
        title="Browse opportunities"
        subtitle="Find volunteer activities that match your skills, interests and availability."
      />
      <BrowseOpportunities opportunities={opportunities} today={getToday()} />
    </>
  );
}
