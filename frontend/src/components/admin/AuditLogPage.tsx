"use client";

import { useEffect, useState } from "react";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Select } from "@/components/ui/Fields";
import { PageHeader } from "@/components/ui/PageHeader";
import { type AuditEntry, type AuditPeople, AUDIT_FILTERS, auditActionLabel, getAuditPage } from "@/lib/api/admin";
import { errorMessage, utcToLocal } from "@/lib/api/http";
import { cx, formatLongDate, formatShortDate, formatTime } from "@/lib/format";

function result(entry: AuditEntry): { tone: Tone; label: string } {
  const status = entry.details?.status;
  if (typeof status !== "number" || status < 400) return { tone: "success", label: "Success" };
  if (status === 401 || status === 403) return { tone: "danger", label: "Denied" };
  return { tone: "warning", label: "Failed" };
}

const target = (e: AuditEntry) => (e.entity_type ? `${e.entity_type.replace(/_/g, " ")} #${e.entity_id ?? "?"}` : "—");

/** System admin: a read-only record of who changed what, newest first. */
export function AuditLogPage({ people }: { people: AuditPeople }) {
  const [action, setAction] = useState("");
  const [userId, setUserId] = useState("");
  const [page, setPage] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ key: string; rows: AuditEntry[]; hasMore: boolean } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const key = `${action}|${userId}|${page}|${attempt}`;

  useEffect(() => {
    let cancelled = false;
    getAuditPage({ action, userId: userId ? Number(userId) : null, page })
      .then((r) => !cancelled && setState({ key, ...r }))
      .catch((e) => !cancelled && setFailure({ key, message: errorMessage(e) }));
    return () => {
      cancelled = true;
    };
  }, [action, userId, page, key]);

  const loading = state?.key !== key && failure?.key !== key;
  const error = failure?.key === key ? failure.message : null;
  const rows = state?.key === key ? state.rows : (state?.rows ?? []);
  const selected = rows.find((r) => r.log_id === selectedId) ?? rows[0] ?? null;
  const who = (e: AuditEntry) => (e.user_id ? (people.names[e.user_id] ?? `User #${e.user_id}`) : "Not signed in");
  const filter = (set: (v: string) => void) => (v: string) => {
    set(v);
    setPage(0);
    setSelectedId(null);
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Audit log" subtitle="A record of who did what on the platform. It cannot be edited." />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          <div className="grid gap-2 sm:grid-cols-2">
            <Select
              label="Filter by activity"
              value={action}
              onChange={filter(setAction)}
              options={[{ value: "", label: "Activity: All" }, ...AUDIT_FILTERS]}
            />
            <Select
              label="Filter by user"
              value={userId}
              onChange={filter(setUserId)}
              options={[{ value: "", label: "User: All" }, ...people.options]}
            />
          </div>

          <div className={cx("mt-4 overflow-x-auto rounded-lg border border-line bg-surface", loading && "opacity-60")} aria-busy={loading}>
            <table className="w-full text-left text-sm">
              <thead className="bg-canvas text-xs text-muted">
                <tr>
                  {["Time", "User", "Activity", "Target", "Result"].map((c) => (
                    <th key={c} className="whitespace-nowrap px-4 py-2.5 font-medium">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((e) => {
                  const r = result(e);
                  const local = utcToLocal(e.created_at.slice(0, 19));
                  const isSelected = selected?.log_id === e.log_id;
                  return (
                    <tr
                      key={e.log_id}
                      tabIndex={0}
                      aria-selected={isSelected}
                      onClick={() => setSelectedId(e.log_id)}
                      onKeyDown={(k) => (k.key === "Enter" || k.key === " ") && (k.preventDefault(), setSelectedId(e.log_id))}
                      className={cx(
                        "cursor-pointer outline-none transition-colors duration-200 hover:bg-brand-soft/40 focus-visible:bg-brand-soft/60",
                        isSelected && "bg-brand-soft/60",
                      )}
                    >
                      <td className="whitespace-nowrap px-4 py-2.5 text-ink-soft">
                        {formatShortDate(local)} · {formatTime(local)}
                      </td>
                      <td className="max-w-40 truncate px-4 py-2.5 text-ink">{who(e)}</td>
                      <td className="px-4 py-2.5 text-ink">{auditActionLabel(e.action)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 capitalize text-ink-soft">{target(e)}</td>
                      <td className="px-4 py-2.5">
                        <Badge tone={r.tone}>{r.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
                {!loading && !error && rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted">
                      No records match these filters.
                    </td>
                  </tr>
                )}
                {error && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center">
                      <p role="alert" className="text-sm text-danger">
                        {error}
                      </p>
                      <Button className="mt-3" onClick={() => setAttempt((n) => n + 1)}>
                        Try again
                      </Button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-muted">
            <span>Page {page + 1}</span>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" disabled={page === 0 || loading} onClick={() => (setPage(page - 1), setSelectedId(null))}>
                ‹ Newer
              </Button>
              <Button size="sm" variant="ghost" disabled={!state?.hasMore || loading} onClick={() => (setPage(page + 1), setSelectedId(null))}>
                Older ›
              </Button>
            </div>
          </div>
        </div>

        <aside className="lg:sticky lg:top-20 lg:h-fit">
          <Card className="p-5">
            <CardTitle>Record details</CardTitle>
            {selected ? (
              <dl className="mt-3 space-y-3 text-sm">
                <Detail label="Activity" value={auditActionLabel(selected.action)} />
                <Detail label="User" value={who(selected)} />
                <Detail
                  label="Time"
                  value={`${formatLongDate(utcToLocal(selected.created_at.slice(0, 19)))}, ${formatTime(utcToLocal(selected.created_at.slice(0, 19)))}`}
                />
                <Detail label="Target" value={target(selected)} />
                <Detail
                  label="Result"
                  value={`${result(selected).label}${typeof selected.details?.status === "number" ? ` (HTTP ${selected.details.status})` : ""}`}
                />
                <Detail label="IP address" value={selected.ip_address ?? "—"} />
                <Detail label="Technical name" value={selected.action} mono />
              </dl>
            ) : (
              <p className="mt-3 text-sm text-muted">Select a record to see its details.</p>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={cx("break-words font-medium text-ink [overflow-wrap:anywhere]", mono && "font-mono text-xs font-normal")}>{value}</dd>
    </div>
  );
}
