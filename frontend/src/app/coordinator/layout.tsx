import { StaffShell, type StaffLink } from "@/components/staff/StaffShell";
import { getCurrentCoordinator } from "@/lib/api/coordinator";

// Links without href have no wireframe yet and are shown as "coming soon".
const topLinks: StaffLink[] = [
  { label: "Dashboard" },
  { label: "My projects" },
  { label: "Volunteers" },
  { label: "Attendance", href: "/coordinator/attendance" },
];

const sideLinks: StaffLink[] = [
  { label: "Dashboard" },
  { label: "My projects" },
  { label: "Volunteers" },
  { label: "Applications" },
  { label: "Attendance", href: "/coordinator/attendance" },
  { label: "Feedback" },
];

export default async function CoordinatorLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentCoordinator();
  return (
    <StaffShell
      user={user}
      allowedRoles={["project_coordinator", "ngo_admin", "system_admin"]}
      homeHref="/coordinator/attendance"
      topLinks={topLinks}
      sideTitle="Coordinator"
      sideLinks={sideLinks}
    >
      {children}
    </StaffShell>
  );
}
