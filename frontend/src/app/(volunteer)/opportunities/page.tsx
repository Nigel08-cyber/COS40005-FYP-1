import type { Metadata } from "next";
import { OpportunitiesView } from "@/components/volunteer/views/OpportunitiesView";

export const metadata: Metadata = { title: "Browse opportunities · VolunteerHub" };

// Content is loaded client-side behind VolunteerGate (the access token lives in memory), so there is nothing to validate for instant navigation.
export const instant = false;

export default function Page() {
  return <OpportunitiesView />;
}
