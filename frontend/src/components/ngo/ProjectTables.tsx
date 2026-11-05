"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { Badge, type Tone } from "@/components/ui/Badge";
import { formatShortDate } from "@/lib/format";
import type { ProjectDraftItem, ProjectListItem } from "@/lib/staffTypes";

/** A project counts as "Open" while at least this share of spots is filled; below it "Needs volunteers". */
export const OPEN_FILL_RATIO = 0.6;

function projectStatus(p: ProjectListItem): { tone: Tone; label: string } {
  if (p.state === "completed") return { tone: "neutral", label: "Completed" };
  if (p.state === "cancelled") return { tone: "danger", label: "Cancelled" };
  if (!p.needed) return { tone: "success", label: "Open" };
  return p.registered / p.needed >= OPEN_FILL_RATIO
    ? { tone: "success", label: "Open" }
    : { tone: "warning", label: "Needs volunteers" };
}

/** "2026-10-17" -> "17 Oct" ("Not set" when empty) */
function DateCell({ date }: { date: string }) {
  return date ? <>{formatShortDate(date).split(", ")[1]}</> : <span className="text-faint">Not set</span>;
}

/** Props that make a table row behave like a button: hover, press animation, keyboard support. */
function clickableRow(onOpen: () => void, label: string) {
  return {
    role: "button" as const,
    tabIndex: 0,
    "aria-label": label,
    onClick: onOpen,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onOpen();
      }
    },
    whileTap: { scale: 0.985 },
    transition: { duration: 0.12 },
    className:
      "group cursor-pointer outline-none transition-colors duration-200 hover:bg-brand-soft/60 focus-visible:bg-brand-soft/60 active:bg-brand-soft",
  };
}

function Chevron() {
  return (
    <td className="w-8 pr-4 text-right text-faint">
      <span className="inline-block transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-brand">›</span>
    </td>
  );
}

function Head({ columns }: { columns: string[] }) {
  return (
    <thead className="bg-canvas text-xs text-muted">
      <tr>
        {columns.map((c) => (
          <th key={c} className="px-4 py-2.5 font-medium">
            {c}
          </th>
        ))}
        <th aria-hidden className="w-8" />
      </tr>
    </thead>
  );
}

/** Project table (same look as "Upcoming projects"). Clicking a row opens the project details page. */
export function ProjectTable({
  rows,
  empty = "No projects yet.",
  basePath = "/ngo/projects",
}: {
  rows: ProjectListItem[];
  empty?: string;
  /** Details page prefix: /ngo/projects (NGO admin) or /coordinator/projects (coordinator) */
  basePath?: string;
}) {
  const router = useRouter();
  const open = (p: ProjectListItem) => router.push(`${basePath}/${p.id}`);

  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full text-left text-sm">
        <Head columns={["Project", "Coordinator", "Date", "Volunteers", "Status"]} />
        <tbody className="divide-y divide-line">
          <AnimatePresence initial={false} mode="popLayout">
            {rows.map((p) => {
              const status = projectStatus(p);
              return (
                <motion.tr
                  key={p.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  {...clickableRow(() => open(p), `Open ${p.title}`)}
                >
                  <td className="px-4 py-2.5 font-medium text-ink group-hover:text-brand">{p.title}</td>
                  <td className="px-4 py-2.5 text-ink-soft">{p.coordinator}</td>
                  <td className="px-4 py-2.5 text-ink-soft">
                    <DateCell date={p.date} />
                  </td>
                  <td className="px-4 py-2.5 text-ink-soft">
                    {p.registered} / {p.needed ?? "–"}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </td>
                  <Chevron />
                </motion.tr>
              );
            })}
          </AnimatePresence>
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Drafts that are not published yet. Clicking a row reopens the draft in the project form. */
export function DraftTable({ drafts }: { drafts: ProjectDraftItem[] }) {
  const router = useRouter();
  const open = (d: ProjectDraftItem) => router.push(`/ngo/projects/${d.id}/edit`);

  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full text-left text-sm">
        <Head columns={["Draft", "Category", "Date", "Created", "Still needed"]} />
        <tbody className="divide-y divide-line">
          {drafts.map((d) => (
            <motion.tr key={d.id} {...clickableRow(() => open(d), `Continue draft ${d.title}`)}>
              <td className="px-4 py-2.5 font-medium text-ink group-hover:text-brand">{d.title}</td>
              <td className="px-4 py-2.5 text-ink-soft">{d.category}</td>
              <td className="px-4 py-2.5 text-ink-soft">
                <DateCell date={d.date} />
              </td>
              <td className="px-4 py-2.5 text-ink-soft">
                <DateCell date={d.created} />
              </td>
              <td className="px-4 py-2.5">
                {d.missing.length === 0 ? (
                  <Badge tone="success">Ready to publish</Badge>
                ) : (
                  <span title={d.missing.join(", ")}>
                    <Badge tone="warning">
                      {d.missing.length} {d.missing.length === 1 ? "field" : "fields"} missing
                    </Badge>
                  </span>
                )}
              </td>
              <Chevron />
            </motion.tr>
          ))}
          {drafts.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted">
                No drafts. Projects you save as draft appear here.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
