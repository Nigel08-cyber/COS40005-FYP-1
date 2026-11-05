import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { ForgotPassword } from "@/components/auth/PasswordReset";

export const metadata: Metadata = { title: "Reset your password · VolunteerHub" };

export default function Page() {
  return (
    <AuthLayout>
      <ForgotPassword />
    </AuthLayout>
  );
}
