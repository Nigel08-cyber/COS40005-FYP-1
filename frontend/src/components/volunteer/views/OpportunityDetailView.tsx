"use client";

import Link from "next/link";
import { Badge, SkillTag } from "@/components/ui/Badge";
import { Card, CardTitle, Placeholder } from "@/components/ui/Card";
import { DataView } from "@/components/volunteer/DataView";
import { DetailSidebar } from "@/components/volunteer/DetailSidebar";
import { getOpportunity } from "@/lib/api/volunteer";
import { formatDistance } from "@/lib/format";

export function OpportunityDetailView({ id }: { id: string }) {
  return <DataView load={() => getOpportunity(id)}>{(o) => (o ? <Detail o={o} /> : <NotFound />)}</DataView>;
}

function NotFound() {
  return (
    <Card className="p-8 text-center">
      <p className="text-sm text-ink-soft">This opportunity is no longer available.</p>
      <Link href="/opportunities" className="mt-3 inline-block text-sm font-medium text-brand hover:underline">
        Back to browse opportunities
      </Link>
    </Card>
  );
}

function Detail({ o }: { o: NonNullable<Awaited<ReturnType<typeof getOpportunity>>> }) {
  return (
    <>
      <nav className="mb-4 text-xs text-muted" aria-label="Breadcrumb">
        <Link href="/opportunities" className="rounded hover:text-brand hover:underline">
          Browse opportunities
        </Link>
        <span className="mx-1.5">›</span>
        <span className="text-ink-soft">{o.title}</span>
      </nav>

      <Placeholder label="Cover image" className="h-40 rounded-xl sm:h-52" />

      <h1 className="mt-6 text-2xl font-bold tracking-tight sm:text-[28px]">{o.title}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
        <span className="flex size-6 items-center justify-center rounded-full bg-line text-[10px] font-medium">
          {o.organisationInitials}
        </span>
        {o.organisation}
        <Badge>{o.category}</Badge>
        <Badge tone="success">Open</Badge>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card className="p-5">
            <CardTitle>About this activity</CardTitle>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{o.summary}</p>
            <h3 className="mt-4 text-xs font-semibold">What you will do</h3>
            <ul className="mt-2 space-y-1.5">
              {o.tasks.map((t) => (
                <li key={t} className="flex items-start gap-2 text-sm text-ink-soft">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-ink-soft" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-5">
            <CardTitle>Requirements</CardTitle>
            <h3 className="mt-3 text-xs text-muted">Required skills</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {o.skills.map((s) => (
                <SkillTag key={s} tone="brand">
                  {s}
                </SkillTag>
              ))}
            </div>
            <dl className="mt-4 divide-y divide-line text-sm">
              <Row label="Volunteers needed" value={`${o.volunteersNeeded}`} />
              <Row label="Preferred availability" value={o.preferredAvailability} />
              <Row label="Languages" value={o.languages.length ? o.languages.join(", ") : "Any"} />
              <Row label="Experience" value={o.experience} />
            </dl>
          </Card>

          <Card className="p-5">
            <CardTitle>Location</CardTitle>
            <p className="mt-1 text-xs text-muted">
              {o.address || "Location to be confirmed"}
              {o.distanceKm !== null && ` · ${formatDistance(o.distanceKm)} from you`}
            </p>
            <Placeholder label="Map placeholder" className="mt-3 h-48" />
          </Card>
        </div>

        <DetailSidebar opportunity={o} />
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  );
}
