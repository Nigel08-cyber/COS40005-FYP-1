import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { cx } from "@/lib/format";

export const metadata: Metadata = { title: "VolunteerHub · Community Volunteer & NGO Management Platform" };

// Wireframe 00 – Cover & index. `href` is set for screens that are already built.
const screens: { no: string; title: string; href?: string }[] = [
  { no: "09", title: "Volunteer registration / profile", href: "/login" },
  { no: "10", title: "NGO / organisation profile creation" },
  { no: "11", title: "Browse opportunities · details · my activities", href: "/opportunities" },
  { no: "12", title: "Project / event creation" },
  { no: "13", title: "NGO dashboard (+ AI analytics)" },
  { no: "14", title: "Volunteer dashboard", href: "/dashboard" },
  { no: "15", title: "Attendance / QR check-in flow" },
  { no: "16", title: "Admin panel" },
];

const roles = [
  { title: "Volunteer", screens: "Screens: 9, 11, 14, 15 (mobile)" },
  { title: "NGO Administrator", screens: "Screens: 10, 12, 13" },
  { title: "Project Coordinator", screens: "Screens: 15 (QR & attendance), applications" },
  { title: "System Administrator", screens: "Screens: 16" },
];

const conventions = [
  { tone: "brand", label: "AI recommendation (suggest only)" },
  { tone: "success", label: "Success / approved / checked in" },
  { tone: "warning", label: "Pending / warning / skills gap" },
  { tone: "danger", label: "Error / full / suspended" },
  { tone: "neutral", label: "Neutral tag" },
] as const;

export default function CoverPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-5xl rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-10">
        <Logo href="/" large />

        <h1 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">
          Community Volunteer &amp; NGO Management Platform
        </h1>
        <p className="mt-2 text-sm text-muted">
          Low-fidelity wireframes · POC-003 · COS 40005 Group 14 · Part A, Sprint 2 (backlog items 9–16)
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_1fr_1fr]">
          <section>
            <h2 className="mb-3 text-sm font-semibold">Screens</h2>
            <ul className="space-y-1">
              {screens.map((s) => {
                const inner = (
                  <>
                    <span
                      className={cx(
                        "inline-flex h-5 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-medium",
                        s.href ? "bg-brand-soft text-brand" : "bg-canvas text-muted",
                      )}
                    >
                      {s.no}
                    </span>
                    <span className="flex-1">{s.title}</span>
                    {s.href ? (
                      <span className="text-brand opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100">
                        →
                      </span>
                    ) : (
                      <span className="text-[10px] text-faint">Soon</span>
                    )}
                  </>
                );
                return (
                  <li key={s.no}>
                    {s.href ? (
                      <Link
                        href={s.href}
                        className="group flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-ink-soft hover:bg-brand-soft/60 hover:text-ink"
                      >
                        {inner}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 px-2 py-1.5 text-sm text-muted">{inner}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="rounded-xl border border-line p-4">
            <h2 className="mb-3 text-sm font-semibold">User roles</h2>
            <dl className="space-y-3">
              {roles.map((r) => (
                <div key={r.title}>
                  <dt className="text-sm font-medium">{r.title}</dt>
                  <dd className="text-xs text-muted">{r.screens}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="rounded-xl border border-line p-4">
            <h2 className="mb-3 text-sm font-semibold">Conventions</h2>
            <div className="flex flex-col items-start gap-2">
              {conventions.map((c) => (
                <Badge key={c.label} tone={c.tone}>
                  {c.label}
                </Badge>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">Grey boxes are placeholders for images, maps and QR codes.</p>
          </section>
        </div>

        <p className="mt-8 border-t border-line pt-6 text-xs leading-relaxed text-muted">
          Design principle: the AI recommends, the NGO decides. Every recommendation is shown with its reason and must be
          approved or modified by a coordinator. Desktop frames are 1440 px wide; the QR check-in flow is designed
          mobile-first (390 px) because volunteers scan on their phones.
        </p>

        <div className="mt-8 flex justify-center">
          <Button href="/login" variant="primary" size="lg" className="px-8">
            Log in / Registration
            <span aria-hidden>→</span>
          </Button>
        </div>
      </div>
    </main>
  );
}
