"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, SkillTag, type Tone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Select } from "@/components/ui/Fields";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ApplicationReview } from "@/components/staff/ApplicationReview";
import { ConfirmButton } from "@/components/staff/ConfirmButton";
import { ApprovalBanner } from "@/components/staff/StaffNotices";
import { useStaff } from "@/components/staff/StaffShell";
import { errorMessage } from "@/lib/api/http";
import { assignCoordinator, setProjectStatus } from "@/lib/api/projects";
import { formatLongDate, formatTimeRange } from "@/lib/format";
import type { ProjectDetailData, ProjectStatus, SessionItem } from "@/lib/staffTypes";

const PROJECT_STATUS: Record<ProjectStatus, { tone: Tone; label: string }> = {
  draft: { tone: "neutral", label: "Draft" },
  active: { tone: "success", label: "Published" },
  completed: { tone: "brand", label: "Completed" },
  cancelled: { tone: "danger", label: "Cancelled" },
};

/** Not found, or a project of another organisation. */
export function ProjectNotFound({ backHref }: { backHref: string }) {
  return (
    <Card className="mx-auto max-w-xl p-8 text-center">
      <p className="font-semibold">Project not found</p>
      <p className="mt-1 text-sm text-muted">It may have been removed, or it belongs to another organisation.</p>
      <Button href={backHref} variant="outline" className="mt-5">
        Back to projects
      </Button>
    </Card>
  );
}

/**
 * Project details: information, sessions and the applications to review.
 * NGO admins (/ngo/projects/[id]) can also edit, publish drafts and change the coordinator;
 * coordinators (/coordinator/projects/[id]) review applications and close or cancel the project.
 */
export function ProjectDetails({ data }: { data: ProjectDetailData }) {
  const { notify } = useStaff();
  const project = data.project!;
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [sessions, setSessions] = useState(data.sessions);
  const [coordinatorId, setCoordinatorId] = useState(project.coordinatorId);
  const [savingCoordinator, setSavingCoordinator] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isNgo = data.scope === "ngo";
  const backHref = isNgo ? "/ngo/projects" : "/coordinator/projects";
  const editHref = `/ngo/projects/${project.id}/edit`;
  const open = status === "active";
  const orgActive = data.ngoStatus === "active";
  const [approved, setApproved] = useState(data.applications.filter((a) => a.status === "approved").length);
  const coordinatorName =
    data.coordinators.find((c) => c.id === coordinatorId)?.name.replace(/ \(admin\)$/, "") ?? (coordinatorId ? project.coordinator : "Not assigned");

  const changeStatus = async (next: "completed" | "cancelled") => {
    setError(null);
    try {
      await setProjectStatus(project.id, next);
      setStatus(next);
      if (next === "cancelled") setSessions((list) => list.map((s) => (s.status === "active" ? { ...s, status: "cancelled" } : s)));
      notify(next === "completed" ? "Project marked as completed." : "Project cancelled. Its sessions were cancelled too.");
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const changeCoordinator = async (id: string) => {
    const previous = coordinatorId;
    setCoordinatorId(id);
    setSavingCoordinator(true);
    setError(null);
    try {
      await assignCoordinator(project.id, id);
      notify(id ? "Project coordinator updated." : "Coordinator removed from this project.");
    } catch (e) {
      setCoordinatorId(previous);
      setError(errorMessage(e));
    } finally {
      setSavingCoordinator(false);
    }
  };

  const statusBadge = PROJECT_STATUS[status];

  return (
    <div className="mx-auto max-w-6xl">
      <nav className="mb-2 text-xs text-muted" aria-label="Breadcrumb">
        <Link href={backHref} className="rounded hover:text-brand hover:underline">
          {isNgo ? "Projects" : "My projects"}
        </Link>
        <span className="mx-1.5">→</span>
        <span className="text-ink-soft">{project.title}</span>
      </nav>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[28px]">{project.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={statusBadge.tone}>{statusBadge.label}</Badge>
            <Badge>{project.category}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isNgo && status === "draft" &&
            (orgActive ? (
              <Button href={editHref} variant="primary">
                Continue editing
              </Button>
            ) : (
              <Button variant="primary" disabled title="Your organisation needs to be approved first">
                Continue editing
              </Button>
            ))}
          {isNgo && open && (
            <Button href={editHref} variant="outline">
              Edit project
            </Button>
          )}
          {open && (
            <Button
              variant="outline"
              loading={completing}
              onClick={async () => {
                setCompleting(true);
                await changeStatus("completed");
                setCompleting(false);
              }}
            >
              Mark as completed
            </Button>
          )}
          {open && (
            <ConfirmButton
              label="Cancel project"
              question="Cancel this project and all its sessions?"
              confirmLabel="Yes, cancel"
              onConfirm={() => changeStatus("cancelled")}
            />
          )}
        </div>
      </div>
      <ApprovalBanner status={data.ngoStatus} />
      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          <Card className="p-5">
            <CardTitle>About this project</CardTitle>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-soft">
              {project.description || <span className="text-faint">No description yet.</span>}
            </p>
          </Card>

          <Card className="p-5">
            <CardTitle>Sessions</CardTitle>
            <p className="text-xs text-muted">Volunteers with an approved application register for a session.</p>
            <ul className="mt-4 space-y-2.5">
              {sessions.map((s) => (
                <SessionRow key={s.id} session={s} />
              ))}
              {sessions.length === 0 && (
                <li className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
                  {status === "draft" ? "A session is created when you publish the project." : "No sessions yet."}
                </li>
              )}
            </ul>
          </Card>

          <Card className="p-5">
            <CardTitle>Applications</CardTitle>
            <p className="mb-4 text-xs text-muted">Approve volunteers so they can register for the sessions.</p>
            {status === "draft" ? (
              <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
                Volunteers can apply once the project is published.
              </p>
            ) : (
              <ApplicationReview
                applications={data.applications}
                empty="No volunteers have applied yet."
                onDecided={(list) => setApproved(list.filter((a) => a.status === "approved").length)}
              />
            )}
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:h-fit">
          <Card className="p-5">
            <CardTitle>Details</CardTitle>
            <dl className="mt-3 divide-y divide-line text-sm">
              <Row label="Date" value={project.date ? formatLongDate(project.date) : "Not set"} />
              <Row label="Location" value={project.location || "Not set"} />
              <div className="py-2.5">
                <dt className="text-xs text-muted">Coordinator</dt>
                {data.canAssignCoordinator && status !== "cancelled" && status !== "completed" ? (
                  <dd className="mt-1.5">
                    <Select
                      label="Project coordinator"
                      value={coordinatorId}
                      onChange={changeCoordinator}
                      options={[{ value: "", label: "Not assigned" }, ...data.coordinators.map((c) => ({ value: c.id, label: c.name }))]}
                    />
                    {savingCoordinator && <p className="pt-1 text-xs text-muted">Saving…</p>}
                    {isNgo && (
                      <Link href="/ngo/team" className="mt-1.5 inline-block text-xs text-brand hover:underline">
                        Add a coordinator to your team →
                      </Link>
                    )}
                  </dd>
                ) : (
                  <dd className="mt-0.5 font-medium text-ink">{coordinatorName}</dd>
                )}
              </div>
              <div className="py-2.5">
                <div className="flex justify-between gap-3 text-xs">
                  <dt className="text-muted">Approved volunteers</dt>
                  <dd className="font-medium text-ink">
                    {approved} / {project.volunteersNeeded ?? "–"}
                  </dd>
                </div>
                <ProgressBar className="mt-2" value={approved} max={project.volunteersNeeded ?? Math.max(approved, 1)} />
              </div>
              <Row label="Minimum experience" value={project.minExperience} />
              <Row label="Preferred availability" value={project.preferredAvailability} />
              <div className="py-2.5">
                <dt className="text-xs text-muted">Required skills</dt>
                <dd className="mt-1.5 flex flex-wrap gap-1.5">
                  {project.skills.length ? (
                    project.skills.map((s) => (
                      <SkillTag key={s} tone="brand">
                        {s}
                      </SkillTag>
                    ))
                  ) : (
                    <span className="text-xs text-faint">None</span>
                  )}
                </dd>
              </div>
              {project.created && <Row label="Created" value={formatLongDate(project.created)} />}
            </dl>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-right text-xs font-medium text-ink">{value}</dd>
    </div>
  );
}

function SessionRow({ session: s }: { session: SessionItem }) {
  const cancelled = s.status === "cancelled";
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line px-4 py-3">
      <div className="min-w-0">
        <p className={cancelled ? "font-medium text-faint line-through" : "font-medium text-ink"}>{formatLongDate(s.start)}</p>
        <p className="text-xs text-muted">
          {formatTimeRange(s.start, s.end)}
          {s.venue && ` · ${s.venue}`}
        </p>
      </div>
      <div className="flex items-center gap-2 text-xs text-ink-soft">
        <span>
          {s.registered} / {s.capacity ?? "–"} registered
        </span>
        {s.waitlisted > 0 && <Badge tone="warning">{s.waitlisted} waitlisted</Badge>}
        {cancelled && <Badge tone="danger">Cancelled</Badge>}
      </div>
    </li>
  );
}
