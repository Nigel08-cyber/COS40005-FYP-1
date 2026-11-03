import type { Metadata } from "next";
import { ProfileView } from "@/components/volunteer/views/ProfileView";

export const metadata: Metadata = { title: "Your volunteer profile · VolunteerHub" };

// Content is loaded client-side behind VolunteerGate (the access token lives in memory), so there is nothing to validate for instant navigation.
export const instant = false;

export default function Page() {
  return <ProfileView />;
}
