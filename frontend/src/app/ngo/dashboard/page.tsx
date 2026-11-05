import type { Metadata } from "next";
import { NgoDashboardView } from "@/components/ngo/views";

export const metadata: Metadata = { title: "NGO dashboard · VolunteerHub" };

// Content is loaded client-side (the access token lives in memory), so there is nothing to validate for instant navigation.
export const instant = false;

export default function Page() {
  return <NgoDashboardView />;
}
