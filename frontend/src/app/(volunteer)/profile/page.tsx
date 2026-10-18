import type { Metadata } from "next";
import { ProfileForm } from "@/components/volunteer/ProfileForm";
import { getContributionHistory, getProfileOptions, getVolunteerProfile } from "@/lib/api/volunteer";

export const metadata: Metadata = { title: "Your volunteer profile · VolunteerHub" };

export default async function ProfilePage() {
  const [profile, options, history] = await Promise.all([
    getVolunteerProfile(),
    getProfileOptions(),
    getContributionHistory(),
  ]);

  return <ProfileForm initialProfile={profile} options={options} history={history} />;
}
