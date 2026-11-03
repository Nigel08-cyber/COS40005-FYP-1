import type { Metadata } from "next";
import { DashboardView } from "@/components/volunteer/views/DashboardView";

export const metadata: Metadata = { title: "Dashboard · VolunteerHub" };

// Content is loaded client-side behind VolunteerGate (the access token lives in memory), so there is nothing to validate for instant navigation.
export const instant = false;

export default function Page() {
  return <DashboardView />;
}
