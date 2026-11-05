"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { Badge, SkillTag, type Tone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Fields";
import { Tabs } from "@/components/ui/Tabs";
import { useStaff } from "@/components/staff/StaffShell";
import { errorMessage, shortDay } from "@/lib/api/http";
import { decideApplication } from "@/lib/api/projects";
import type { ApplicationItem, ApplicationStatus } from "@/lib/staffTypes";
import { initialsOf } from "@/lib/useSessionGuard";

type StatusFilter = "pending" | "approved" | "rejected" | "all";

const STATUS: Record<ApplicationStatus, { tone: Tone; label: string }> = {
  pending: { tone: "warning", label: "Pending" },
  approved: { tone: "success", label: "Approved" },
  rejected: { tone: "danger", label: "Rejected" },
  withdrawn: { tone: "neutral", label: "Withdrawn" },
};

/**
 * Applications with search, status tabs, an optional project filter and Approve / Reject
 * (PATCH /applications/{id}). Used on a project's details page and on the Volunteers / Applications pages.
 */
export function ApplicationReview({
  applications,
  projects,
  empty = "No applications yet.",
  onDecided,
}: {
  applications: ApplicationItem[];
  /** When given, each row shows its project and the list can be filtered by project */
  projects?: { id: string; title: string }[];
  empty?: string;
  /** Called with the updated list after an application is approved or rejected */
  onDecided?: (applications: ApplicationItem[]) => void;
}) {
  const [items, setItems] = useState(applications);
  const [status, setStatus] = useState<StatusFilter>(applications.some((a) => a.status === "pending") ? "pending" : "all");
  const [query, setQuery] = useState("");
  const [project, setProject] = useState("");

  const count = (s: StatusFilter) => items.filter((a) => s === "all" || a.status === s).length;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((a) => {
      if (status !== "all" && a.status !== status) return false;
      if (project && a.projectId !== project) return false;
      if (!q) return true;
      const haystack = [a.volunteer, a.email ?? "", `#${a.volunteerId}`, ...(a.skills ?? []), a.projectTitle].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [items, status, project, query]);

  const update = (id: number, change: Partial<ApplicationItem>) => {
    const next = items.map((a) => (a.id === id ? { ...a, ...change } : a));
    setItems(next);
    onDecided?.(next);
  };

  return (
    <div>
      {items.some((a) => !a.hasName) && (
        <p className="mb-4 rounded-lg border border-line bg-canvas px-3 py-2 text-xs text-muted">
          The backend only sends each volunteer&apos;s ID for now, so names, emails and skills will appear here once it
          adds them.
        </p>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <Tabs
          id={`applications-${projects ? "all" : "project"}`}
          items={[
            { value: "pending", label: `Pending (${count("pending")})` },
            { value: "approved", label: `Approved (${count("approved")})` },
            { value: "rejected", label: `Rejected (${count("rejected")})` },
            { value: "all", label: `All (${count("all")})` },
          ]}
          value={status}
          onChange={setStatus}
        />
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          {projects && projects.length > 1 && (
            <Select
              label="Filter by project"
              className="w-full sm:w-56"
              value={project}
              onChange={setProject}
              options={[{ value: "", label: "All projects" }, ...projects.map((p) => ({ value: p.id, label: p.title }))]}
            />
          )}
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, skill or #ID"
            aria-label="Search volunteers"
            className="h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink outline-none placeholder:text-faint hover:border-ink/30 focus:border-brand focus:ring-4 focus:ring-brand/10 sm:w-64"
          />
        </div>
      </div>

      <ul className="mt-4 space-y-2.5">
        <AnimatePresence initial={false} mode="popLayout">
          {shown.map((a) => (
            <motion.li
              key={a.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
            >
              <ApplicationRow application={a} showProject={!!projects} onChange={(c) => update(a.id, c)} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {shown.length === 0 && (
        <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
          {items.length === 0 ? empty : "No applications match these filters."}
        </p>
      )}
    </div>
  );
}

function ApplicationRow({
  application: a,
  showProject,
  onChange,
}: {
  application: ApplicationItem;
  showProject: boolean;
  onChange: (change: Partial<ApplicationItem>) => void;
}) {
  const { notify } = useStaff();
  const [busy, setBusy] = useState<"approved" | "rejected" | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const status = STATUS[a.status];

  const decide = async (decision: "approved" | "rejected") => {
    setBusy(decision);
    setError(null);
    try {
      const result = await decideApplication(a.id, decision, decision === "rejected" ? note : undefined);
      onChange({ status: result.status as ApplicationStatus, note: result.note, decidedOn: result.decidedOn, decidedBy: "you" });
      notify(decision === "approved" ? `${a.volunteer} approved. They can now register for sessions.` : `${a.volunteer} rejected.`);
      setRejecting(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-xl border border-line bg-surface p-4 transition-[border-color,box-shadow] duration-200 hover:border-line-strong hover:shadow-sm">
      <div className="flex flex-wrap items-start gap-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand"
          aria-hidden
        >
          {a.hasName ? initialsOf(a.volunteer) : "#"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-ink">{a.volunteer}</p>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted">
            {[a.email, showProject ? a.projectTitle : null, a.appliedOn ? `Applied ${shortDay(a.appliedOn)}` : null]
              .filter(Boolean)
              .join(" · ") || "No contact details yet"}
          </p>
          {a.skills && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {a.skills.length ? a.skills.map((s) => <SkillTag key={s}>{s}</SkillTag>) : <span className="text-xs text-faint">No skills listed</span>}
            </div>
          )}
          {a.status !== "pending" && a.decidedOn && (
            <p className="mt-2 text-xs text-muted">
              {status.label} by {a.decidedBy ?? "staff"} on {shortDay(a.decidedOn)}
              {a.note && <span className="text-ink-soft"> · “{a.note}”</span>}
            </p>
          )}
        </div>

        {a.status === "pending" && !rejecting && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={!!busy} onClick={() => setRejecting(true)}>
              Reject
            </Button>
            <Button size="sm" variant="brand" loading={busy === "approved"} disabled={!!busy} onClick={() => decide("approved")}>
              Approve
            </Button>
          </div>
        )}
      </div>

      <AnimatePresence initial={false}>
        {rejecting && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Reason (optional, saved as a coordinator note)"
                aria-label="Reason for rejecting"
                maxLength={500}
                className="h-8 min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-3 text-xs outline-none placeholder:text-faint focus:border-brand focus:ring-4 focus:ring-brand/10"
              />
              <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => setRejecting(false)}>
                Back
              </Button>
              <Button size="sm" variant="danger-outline" loading={busy === "rejected"} disabled={!!busy} onClick={() => decide("rejected")}>
                Reject application
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
