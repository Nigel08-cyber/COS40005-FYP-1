import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { MyActivities } from "@/components/volunteer/MyActivities";
import { getOpportunities, getPastActivities, getToday } from "@/lib/api/volunteer";

export const metadata: Metadata = { title: "My activities · VolunteerHub" };

export default async function ActivitiesPage() {
  const [opportunities, past] = await Promise.all([getOpportunities(), getPastActivities()]);

  return (
    <>
      <PageHeader
        title="My activities"
        subtitle="Your upcoming activities, applications and past participation."
      />
      <MyActivities opportunities={opportunities} past={past} today={getToday()} />
    </>
  );
}
