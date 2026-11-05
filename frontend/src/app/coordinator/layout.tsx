import { StaffShell, type StaffLink } from "@/components/staff/StaffShell";

// Links without href have no wireframe yet and are shown as "coming soon".
const topLinks: StaffLink[] = [
  { label: "Dashboard" },
  { label: "My projects", href: "/coordinator/projects" },
  { label: "Applications", href: "/coordinator/applications" },
  { label: "Attendance", href: "/coordinator/attendance" },
];

const sideLinks: StaffLink[] = [
  { label: "Dashboard" },
  { label: "My projects", href: "/coordinator/projects" },
  { label: "Applications", href: "/coordinator/applications" },
  { label: "Attendance", href: "/coordinator/attendance" },
  { label: "Feedback" },
];

export default function CoordinatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <StaffShell
      allowedRoles={["project_coordinator", "ngo_admin", "system_admin"]}
      homeHref="/coordinator/projects"
      topLinks={topLinks}
      sideTitle="Coordinator"
      sideLinks={sideLinks}
    >
      {children}
    </StaffShell>
  );
}
