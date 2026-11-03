"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { BrowseOpportunities } from "@/components/volunteer/BrowseOpportunities";
import { DataView } from "@/components/volunteer/DataView";
import { getOpportunities, getToday } from "@/lib/api/volunteer";

export function OpportunitiesView() {
  return (
    <>
      <PageHeader
        title="Browse opportunities"
        subtitle="Find volunteer activities that match your skills, interests and availability."
      />
      <DataView load={getOpportunities}>
        {(opportunities) => <BrowseOpportunities opportunities={opportunities} today={getToday()} />}
      </DataView>
    </>
  );
}
