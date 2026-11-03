import { Navbar } from "@/components/volunteer/Navbar";
import { VolunteerGate, VolunteerProvider } from "@/components/volunteer/VolunteerProvider";

export default function VolunteerLayout({ children }: { children: React.ReactNode }) {
  return (
    <VolunteerProvider>
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <VolunteerGate>{children}</VolunteerGate>
      </main>
    </VolunteerProvider>
  );
}
