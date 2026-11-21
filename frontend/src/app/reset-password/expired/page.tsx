import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { ResetLinkExpired } from "@/components/auth/PasswordReset";

export const metadata: Metadata = { title: "Reset link expired · Tandem" };

export default function Page() {
  return (
    <AuthLayout>
      <ResetLinkExpired />
    </AuthLayout>
  );
}
