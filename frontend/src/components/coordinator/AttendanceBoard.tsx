"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { SLIDE_SPRING } from "@/components/ui/MotionProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { useStaff } from "@/components/staff/StaffShell";
import { getQrToken } from "@/lib/api/coordinator";
import { cx, formatShortDate, formatTime, formatTimeRange } from "@/lib/format";
import type { AttendanceEvent, AttendanceRecord, AttendanceStatus } from "@/lib/staffTypes";
import { FakeQr } from "./FakeQr";

type Mode = "check_in" | "check_out";

const statusBadge: Record<AttendanceStatus, { tone: Tone; label: string }> = {
  checked_in: { tone: "success", label: "Checked in" },
  checked_out: { tone: "neutral", label: "Checked out" },
  not_arrived: { tone: "warning", label: "Not arrived" },
};

/** "08:03" -> "8:03 AM" */
const time = (hhmm: string) => formatTime(`2000-01-01T${hhmm}`);

function minutesBetween(from: string, to: string) {
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  return Math.max(0, th * 60 + tm - (fh * 60 + fm));
}

function hoursOf(r: AttendanceRecord) {
  return r.checkIn && r.checkOut ? minutesBetween(r.checkIn, r.checkOut) / 60 : 0;
}

function nowHHmm() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Wireframe 15a · Coordinator: event QR & live attendance. */
export function AttendanceBoard({ event, initialRoster }: { event: AttendanceEvent; initialRoster: AttendanceRecord[] }) {
  const { notify } = useStaff();
  const [roster, setRoster] = useState(initialRoster);
  const [mode, setMode] = useState<Mode>("check_in");
  const [token, setToken] = useState("loading");
  const [secondsLeft, setSecondsLeft] = useState(event.qrRefreshSeconds);
  const [closed, setClosed] = useState(false);
  const [query, setQuery] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const qrCard = useRef<HTMLDivElement>(null);

  const modeRef = useRef(mode);
  const deadline = useRef(0);

  /** Fetch a new token and restart the countdown. */
  const refresh = useCallback(
    (nextMode: Mode) =>
      getQrToken(nextMode).then((t) => {
        deadline.current = Date.now() + event.qrRefreshSeconds * 1000;
        setToken(t);
        setSecondsLeft(event.qrRefreshSeconds);
      }),
    [event.qrRefreshSeconds],
  );

  // New token whenever the mode changes (and on first load) while the event is open
  useEffect(() => {
    modeRef.current = mode;
    if (!closed) void refresh(mode);
  }, [mode, closed, refresh]);

  // Countdown; when it reaches zero the token rotates
  useEffect(() => {
    if (closed) return;
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) void refresh(modeRef.current);
    }, 1000);
    return () => clearInterval(id);
  }, [closed, refresh]);

  const checkedIn = roster.filter((r) => r.status !== "not_arrived").length;
  const notArrived = roster.filter((r) => r.status === "not_arrived");
  const checkedOut = roster.filter((r) => r.status === "checked_out").length;
  const hoursLogged = roster.reduce((sum, r) => sum + hoursOf(r), 0);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? roster.filter((r) => `${r.volunteer} ${r.role}`.toLowerCase().includes(q)) : roster;
  }, [roster, query]);

  const manualCheckIn = (id: string) => {
    // TODO(backend): POST the manual check-in so it is recorded with the coordinator's name
    const name = roster.find((r) => r.id === id)?.volunteer;
    setRoster((rs) => rs.map((r) => (r.id === id ? { ...r, status: "checked_in", checkIn: nowHHmm() } : r)));
    setManualOpen(false);
    notify(`${name} checked in manually.`);
  };

  const closeEvent = () => {
    if (!window.confirm("Close this event? The QR code stops working and attendance is locked.")) return;
    // TODO(backend): close the event on the server
    setClosed(true);
    notify("Event closed. Attendance is locked.");
  };

  const downloadCsv = () => {
    const rows = [
      ["Volunteer", "Role", "Check-in", "Check-out", "Hours", "Status"],
      ...roster.map((r) => [
        r.volunteer,
        r.role,
        r.checkIn ?? "",
        r.checkOut ?? "",
        hoursOf(r) ? hoursOf(r).toFixed(1) : "",
        statusBadge[r.status].label,
      ]),
    ];
    const csv = rows.map((row) => row.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${event.title.replace(/\s+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fullScreen = () => {
    void qrCard.current?.requestFullscreen?.();
  };

  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={`Attendance · ${event.title}`}
        subtitle={`${formatShortDate(event.start)} · ${formatTimeRange(event.start, event.end)} · ${event.area}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={downloadCsv}>
              Download attendance
            </Button>
            <Button variant="primary" disabled={closed} onClick={closeEvent}>
              {closed ? "Event closed" : "Close event"}
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card className="p-5">
          <CardTitle>Event QR code</CardTitle>
          <p className="text-xs text-muted">Rotating token with expiry. Display on a screen at the venue.</p>

          <div className="mt-4 grid grid-cols-2 rounded-lg bg-canvas p-1" role="tablist" aria-label="QR mode">
            {(["check_in", "check_out"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                disabled={closed}
                onClick={() => setMode(m)}
                className={cx(
                  "relative rounded-md py-1.5 text-sm disabled:opacity-60",
                  mode === m ? "font-medium text-ink" : "text-muted hover:text-ink",
                )}
              >
                {mode === m && (
                  <motion.span layoutId="qr-mode" className="absolute inset-0 rounded-md bg-surface shadow-sm" transition={SLIDE_SPRING} />
                )}
                <span className="relative">{m === "check_in" ? "Check-in" : "Check-out"}</span>
              </button>
            ))}
          </div>

          <div
            ref={qrCard}
            className="relative mt-4 flex flex-col items-center justify-center rounded-lg bg-surface [&:fullscreen]:bg-white"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={token}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: closed ? 0.15 : 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.25 }}
                className="w-full max-w-60 [:fullscreen_&]:max-w-[70vh]"
              >
                <FakeQr token={token} className="w-full" />
              </motion.div>
            </AnimatePresence>
            {closed && <p className="absolute text-sm font-semibold text-ink">Event closed</p>}
            <p className={cx("mt-3 text-sm font-medium", closed ? "text-muted" : "text-warning")}>
              {closed ? "QR code disabled" : `${mode === "check_in" ? "Check-in" : "Check-out"} · refreshes in ${mm}:${ss}`}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="outline" disabled={closed} onClick={() => void refresh(mode)}>
              Refresh now
            </Button>
            <Button variant="outline" disabled={closed} onClick={fullScreen}>
              Full screen
            </Button>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            Scanning outside the event window or with an expired code is rejected.
          </p>
        </Card>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Stat label="Checked in" value={`${checkedIn} / ${event.expectedVolunteers}`} note={`${notArrived.length} not arrived`} />
            <Stat label="Checked out" value={String(checkedOut)} note={checkedOut ? "volunteers" : "—"} />
            <Stat label="Hours logged" value={`${hoursLogged.toFixed(hoursLogged % 1 ? 1 : 0)} h`} note="updates at check-out" />
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

            <div className="mt-4 max-h-96 overflow-auto rounded-lg border border-line">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-canvas text-xs text-muted">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Volunteer</th>
                    <th className="px-4 py-2.5 font-medium">Role</th>
                    <th className="px-4 py-2.5 font-medium">Check-in</th>
                    <th className="px-4 py-2.5 font-medium">Check-out</th>
                    <th className="px-4 py-2.5 font-medium">Hours</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {visible.map((r) => (
                    <motion.tr key={r.id} layout className="transition-colors duration-200 hover:bg-brand-soft/50">
                      <td className="px-4 py-2.5">{r.volunteer}</td>
                      <td className="px-4 py-2.5 text-ink-soft">{r.role}</td>
                      <td className="px-4 py-2.5 text-ink-soft">{r.checkIn ? time(r.checkIn) : "—"}</td>
                      <td className="px-4 py-2.5 text-ink-soft">{r.checkOut ? time(r.checkOut) : "—"}</td>
                      <td className="px-4 py-2.5 text-ink-soft">{hoursOf(r) ? hoursOf(r).toFixed(1) : "—"}</td>
                      <td className="px-4 py-2.5">
                        <Badge tone={statusBadge[r.status].tone}>{statusBadge[r.status].label}</Badge>
                      </td>
                    </motion.tr>
                  ))}
                  {visible.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-sm text-muted">
                        No volunteer matches “{query}”.
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
                    className="absolute bottom-full right-0 z-20 mb-2 w-64 rounded-xl border border-line bg-surface p-1.5 shadow-xl shadow-ink/10"
                  >
                    <p className="px-2.5 py-1.5 text-xs text-muted">Not arrived yet</p>
                    {notArrived.length === 0 ? (
                      <p className="px-2.5 py-2 text-sm text-ink-soft">Everyone has checked in.</p>
                    ) : (
                      notArrived.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => manualCheckIn(r.id)}
                          className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm hover:bg-brand-soft hover:text-brand"
                        >
                          {r.volunteer}
                          <span className="text-xs text-muted">{r.role}</span>
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

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Card interactive className="p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{value}</p>
      <p className="mt-1 text-xs text-muted">{note}</p>
    </Card>
  );
}
