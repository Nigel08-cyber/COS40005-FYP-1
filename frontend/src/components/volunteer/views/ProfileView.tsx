"use client";

import { DataView } from "@/components/volunteer/DataView";
import { ProfileForm } from "@/components/volunteer/ProfileForm";
import { getContributionHistory, getProfileOptions, getVolunteerProfile } from "@/lib/api/volunteer";

export function ProfileView() {
  return (
    <DataView load={() => Promise.all([getVolunteerProfile(), getProfileOptions(), getContributionHistory()])}>
      {([profile, options, history]) => <ProfileForm initialProfile={profile} options={options} history={history} />}
    </DataView>
  );
}
