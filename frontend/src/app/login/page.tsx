import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthLayout } from "@/components/auth/AuthLayout";

export const metadata: Metadata = { title: "Log in · VolunteerHub" };

const highlights = [
  "AI-assisted matching to projects that fit your skills",
  "Check in with a QR code and track your hours",
  "Earn certificates for your contribution",
];

export default function LoginPage() {
  return (
    <AuthLayout highlights={highlights} backToCover>
      <AuthCard />
    </AuthLayout>
  );
}
