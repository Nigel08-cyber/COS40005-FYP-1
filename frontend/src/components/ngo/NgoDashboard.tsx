"use client";

import Link from "next/link";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ApprovalBanner, ComingSoonCard } from "@/components/staff/StaffNotices";
import { useStaff } from "@/components/staff/StaffShell";
import { cx } from "@/lib/format";
import type { NgoDashboardData, StatTile } from "@/lib/staffTypes";
import { ProjectTable } from "./ProjectTables";

const SKILL_GAP_SERIOUS = 5;
const SKILL_GAP_WARNING = 2;

function gapTone(required: number): Tone {
  if (required >= SKILL_GAP_SERIOUS) return "danger";
  if (required >= SKILL_GAP_WARNING) return "warning";
  return "neutral";
}

/** Wireframe 13 · NGO dashboard, from GET /ngos/{id}/dashboard. The AI analytics are not built yet. */
export function NgoDashboard({ data }: { data: NgoDashboardData }) {
  const { notify } = useStaff();
  const later = (what: string) => () => notify(`${what} will be available in a later sprint.`);
  const canCreate = data.status === "active";

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Dashboard"
        subtitle={data.organisation}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={later("Export report")}>
              Export report
            </Button>
            {canCreate ? (
              <Button href="/ngo/projects/new" variant="primary">
                + Create project
              </Button>
            ) : (
              <Button variant="primary" disabled title="Your organisation needs to be approved first">
                + Create project
              </Button>
            )}
          </div>
        }
      />
      <ApprovalBanner status={data.status} />

      <h2 className="mb-3 text-sm font-semibold">Volunteer statistics</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {data.volunteerStats.map((s) => (
          <StatCard key={s.label} stat={s} />
        ))}
      </div>

      <h2 className="mb-3 mt-6 text-sm font-semibold">Project statistics</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {data.projectStats.map((s) => (
          <StatCard key={s.label} stat={s} />
        ))}
        <Card interactive className="p-4">
          <p className="text-xs text-muted">Needs your attention</p>
          <div className="mt-2 flex flex-col items-start gap-1.5">
            <Link href="/ngo/volunteers" className="rounded-full transition-transform hover:-translate-y-px">
              <Badge tone={data.applicationsToReview ? "warning" : "neutral"}>
                {data.applicationsToReview} {data.applicationsToReview === 1 ? "application" : "applications"} to review →
              </Badge>
            </Link>
            <Badge>AI recommendations · coming soon</Badge>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-5">
          <CardTitle>Volunteer requirements</CardTitle>
          <p className="text-xs text-muted">Approved vs required volunteers per active project</p>
          <ul className="mt-4 space-y-4">
            {data.requirements.map((r) => (
              <li key={r.project}>
                <div className="mb-1.5 flex justify-between text-xs">
                  <span className="font-medium">{r.project}</span>
                  <span className="text-muted">
                    {r.approved}/{r.needed ?? "–"} volunteers
                  </span>
                </div>
                <ProgressBar value={r.approved} max={r.needed ?? Math.max(r.approved, 1)} />
              </li>
            ))}
            {data.requirements.length === 0 && <li className="text-sm text-muted">No active projects yet.</li>}
          </ul>
          <Link href="/ngo/projects" className="group mt-4 inline-block rounded text-xs font-medium text-brand hover:text-brand-hover">
            View all projects{" "}
            <span className="inline-block transition-transform duration-200 group-hover:translate-x-0.5">→</span>
          </Link>
        </Card>

        <Card className="p-5">
          <CardTitle>Skills gap</CardTitle>
          <p className="text-xs text-muted">Volunteers still needed by skill</p>
          <ul className="mt-4 space-y-3">
            {data.skillsGap.map((g) => (
              <li key={g.skill} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-ink-soft">{g.skill}</span>
                <Badge tone={gapTone(g.volunteersRequired)}>
                  {g.volunteersRequired} {g.volunteersRequired === 1 ? "volunteer" : "volunteers"} required
                </Badge>
              </li>
            ))}
            {data.skillsGap.length === 0 && (
              <li className="text-sm text-muted">No skill gaps. Add required skills to your projects to track them here.</li>
            )}
          </ul>
          <LinkButton onClick={later("Volunteer matching by skill")}>View volunteers with matching skills →</LinkButton>
        </Card>
      </div>

      <h2 className="mb-1 mt-8 text-sm font-semibold">AI-based volunteer analytics</h2>
      <p className="mb-3 text-xs text-muted">Data-driven insights from your historical participation data.</p>
      <div className="grid gap-4 lg:grid-cols-3">
        <ComingSoonCard title="Participation trend" description="Volunteers per week over the last 8 weeks." />
        <ComingSoonCard title="Peak participation periods" description="Average number of volunteers by day of the week." />
        <ComingSoonCard title="Frequently requested skills" description="Share of your projects that request each skill." />
      </div>
      <ComingSoonCard
        className="mt-4"
        title="AI insights"
        description="Short, data-backed observations about your volunteers (for example which skills you need most often), each with the underlying data."
      />

      <Card className="mt-6 p-5">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Upcoming projects</CardTitle>
          <Link href="/ngo/projects" className="group rounded text-xs font-medium text-brand hover:text-brand-hover">
            View all{" "}
            <span className="inline-block transition-transform duration-200 group-hover:translate-x-0.5">→</span>
          </Link>
        </div>
        <div className="mt-4">
          <ProjectTable rows={data.upcomingProjects} empty="No upcoming projects." />
        </div>
      </Card>
    </div>
  );
}

function StatCard({ stat }: { stat: StatTile }) {
  return (
    <Card interactive className="p-4">
      <p className="text-xs text-muted">{stat.label}</p>
      <p className={cx("mt-1 text-3xl font-bold tracking-tight", stat.value === null && "text-faint")}>{stat.value ?? "—"}</p>
      <p
        className={cx(
          "mt-1 text-xs",
          stat.noteTone === "success" ? "text-success" : stat.noteTone === "warning" ? "text-warning" : "text-muted",
        )}
      >
        {stat.note}
      </p>
    </Card>
  );
}

function LinkButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group mt-4 rounded text-xs font-medium text-brand hover:text-brand-hover">
      {children}
    </button>
  );
}
