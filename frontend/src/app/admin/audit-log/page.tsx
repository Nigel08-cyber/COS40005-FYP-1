import type { Metadata } from "next";
import { AdminAuditLogView } from "@/components/admin/views";

export const metadata: Metadata = { title: "Audit log · VolunteerHub" };

// Content is loaded client-side (the access token lives in memory), so there is nothing to validate for instant navigation.
export const instant = false;

export default function Page() {
  return <AdminAuditLogView />;
}
