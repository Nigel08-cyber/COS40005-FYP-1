import { StaffShell, type StaffLink } from "@/components/staff/StaffShell";

// Links without href have no wireframe yet and are shown as "coming soon".
const topLinks: StaffLink[] = [
  { label: "Dashboard", href: "/ngo/dashboard" },
  { label: "Projects", href: "/ngo/projects" },
  { label: "Volunteers", href: "/ngo/volunteers" },
  { label: "Reports" },
];

const sideLinks: StaffLink[] = [
  { label: "Dashboard", href: "/ngo/dashboard" },
  { label: "Projects", href: "/ngo/projects" },
  { label: "Volunteers", href: "/ngo/volunteers" },
  { label: "AI recommendations" },
  { label: "Reports" },
  { label: "Team", href: "/ngo/team" },
  { label: "Organisation profile", href: "/ngo/profile" },
];

export default function NgoLayout({ children }: { children: React.ReactNode }) {
  return (
    <StaffShell
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
