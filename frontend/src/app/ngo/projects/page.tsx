import type { Metadata } from "next";
import { ProjectsView } from "@/components/ngo/views";

export const metadata: Metadata = { title: "Projects · VolunteerHub" };

// Content is loaded client-side (the access token lives in memory), so there is nothing to validate for instant navigation.
export const instant = false;

export default function Page() {
  return <ProjectsView />;
}
