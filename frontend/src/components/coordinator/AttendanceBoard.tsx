"use client";

import { AnimatePresence, motion } from "motion/react";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Select } from "@/components/ui/Fields";
import { PageHeader } from "@/components/ui/PageHeader";
import { ConfirmButton } from "@/components/staff/ConfirmButton";
import { useStaff } from "@/components/staff/StaffShell";
import {
  type EventQr,
  type EventRoster,
  type RosterRow,
  type RosterStatus,
  type StaffEvent,
  closeEvent,
  correctTimes,
  getEventQr,
  getEventRoster,
  manualCheckIn,
  markAbsent,
  rotateEventQr,
  staffEventLabel,
} from "@/lib/api/attendance";
import { errorMessage, utcToLocal } from "@/lib/api/http";
import { cx, formatShortDate, formatTime, formatTimeRange } from "@/lib/format";

const QR_POLL_MS = 30_000;
const ROSTER_POLL_MS = 10_000;

const statusBadge: Record<RosterStatus, { tone: Tone; label: string }> = {
  checked_in: { tone: "success", label: "Checked in" },
  checked_out: { tone: "neutral", label: "Checked out" },
  not_arrived: { tone: "warning", label: "Not arrived" },
  absent: { tone: "danger", label: "Absent" },
};

const shownTime = (utc: string | null) => (utc ? formatTime(utcToLocal(utc)) : "—");
const hhmm = (utc: string | null) => (utc ? utcToLocal(utc).slice(11, 16) : "");

/** Wireframe 15a · Coordinator: event QR & live attendance. */
export function AttendanceBoard({ events }: { events: StaffEvent[] }) {
  const [eventId, setEventId] = useState(events[0]?.id ?? 0);
  const event = events.find((e) => e.id === eventId);

  if (!event) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader title="Attendance" subtitle="Show the QR code and follow check-ins for your events." />
        <Card className="p-8 text-center text-sm text-muted">
          No published sessions yet. They will show here once a project has a date.
        </Card>
      </div>
    );
  }

  const picker =
    events.length > 1 ? (
      <Select
        label="Choose a session"
        className="mb-5 max-w-xl"
        value={String(event.id)}
        onChange={(v) => setEventId(Number(v))}
        options={events.map((e) => ({ value: String(e.id), label: staffEventLabel(e) }))}
      />
    ) : null;

  // key: switching session starts with a clean QR code, roster and edit state
  return <Board key={event.id} event={event} picker={picker} />;
}

function Board({ event, picker }: { event: StaffEvent; picker: React.ReactNode }) {
  const { notify } = useStaff();
  const [closed, setClosed] = useState(event.status !== "active");
  const [qr, setQr] = useState<EventQr | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [rotating, setRotating] = useState(false);
  const [roster, setRoster] = useState<EventRoster | null>(null);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const qrCard = useRef<HTMLDivElement>(null);
  const deadline = useRef(0);
  const fetchingQr = useRef(false);

  const showQr = useCallback((next: EventQr) => {
    deadline.current = Date.now() + next.ttl_seconds * 1000;
    setQr(next);
    setSecondsLeft(next.ttl_seconds);
    setQrError(null);
  }, []);

  const loadQr = useCallback(() => {
    if (fetchingQr.current) return;
    fetchingQr.current = true;
    getEventQr(event.id)
      .then(showQr)
      .catch((e) => setQrError(errorMessage(e)))
      .finally(() => {
        fetchingQr.current = false;
      });
  }, [event.id, showQr]);

  const loadRoster = useCallback(
    () =>
      getEventRoster(event.id)
        .then((next) => {
          setRoster(next);
          setRosterError(null);
        })
        .catch((e) => setRosterError(errorMessage(e))),
    [event.id],
  );

  // The code: re-read every 30 s, and as soon as the countdown reaches zero
  useEffect(() => {
    if (closed) return;
    loadQr();
    const poll = setInterval(loadQr, QR_POLL_MS);
    const tick = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) loadQr();
    }, 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [closed, loadQr]);

  // Live attendance
  useEffect(() => {
    void loadRoster();
    const id = setInterval(() => {
      if (!document.hidden) void loadRoster();
    }, ROSTER_POLL_MS);
    return () => clearInterval(id);
  }, [loadRoster]);

  const rows = useMemo(() => roster?.rows ?? [], [roster]);
  const notArrived = rows.filter((r) => r.status === "not_arrived" || r.status === "absent");
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((r) => `${r.full_name} ${r.email}`.toLowerCase().includes(q)) : rows;
  }, [rows, query]);

  const rotate = async () => {
    setRotating(true);
    try {
      showQr(await rotateEventQr(event.id));
      notify("New QR code issued. The old one no longer works.");
    } catch (e) {
      notify(errorMessage(e));
    } finally {
      setRotating(false);
    }
  };

  const checkInManually = async (r: RosterRow) => {
    setManualOpen(false);
    try {
      await manualCheckIn(event.id, r.user_id);
      await loadRoster();
      notify(`${r.full_name} checked in manually.`);
    } catch (e) {
      notify(errorMessage(e));
    }
  };

  const close = async () => {
    try {
      await closeEvent(event.id);
      setClosed(true);
      notify("Event closed. The QR code no longer works.");
    } catch (e) {
      notify(errorMessage(e));
    }
  };

  const downloadCsv = () => {
    // A leading ' stops spreadsheet apps from running a name as a formula
    const cell = (v: string) => `"${(/^[=+\-@]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;
    const lines = [
      ["Volunteer", "Email", "Check-in", "Check-out", "Hours", "Status"],
      ...rows.map((r) => [
        r.full_name,
        r.email,
        r.check_in_time ? shownTime(r.check_in_time) : "",
        r.check_out_time ? shownTime(r.check_out_time) : "",
        r.hours_served?.toFixed(2) ?? "",
        statusBadge[r.status].label,
      ]),
    ];
    const csv = lines.map((row) => row.map(cell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${event.title.replace(/\s+/g, "-").toLowerCase()}-${event.start.slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const arrived = (roster?.checked_in ?? 0) + (roster?.checked_out ?? 0);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={`Attendance · ${event.title}`}
        subtitle={[`${formatShortDate(event.start)} · ${formatTimeRange(event.start, event.end)}`, event.venue].filter(Boolean).join(" · ")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" disabled={!rows.length} onClick={downloadCsv}>
              Download attendance
            </Button>
            {closed ? (
              <Button variant="primary" disabled>
                Event closed
              </Button>
            ) : (
              <ConfirmButton
                label="Close event"
                question="Close this event? The QR code will stop working."
                confirmLabel="Close event"
                onConfirm={close}
              />
            )}
          </div>
        }
      />
      {picker}

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card className="p-5">
          <CardTitle>Event QR code</CardTitle>
          <p className="text-xs text-muted">The first scan checks in, the second scan checks out. Display on a screen at the venue.</p>

          <div
            ref={qrCard}
            className="relative mt-4 flex min-h-64 flex-col items-center justify-center rounded-lg bg-surface [&:fullscreen]:bg-white"
          >
            {qrError && !closed ? (
              <p role="alert" className="px-3 text-center text-sm text-danger">
                {qrError}
              </p>
            ) : (
              <>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={qr?.token ?? "empty"}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: closed ? 0.12 : 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.25 }}
                    className="w-full max-w-60 [:fullscreen_&]:max-w-[70vh]"
                  >
                    {qr && !closed ? (
                      <QRCodeSVG
                        value={qr.scan_url}
                        size={240}
                        level="M"
                        marginSize={2}
                        title="Event check-in QR code"
                        className="h-auto w-full"
                      />
                    ) : (
                      <div className="aspect-square w-full rounded-lg bg-canvas" aria-hidden />
                    )}
                  </motion.div>
                </AnimatePresence>
                {closed && <p className="absolute text-sm font-semibold text-ink">Event closed</p>}
                <p className={cx("mt-3 text-sm font-medium", closed ? "text-muted" : "text-warning")}>
                  {closed ? "QR code disabled" : qr ? `Refreshes in ${mm}:${ss}` : "Loading code…"}
                </p>
              </>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="outline" disabled={closed} loading={rotating} onClick={rotate}>
              Refresh now
            </Button>
            <Button variant="outline" disabled={closed || !qr} onClick={() => void qrCard.current?.requestFullscreen?.()}>
              Full screen
            </Button>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            Check-in opens 30 minutes before the start. Scanning outside the event time or with an expired code is rejected.
          </p>
        </Card>

        <div className="min-w-0 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Stat label="Checked in" value={`${arrived} / ${roster?.registered ?? 0}`} note={`${roster?.not_arrived ?? 0} not arrived`} />
            <Stat label="Checked out" value={String(roster?.checked_out ?? 0)} note="volunteers" />
            <Stat label="Hours logged" value={`${Number((roster?.total_hours ?? 0).toFixed(2))} h`} note="updates at check-out" />
          </div>

          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Live attendance</CardTitle>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search volunteer..."
                aria-label="Search volunteer"
                className="h-9 w-48 rounded-lg border border-line-strong bg-surface px-3 text-sm outline-none placeholder:text-faint hover:border-ink/30 focus:border-brand focus:ring-4 focus:ring-brand/10"
              />
            </div>
            {rosterError && (
              <p role="alert" className="mt-3 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
                {rosterError}
              </p>
            )}

            <div className="mt-4 max-h-96 overflow-auto rounded-lg border border-line">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-10 bg-canvas text-xs text-muted">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Volunteer</th>
                    <th className="px-4 py-2.5 font-medium">Check-in</th>
                    <th className="px-4 py-2.5 font-medium">Check-out</th>
                    <th className="px-4 py-2.5 font-medium">Hours</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {visible.map((r) => (
                    <RosterRows
                      key={r.user_id}
                      row={r}
                      event={event}
                      editing={editingId === r.user_id}
                      onEdit={() => setEditingId(editingId === r.user_id ? null : r.user_id)}
                      onSaved={async (message) => {
                        setEditingId(null);
                        await loadRoster();
                        notify(message);
                      }}
                    />
                  ))}
                  {visible.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-sm text-muted">
                        {!roster ? "Loading…" : query ? `No volunteer matches “${query}”.` : "No volunteers registered for this session yet."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="relative mt-4 flex flex-wrap items-center justify-end gap-3">
              <span className="text-xs text-muted">Volunteer has no phone or QR failed?</span>
              <Button variant="outline" disabled={closed} onClick={() => setManualOpen((o) => !o)}>
                Manual check-in
              </Button>
              <AnimatePresence>
                {manualOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97, transition: { duration: 0.15 } }}
                    style={{ transformOrigin: "bottom right" }}
                    className="absolute bottom-full right-0 z-20 mb-2 max-h-64 w-64 overflow-auto rounded-xl border border-line bg-surface p-1.5 shadow-xl shadow-ink/10"
                  >
                    <p className="px-2.5 py-1.5 text-xs text-muted">Not arrived yet</p>
                    {notArrived.length === 0 ? (
                      <p className="px-2.5 py-2 text-sm text-ink-soft">Everyone has checked in.</p>
                    ) : (
                      notArrived.map((r) => (
                        <button
                          key={r.user_id}
                          type="button"
                          onClick={() => checkInManually(r)}
                          className="block w-full truncate rounded-md px-2.5 py-2 text-left text-sm hover:bg-brand-soft hover:text-brand"
                        >
                          {r.full_name}
                        </button>
                      ))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** One volunteer, plus the correction form under the row while it is open. */
function RosterRows({
  row: r,
  event,
  editing,
  onEdit,
  onSaved,
}: {
  row: RosterRow;
  event: StaffEvent;
  editing: boolean;
  onEdit: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  return (
    <>
      <tr className="transition-colors duration-200 hover:bg-brand-soft/50">
        <td className="px-4 py-2.5">
          <p>{r.full_name}</p>
          <p className="text-xs text-muted">{r.email}</p>
        </td>
        <td className="whitespace-nowrap px-4 py-2.5 text-ink-soft">{shownTime(r.check_in_time)}</td>
        <td className="whitespace-nowrap px-4 py-2.5 text-ink-soft">{shownTime(r.check_out_time)}</td>
        <td className="px-4 py-2.5 text-ink-soft">{r.hours_served?.toFixed(2) ?? "—"}</td>
        <td className="px-4 py-2.5">
          <Badge tone={statusBadge[r.status].tone}>{statusBadge[r.status].label}</Badge>
        </td>
        <td className="px-4 py-2.5 text-right">
          <Button size="sm" variant="ghost" aria-expanded={editing} onClick={onEdit}>
            {editing ? "Close" : "Edit"}
          </Button>
        </td>
      </tr>
      {editing && (
        <tr className="bg-canvas">
          <td colSpan={6} className="px-4 py-3">
            <CorrectionForm row={r} event={event} onSaved={onSaved} />
          </td>
        </tr>
      )}
    </>
  );
}

function CorrectionForm({
  row: r,
  event,
  onSaved,
}: {
  row: RosterRow;
  event: StaffEvent;
  onSaved: (message: string) => Promise<void>;
}) {
  const [checkIn, setCheckIn] = useState(hhmm(r.check_in_time));
  const [checkOut, setCheckOut] = useState(hhmm(r.check_out_time));
  const [busy, setBusy] = useState<"save" | "absent" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const date = r.check_in_time ? utcToLocal(r.check_in_time).slice(0, 10) : event.start.slice(0, 10);

  const run = async (kind: "save" | "absent") => {
    if (kind === "save" && !checkIn) {
      setError("Enter the check-in time.");
      return;
    }
    if (kind === "save" && checkOut && checkOut <= checkIn) {
      setError("Check-out must be after check-in.");
      return;
    }
    setBusy(kind);
    setError(null);
    try {
      if (kind === "absent") await markAbsent(event.id, r.user_id);
      else await correctTimes(event.id, r.user_id, date, checkIn, checkOut);
      await onSaved(kind === "absent" ? `${r.full_name} marked absent.` : `${r.full_name}'s attendance updated.`);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(null);
    }
  };

  const inputClass =
    "mt-1 h-9 rounded-lg border border-line-strong bg-surface px-2 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/10";

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-muted">
          Check-in
          <input type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className={cx("block", inputClass)} />
        </label>
        <label className="text-xs text-muted">
          Check-out
          <input type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className={cx("block", inputClass)} />
        </label>
        <Button size="sm" variant="primary" loading={busy === "save"} disabled={!!busy} onClick={() => run("save")}>
          Save times
        </Button>
        <Button size="sm" variant="danger-outline" loading={busy === "absent"} disabled={!!busy} onClick={() => run("absent")}>
          Mark absent
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Card interactive className="p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{value}</p>
      <p className="mt-1 text-xs text-muted">{note}</p>
    </Card>
  );
}
