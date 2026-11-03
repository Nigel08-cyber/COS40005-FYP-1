"use client";

import Link from "next/link";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ShareBars, VerticalBars } from "@/components/staff/Charts";
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

/** Wireframe 13 · NGO dashboard (+ AI analytics). */
export function NgoDashboard({ data }: { data: NgoDashboardData }) {
  const { notify } = useStaff();
  const later = (what: string) => () => notify(`${what} will be available once data is connected.`);
  const trendHighlight = data.participationTrend.length - 1;
  const peakValue = Math.max(...data.peakParticipation.map((p) => p.value));
  const peakHighlight = data.peakParticipation.findIndex((p) => p.value === peakValue);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Dashboard"
        subtitle={`${data.organisation} · ${data.period}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={later("Export report")}>
              Export report
            </Button>
            <Button href="/ngo/projects/new" variant="primary">
              + Create project
            </Button>
          </div>
        }
      />

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
            <Badge tone="warning">{data.applicationsToReview} applications to review</Badge>
            <Badge tone="brand">{data.aiRecommendationSetsReady} AI recommendation sets ready</Badge>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-5">
          <CardTitle>Volunteer requirements</CardTitle>
          <p className="text-xs text-muted">Registered vs required volunteers per project</p>
          <ul className="mt-4 space-y-4">
            {data.requirements.map((r) => (
              <li key={r.project}>
                <div className="mb-1.5 flex justify-between text-xs">
                  <span className="font-medium">{r.project}</span>
                  <span className="text-muted">
                    {r.registered}/{r.needed} volunteers
                  </span>
                </div>
                <ProgressBar value={r.registered} max={r.needed} />
              </li>
            ))}
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
          </ul>
          <LinkButton onClick={later("Volunteer matching by skill")}>View volunteers with matching skills →</LinkButton>
        </Card>
      </div>

      <h2 className="mb-1 mt-8 text-sm font-semibold">AI-based volunteer analytics</h2>
      <p className="mb-3 text-xs text-muted">
        Data-driven insights from your historical participation data. Underlying data is available on request.
      </p>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <CardTitle>Participation trend</CardTitle>
          <p className="mb-4 text-xs text-muted">Volunteers per week (last 8 weeks)</p>
          <VerticalBars data={data.participationTrend} highlight={trendHighlight} unit="volunteers" label="Volunteers per week" />
        </Card>
        <Card className="p-5">
          <CardTitle>Peak participation periods</CardTitle>
          <p className="mb-4 text-xs text-muted">Average volunteers by day</p>
          <VerticalBars data={data.peakParticipation} highlight={peakHighlight} unit="volunteers" label="Average volunteers by day" />
        </Card>
        <Card className="p-5">
          <CardTitle>Frequently requested skills</CardTitle>
          <p className="mb-4 text-xs text-muted">Share of projects requesting skill</p>
          <ShareBars data={data.requestedSkills} />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {data.insights.map((insight) => (
          <Card
            key={insight.text}
            tone="brand"
            className="p-4 transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand/10"
          >
            <Badge tone="brand">{insight.tag}</Badge>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">“{insight.text}”</p>
            <LinkButton onClick={later("The underlying data")}>View underlying data →</LinkButton>
          </Card>
        ))}
      </div>

      <Card className="mt-6 p-5">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Upcoming projects</CardTitle>
          <Link href="/ngo/projects" className="group rounded text-xs font-medium text-brand hover:text-brand-hover">
            View all{" "}
            <span className="inline-block transition-transform duration-200 group-hover:translate-x-0.5">→</span>
          </Link>
        </div>
        <div className="mt-4">
          <ProjectTable rows={data.upcomingProjects.map((p) => ({ ...p, title: p.project }))} />
        </div>
      </Card>
    </div>
  );
}

function StatCard({ stat }: { stat: StatTile }) {
  return (
    <Card interactive className="p-4">
      <p className="text-xs text-muted">{stat.label}</p>
      <p className="mt-1 text-3xl font-bold tracking-tight">{stat.value}</p>
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
    <button
      type="button"
      onClick={onClick}
      className="group mt-4 rounded text-xs font-medium text-brand hover:text-brand-hover"
    >
      {children}
    </button>
  );
}
