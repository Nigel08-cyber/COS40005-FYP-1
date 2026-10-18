import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { Placeholder } from "@/components/ui/Card";
import { Logo } from "@/components/ui/Logo";

export const metadata: Metadata = { title: "Log in · VolunteerHub" };

const highlights = [
  "AI-assisted matching to projects that fit your skills",
  "Check in with a QR code and track your hours",
  "Earn certificates for your contribution",
];

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <section className="relative flex flex-col justify-center gap-6 bg-canvas px-8 py-16 sm:px-14 lg:px-20">
        <Link
          href="/"
          className="group absolute left-6 top-6 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted hover:bg-surface hover:text-ink sm:left-10"
        >
          <span aria-hidden className="transition-transform duration-200 group-hover:-translate-x-0.5">
            ←
          </span>
          Back to cover &amp; index
        </Link>
        <Logo href="/" large />
        <h1 className="text-4xl font-bold leading-tight tracking-tight text-ink sm:text-5xl">
          Volunteer smarter.
          <br />
          Match faster.
        </h1>
        <p className="max-w-md text-sm leading-relaxed text-ink-soft">
          One platform for NGOs and community groups to recruit, match, assign and track volunteers.
        </p>
        <ul className="space-y-3">
          {highlights.map((text) => (
            <li key={text} className="flex items-center gap-3 text-sm text-ink-soft">
              <span className="size-4 shrink-0 rounded bg-line-strong/70" aria-hidden />
              {text}
            </li>
          ))}
        </ul>
        <Placeholder label="Illustration placeholder" className="mt-2 hidden h-56 max-w-md lg:flex" />
      </section>

      <section className="flex items-center justify-center bg-surface px-4 py-12">
        <AuthCard />
      </section>
    </div>
  );
}
