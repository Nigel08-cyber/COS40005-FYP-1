import type { Metadata } from "next";
import { ActivitiesView } from "@/components/volunteer/views/ActivitiesView";

export const metadata: Metadata = { title: "My activities · VolunteerHub" };

// Content is loaded client-side behind VolunteerGate (the access token lives in memory), so there is nothing to validate for instant navigation.
export const instant = false;

export default function Page() {
  return <ActivitiesView />;
}
