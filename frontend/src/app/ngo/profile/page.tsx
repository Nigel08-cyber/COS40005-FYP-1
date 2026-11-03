import type { Metadata } from "next";
import { OrgProfileForm } from "@/components/ngo/OrgProfileForm";
import { getOrgProfile, getOrgProfileOptions } from "@/lib/api/ngo";

export const metadata: Metadata = { title: "Organisation profile · VolunteerHub" };

export default async function OrgProfilePage() {
  const [profile, options] = await Promise.all([getOrgProfile(), getOrgProfileOptions()]);
  return <OrgProfileForm initialProfile={profile} options={options} />;
}
