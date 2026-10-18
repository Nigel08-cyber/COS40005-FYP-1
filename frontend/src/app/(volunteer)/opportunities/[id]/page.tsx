import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Badge, SkillTag } from "@/components/ui/Badge";
import { Card, CardTitle, Placeholder } from "@/components/ui/Card";
import { DetailSidebar } from "@/components/volunteer/DetailSidebar";
import { getOpportunities, getOpportunity } from "@/lib/api/volunteer";

export async function generateStaticParams() {
  const opportunities = await getOpportunities();
  return opportunities.map((o) => ({ id: o.id }));
}

export async function generateMetadata({ params }: PageProps<"/opportunities/[id]">): Promise<Metadata> {
  const { id } = await params;
  const o = await getOpportunity(id);
  return { title: o ? `${o.title} · VolunteerHub` : "Opportunity · VolunteerHub" };
}

export default function OpportunityDetailPage({ params }: PageProps<"/opportunities/[id]">) {
  // The id comes from the URL, so it is read inside Suspense: navigation shows the skeleton instantly.
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <OpportunityDetail params={params} />
    </Suspense>
  );
}

async function OpportunityDetail({ params }: { params: PageProps<"/opportunities/[id]">["params"] }) {
  const { id } = await params;
  const o = await getOpportunity(id);
  if (!o) notFound();

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
              <Row label="Languages" value={o.languages.join(", ")} />
              <Row label="Experience" value={o.experience} />
            </dl>
          </Card>

          <Card className="p-5">
            <CardTitle>Location</CardTitle>
            <p className="mt-1 text-xs text-muted">
              {o.address} · {o.distanceKm} km from you
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

function DetailSkeleton() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="mb-4 h-3 w-56 rounded bg-line" />
      <div className="h-40 rounded-xl bg-line sm:h-52" />
      <div className="mt-6 h-7 w-80 max-w-full rounded bg-line" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="h-64 rounded-xl bg-line" />
        <div className="h-64 rounded-xl bg-line" />
      </div>
    </div>
  );
}
