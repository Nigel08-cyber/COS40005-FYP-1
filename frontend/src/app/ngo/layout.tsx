import { StaffShell, type StaffLink } from "@/components/staff/StaffShell";
import { getCurrentNgoAdmin } from "@/lib/api/ngo";

// Links without href have no wireframe yet and are shown as "coming soon".
const topLinks: StaffLink[] = [
  { label: "Dashboard", href: "/ngo/dashboard" },
  { label: "Projects", href: "/ngo/projects" },
  { label: "Volunteers" },
  { label: "Reports" },
];

const sideLinks: StaffLink[] = [
  { label: "Dashboard", href: "/ngo/dashboard" },
  { label: "Projects", href: "/ngo/projects" },
  { label: "Volunteers" },
  { label: "AI recommendations" },
  { label: "Reports" },
  { label: "Organisation profile", href: "/ngo/profile" },
];

export default async function NgoLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentNgoAdmin();
  return (
    <StaffShell
      user={user}
      allowedRoles={["ngo_admin", "system_admin"]}
      homeHref="/ngo/dashboard"
      topLinks={topLinks}
      sideTitle="Organisation"
      sideLinks={sideLinks}
    >
      {children}
    </StaffShell>
  );
}
