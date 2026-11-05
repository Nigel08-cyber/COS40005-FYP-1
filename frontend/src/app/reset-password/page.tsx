import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { ResetPassword } from "@/components/auth/PasswordReset";

export const metadata: Metadata = { title: "Set a new password · VolunteerHub" };

export default function Page() {
  return (
    <AuthLayout>
      <ResetPassword />
    </AuthLayout>
  );
}
