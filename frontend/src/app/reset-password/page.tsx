import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { ResetLinkChecking, ResetPassword } from "@/components/auth/PasswordReset";

export const metadata: Metadata = { title: "Set a new password · VolunteerHub" };

export default function Page() {
  return (
    <AuthLayout>
      {/* The token comes from the URL (?token=...), so that part renders in the browser */}
      <Suspense fallback={<ResetLinkChecking />}>
        <ResetPassword />
      </Suspense>
    </AuthLayout>
  );
}
