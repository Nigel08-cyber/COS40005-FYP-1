import { StaffShell, type StaffLink } from "@/components/staff/StaffShell";

// Links without href have no wireframe or backend API yet and are shown as "coming soon".
const links: StaffLink[] = [
  { label: "Overview" },
  { label: "Users", href: "/admin/users" },
  { label: "Organisations", href: "/admin/organisations" },
  { label: "Audit log" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <StaffShell allowedRoles={["system_admin"]} homeHref="/admin/organisations" topLinks={links} sideTitle="Platform" sideLinks={links}>
      {children}
    </StaffShell>
  );
}
