import type { Metadata } from "next";
import { NgoDashboard } from "@/components/ngo/NgoDashboard";
import { getNgoDashboard } from "@/lib/api/ngo";

export const metadata: Metadata = { title: "NGO dashboard · VolunteerHub" };

export default async function NgoDashboardPage() {
  const data = await getNgoDashboard();
  return <NgoDashboard data={data} />;
}
