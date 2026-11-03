"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { cx, daysBetween, formatShortDate, formatTime } from "@/lib/format";
import type { Certificate, ContributionRecord, MonthlyHours, Opportunity } from "@/lib/types";
import { CHECK_IN_WINDOW_DAYS } from "./MyActivities";
import { useVolunteer } from "./VolunteerProvider";

/** "Welcome back, <first name>" using the signed-in account. */
export function WelcomeHeader() {
  const { volunteer } = useVolunteer();
  return (
    <PageHeader
      title={volunteer.firstName ? `Welcome back, ${volunteer.firstName}` : "Welcome back"}
      subtitle="Here is your volunteer impact so far."
    />
  );
}

const UPCOMING_LIMIT = 2;
const RECOMMENDED_LIMIT = 2;

export function UpcomingCard({ opportunities, today }: { opportunities: Opportunity[]; today: string }) {
  const { statusOf, notify } = useVolunteer();
  const upcoming = opportunities
    .filter((o) => statusOf(o.id) === "registered")
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, UPCOMING_LIMIT);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <CardTitle>Upcoming activities</CardTitle>
        <Link href="/activities" className="group rounded text-xs font-medium text-brand hover:text-brand-hover">
          View all{" "}
          <span className="inline-block transition-transform duration-200 group-hover:translate-x-0.5">→</span>
        </Link>
      </div>
      <div className="mt-3 divide-y divide-line">
        <AnimatePresence initial={false}>
          {upcoming.map((o) => {
            const canCheckIn = daysBetween(today, o.start) <= CHECK_IN_WINDOW_DAYS;
            return (
              <motion.div
                key={o.id}
                layout
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="text-sm font-semibold">{o.title}</p>
                  <p className="text-xs text-muted">
                    {formatShortDate(o.start)} · {formatTime(o.start)} · {o.area}
                  </p>
                </div>
                {canCheckIn ? (
                  <Button variant="brand" onClick={() => notify("QR check-in will be added in a later sprint.")}>
                    Check in (QR)
                  </Button>
                ) : (
                  <Button href={`/opportunities/${o.id}`} variant="outline">
                    View details
                  </Button>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
        {upcoming.length === 0 && <p className="py-4 text-sm text-muted">No registered activities yet.</p>}
      </div>
    </Card>
  );
}

export function ContributionHistory({ records }: { records: ContributionRecord[] }) {
  const { notify } = useVolunteer();
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardTitle>Contribution history</CardTitle>
          <p className="text-xs text-muted">Activity · Date · Hours · Role</p>
        </div>
        <Button variant="outline" onClick={() => notify("Summary download will be available once data is connected.")}>
          Download summary
        </Button>
      </div>
      <div className="mt-4 overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-left text-sm">
          <thead className="bg-canvas text-xs text-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">Activity</th>
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5 font-medium">Hours</th>
              <th className="px-4 py-2.5 font-medium">Role</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {records.map((r) => (
              <tr key={r.id} className="transition-colors duration-200 hover:bg-brand-soft/50">
                <td className="px-4 py-2.5">{r.activity}</td>
                <td className="px-4 py-2.5 text-ink-soft">{r.date}</td>
                <td className="px-4 py-2.5 text-ink-soft">{r.hours}</td>
                <td className="px-4 py-2.5 text-ink-soft">{r.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/** Single-series bar chart. The current (last) month is emphasised; hover shows the value. */
export function HoursChart({ data }: { data: MonthlyHours[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.hours));

  return (
    <Card className="p-5">
      <CardTitle>Hours volunteered per month</CardTitle>
      <div className="mt-4 flex h-40 items-end gap-2" role="list" aria-label="Hours volunteered per month">
        {data.map((d, i) => {
          const current = i === data.length - 1;
          const active = hovered === i;
          return (
            <div
              key={d.month}
              role="listitem"
              aria-label={`${d.month}: ${d.hours} hours`}
              tabIndex={0}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(i)}
              onBlur={() => setHovered(null)}
              className="relative flex h-full flex-1 items-end rounded-t outline-none"
            >
              <AnimatePresence>
                {active && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4, transition: { duration: 0.1 } }}
                    transition={{ duration: 0.15 }}
                    className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs text-white shadow-lg"
                    style={{ bottom: `calc(${(d.hours / max) * 100}% + 6px)` }}
                  >
                    {d.hours} hrs
                  </motion.div>
                )}
              </AnimatePresence>
              <motion.div
                className={cx(
                  "w-full rounded-t transition-colors duration-200",
                  current ? "bg-brand" : active ? "bg-brand/70" : "bg-brand-bar",
                )}
                initial={{ height: 0 }}
                animate={{ height: `${(d.hours / max) * 100}%` }}
                transition={{ duration: 0.8, delay: i * 0.06 }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2 border-t border-line pt-2">
        {data.map((d) => (
          <span key={d.month} className="flex-1 text-center text-xs text-muted">
            {d.month}
          </span>
        ))}
      </div>
    </Card>
  );
}

export function RecommendedCard({ opportunities }: { opportunities: Opportunity[] }) {
  const { statusOf, act } = useVolunteer();
  const suggestions = opportunities
    .filter((o) => o.matchPercent !== undefined && statusOf(o.id) === "none")
    .sort((a, b) => (b.matchPercent ?? 0) - (a.matchPercent ?? 0))
    .slice(0, RECOMMENDED_LIMIT);

  return (
    <Card tone="brand" className="p-5">
      <p className="text-sm font-semibold">Recommended for you</p>
      <p className="text-xs text-muted">AI suggestions based on your profile</p>
      <div className="mt-3 space-y-3">
        <AnimatePresence mode="popLayout" initial={false}>
          {suggestions.map((o) => (
            <motion.div
              key={o.id}
              layout
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, x: 24, transition: { duration: 0.2 } }}
              className="rounded-lg border border-line bg-surface p-3 transition-shadow duration-300 hover:shadow-md hover:shadow-brand/10"
            >
              <p className="text-sm font-semibold">{o.title}</p>
              <p className="text-xs text-muted">
                {o.matchPercent}% match · {o.matchReasons?.[0]}
              </p>
              <div className="mt-2.5 flex gap-2">
                <Button variant="brand" size="sm" onClick={() => act(o.id, "apply")}>
                  Accept
                </Button>
                <Button href={`/opportunities/${o.id}`} variant="outline" size="sm">
                  View
                </Button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {suggestions.length === 0 && (
          <p className="text-xs text-muted">You have responded to all current suggestions.</p>
        )}
      </div>
      <p className="mt-3 text-[11px] text-muted">Suggestions only. The NGO coordinator makes the final assignment.</p>
    </Card>
  );
}

export function CertificatesCard({ certificates }: { certificates: Certificate[] }) {
  const { notify } = useVolunteer();
  const [generated, setGenerated] = useState<string[]>([]);

  return (
    <Card className="p-5">
      <CardTitle>Certificates & achievements</CardTitle>
      <div className="mt-3 space-y-3">
        {certificates.map((c) => {
          const ready = c.status === "issued" || generated.includes(c.id);
          return (
            <div key={c.id} className="flex items-center gap-3 rounded-lg border border-line p-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-canvas text-[10px] font-medium text-muted">
                PDF
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{c.title}</p>
                <p className="text-xs text-muted">{c.issuedOn ?? (ready ? "Generated just now" : "Ready")}</p>
              </div>
              {ready ? (
                <Button size="sm" onClick={() => notify("PDF download will be available once data is connected.")}>
                  Download
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => {
                    // TODO(backend): ask the API to generate the certificate PDF
                    setGenerated((g) => [...g, c.id]);
                    notify("Certificate generated.");
                  }}
                >
                  Generate
                </Button>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-muted">Each certificate has a verification code for authenticity.</p>
    </Card>
  );
}
