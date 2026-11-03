"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { DataView } from "@/components/volunteer/DataView";
import { MyActivities } from "@/components/volunteer/MyActivities";
import { getOpportunities, getPastActivities, getToday } from "@/lib/api/volunteer";

export function ActivitiesView() {
  return (
    <>
      <PageHeader title="My activities" subtitle="Your upcoming activities, applications and past participation." />
      <DataView load={() => Promise.all([getOpportunities(), getPastActivities()])}>
        {([opportunities, past]) => <MyActivities opportunities={opportunities} past={past} today={getToday()} />}
      </DataView>
    </>
  );
}
