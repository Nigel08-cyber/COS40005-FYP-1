import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard, AuthCardFromUrl } from "@/components/auth/AuthCard";
import { AuthLayout } from "@/components/auth/AuthLayout";

export const metadata: Metadata = { title: "Log in · Tandem" };

const highlights = [
  "AI-assisted matching to projects that fit your skills",
  "Check in with a QR code and track your hours",
  "Earn certificates for your contribution",
];

export default function LoginPage() {
  return (
    <AuthLayout highlights={highlights} backToCover>
      {/* ?mode=login is read in the browser */}
      <Suspense fallback={<AuthCard />}>
        <AuthCardFromUrl />
      </Suspense>
    </AuthLayout>
  );
}
