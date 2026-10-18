import { Navbar } from "@/components/volunteer/Navbar";
import { VolunteerProvider } from "@/components/volunteer/VolunteerProvider";
import { getCurrentVolunteer, getMyApplications } from "@/lib/api/volunteer";

export default async function VolunteerLayout({ children }: { children: React.ReactNode }) {
  const [volunteer, applications] = await Promise.all([getCurrentVolunteer(), getMyApplications()]);

  return (
    <VolunteerProvider volunteer={volunteer} initialApplications={applications}>
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
    </VolunteerProvider>
  );
}
