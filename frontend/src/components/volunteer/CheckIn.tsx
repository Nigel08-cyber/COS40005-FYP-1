"use client";

import { AnimatePresence, motion } from "motion/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { type CheckInEvent, type MyAttendance, type ScanResult, getCheckInContext, scanAttendance } from "@/lib/api/attendance";
import { ApiError, errorMessage, utcMs, utcToLocal } from "@/lib/api/http";
import { formatShortDate, formatTime, formatTimeRange } from "@/lib/format";
import { useVolunteer } from "./VolunteerProvider";

// The camera only exists in the browser
const Scanner = dynamic(() => import("@yudiel/react-qr-scanner").then((m) => m.Scanner), { ssr: false });

type Screen =
  | { kind: "loading" }
  | { kind: "none" }
  | { kind: "scan" }
  | { kind: "working" }
  | { kind: "onSite" }
  | { kind: "checkedIn"; result: ScanResult }
  | { kind: "checkedOut"; checkIn: string; checkOut: string }
  | { kind: "problem"; title: string; message: string };

const localTime = (utc: string) => formatTime(utcToLocal(utc));

/** "5 h 02 m" */
function duration(fromUtc: string, toUtc: string) {
  const minutes = Math.max(0, Math.round((utcMs(toUtc) - utcMs(fromUtc)) / 60_000));
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} m`;
}

/** A clear heading for each error the scan endpoint can return; the message itself comes from the backend. */
function problemFor(e: unknown) {
  const message = errorMessage(e);
  if (e instanceof ApiError && e.status === 400) {
    return { title: "QR code expired", message: "This code is no longer valid. Ask your coordinator to show the latest code and try again." };
  }
  if (e instanceof ApiError && e.status === 403) return { title: "Not registered", message };
  if (message.startsWith("Check-in opens")) return { title: "Check-in is not open yet", message };
  if (message.includes("already checked out")) return { title: "Already checked out", message };
  if (message.includes("just checked in")) return { title: "Already checked in", message };
  if (message.includes("has ended") || message.includes("has closed")) return { title: "Outside the event time", message };
  return { title: "Could not record your attendance", message };
}

/** Wireframes 15b–15f: scan, checked in, on site, check-out summary, and expired or invalid codes. */
export function CheckIn() {
  const params = useSearchParams();
  const [initial] = useState(() => ({ token: params.get("token"), eventId: Number(params.get("event")) || null }));
  const [screen, setScreen] = useState<Screen>({ kind: initial.token ? "working" : "loading" });
  const [event, setEvent] = useState<CheckInEvent | null>(null);
  const [attendance, setAttendance] = useState<MyAttendance | null>(null);
  const started = useRef(false);
  const submitting = useRef(false);

  const showContext = (next: Awaited<ReturnType<typeof getCheckInContext>>) => {
    setEvent(next.event);
    setAttendance(next.attendance);
    if (!next.event) setScreen({ kind: "none" });
    else if (next.attendance?.status === "checked_in") setScreen({ kind: "onSite" });
    else if (next.attendance?.status === "checked_out" && next.attendance.check_in_time && next.attendance.check_out_time) {
      setScreen({ kind: "checkedOut", checkIn: next.attendance.check_in_time, checkOut: next.attendance.check_out_time });
    } else setScreen({ kind: "scan" });
  };

  const sendScan = (token: string) => {
    submitting.current = true;
    scanAttendance(token)
      .then(async (result) => {
        // The scan is already saved: if this extra read fails, still show the success screen
        const next = await getCheckInContext(result.event_id).catch(() => null);
        if (next) {
          setEvent(next.event);
          setAttendance(next.attendance);
        }
        if (result.action === "checked_in") setScreen({ kind: "checkedIn", result });
        else setScreen({ kind: "checkedOut", checkIn: result.check_in_time!, checkOut: result.check_out_time! });
      })
      .catch((e) => setScreen({ kind: "problem", ...problemFor(e) }))
      .finally(() => {
        submitting.current = false;
      });
  };

  const submit = (token: string) => {
    if (submitting.current) return; // the camera reports the same code many times per second
    setScreen({ kind: "working" });
    sendScan(token);
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (initial.token) {
      // Remove the code from the address first, so reloading the page can never count as a second scan
      window.history.replaceState(null, "", "/check-in");
      sendScan(initial.token);
    } else {
      getCheckInContext(initial.eventId)
        .then(showContext)
        .catch((e) => setScreen({ kind: "problem", title: "Could not load your activity", message: errorMessage(e) }));
    }
    // Runs once when the page opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const heading =
    screen.kind === "onSite"
      ? "Today"
      : screen.kind === "checkedOut" || (screen.kind === "scan" && attendance?.status === "checked_in")
        ? "Check out"
        : "Check in";

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="relative mb-5 flex h-8 items-center justify-center">
        <Link href="/activities" className="absolute left-0 rounded text-sm text-brand hover:underline">
          ‹ Back
        </Link>
        <h1 className="text-base font-semibold">{heading}</h1>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={screen.kind}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
          transition={{ duration: 0.2 }}
        >
          {(screen.kind === "loading" || screen.kind === "working") && (
            <Card className="p-8 text-center text-sm text-muted" aria-busy="true">
              {screen.kind === "working" ? "Recording your attendance…" : "Loading your activity…"}
            </Card>
          )}
          {screen.kind === "none" && <NoActivity />}
          {screen.kind === "scan" && (
            <ScanScreen event={event} checkingOut={attendance?.status === "checked_in"} onCode={submit} />
          )}
          {screen.kind === "checkedIn" && (
            <CheckedIn event={event} result={screen.result} onDone={() => setScreen({ kind: "onSite" })} />
          )}
          {screen.kind === "onSite" && event && attendance?.check_in_time && (
            <OnSite event={event} checkIn={attendance.check_in_time} onScan={() => setScreen({ kind: "scan" })} />
          )}
          {screen.kind === "checkedOut" && (
            <CheckedOut event={event} checkIn={screen.checkIn} checkOut={screen.checkOut} />
          )}
          {screen.kind === "problem" && (
            <Problem title={screen.title} message={screen.message} onRetry={() => setScreen({ kind: "scan" })} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function EventCard({ event }: { event: CheckInEvent }) {
  return (
    <Card className="p-4">
      <p className="font-semibold">{event.title}</p>
      <p className="mt-0.5 text-xs text-muted">
        {[`${formatShortDate(event.start)} · ${formatTimeRange(event.start, event.end)}`, event.venue].filter(Boolean).join(" · ")}
      </p>
    </Card>
  );
}

function NoActivity() {
  return (
    <Card className="p-8 text-center">
      <p className="font-semibold">No activity to check in to</p>
      <p className="mt-1 text-sm text-muted">Register for an activity first. It will show here on the day.</p>
      <Button href="/opportunities" variant="primary" className="mt-5">
        Browse opportunities
      </Button>
    </Card>
  );
}

function ScanScreen({
  event,
  checkingOut,
  onCode,
}: {
  event: CheckInEvent | null;
  checkingOut: boolean;
  onCode: (token: string) => void;
}) {
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const onError = () => {
    setCameraError(
      window.isSecureContext
        ? "Camera permission is required. Allow the camera in your browser settings, then try again."
        : "The camera only works on a secure (https) page.",
    );
  };

  return (
    <div className="space-y-4">
      {event && <EventCard event={event} />}
      <div className="relative aspect-square overflow-hidden rounded-xl bg-ink">
        {cameraError ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
            <p role="alert" className="text-sm text-white">
              {cameraError}
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setCameraError(null);
                setAttempt((n) => n + 1);
              }}
            >
              Try again
            </Button>
          </div>
        ) : (
          <>
            <Scanner
              key={attempt}
              formats={["qr_code"]}
              sound={false}
              components={{ finder: false, torch: false, zoom: false, onOff: false }}
              constraints={{ facingMode: "environment" }}
              styles={{ container: { width: "100%", height: "100%" }, video: { objectFit: "cover" } }}
              onScan={(codes) => codes[0]?.rawValue && onCode(codes[0].rawValue)}
              onError={onError}
            />
            <span className="pointer-events-none absolute inset-[18%] rounded-lg border-2 border-white" aria-hidden />
          </>
        )}
      </div>
      <div className="text-center">
        <p className="text-sm text-ink">Point your camera at the event QR code{checkingOut ? " to check out" : ""}</p>
        <p className="mt-1 text-xs text-muted">Camera permission is required</p>
      </div>
    </div>
  );
}

function ResultIcon({ tone = "success" }: { tone?: "success" | "warning" }) {
  const warning = tone === "warning";
  return (
    <motion.span
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`flex size-16 items-center justify-center rounded-full text-2xl font-bold ${
        warning ? "bg-warning/15 text-warning" : "bg-success/15 text-success"
      }`}
      aria-hidden
    >
      {warning ? "!" : "✓"}
    </motion.span>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  );
}

function CheckedIn({ event, result, onDone }: { event: CheckInEvent | null; result: ScanResult; onDone: () => void }) {
  return (
    <div>
      <ResultIcon />
      <h2 className="mt-5 text-center text-xl font-bold">You are checked in</h2>
      <p className="mt-1 text-center text-sm text-muted">Your attendance has been recorded.</p>
      <Card className="mt-5 p-4">
        <dl>
          <InfoRow label="Activity" value={event?.title ?? result.event_title} />
          <InfoRow label="Role" value="Volunteer" />
          <InfoRow label="Check-in time" value={result.check_in_time ? localTime(result.check_in_time) : "—"} />
        </dl>
      </Card>
      <p className="mt-4 text-xs leading-relaxed text-muted">
        Remember to scan the QR code again before you leave so your hours are counted.
      </p>
      <Button variant="primary" size="lg" className="mt-4 w-full" onClick={onDone}>
        Done
      </Button>
    </div>
  );
}

function OnSite({ event, checkIn, onScan }: { event: CheckInEvent; checkIn: string; onScan: () => void }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const seconds = Math.max(0, Math.floor((now - utcMs(checkIn)) / 1000));
  const two = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-brand-line bg-brand-soft p-5 text-center">
        <p className="text-xs text-brand">Time on site</p>
        <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight text-brand" role="timer">
          {two(Math.floor(seconds / 3600))}:{two(Math.floor(seconds / 60) % 60)}:{two(seconds % 60)}
        </p>
        <span className="mt-2 inline-block rounded-full bg-success/15 px-2.5 py-0.5 text-xs text-success">
          Checked in at {localTime(checkIn)}
        </span>
      </div>
      <EventCard event={event} />
      <Button variant="brand" size="lg" className="w-full" onClick={onScan}>
        Scan to check out
      </Button>
      <Button href={`/opportunities/${event.projectId}`} variant="outline" size="lg" className="w-full">
        View event details
      </Button>
    </div>
  );
}

function CheckedOut({ event, checkIn, checkOut }: { event: CheckInEvent | null; checkIn: string; checkOut: string }) {
  const { volunteer } = useVolunteer();
  const router = useRouter();
  return (
    <div>
      <ResultIcon />
      <h2 className="mt-5 text-center text-xl font-bold">Thank you{volunteer.firstName ? `, ${volunteer.firstName}` : ""}!</h2>
      <Card className="mt-5 p-4">
        <dl>
          <InfoRow label="Check-in" value={localTime(checkIn)} />
          <InfoRow label="Check-out" value={localTime(checkOut)} />
        </dl>
        <div className="mt-2 border-t border-line pt-3 text-center">
          <p className="text-xs text-muted">Volunteer hours</p>
          <p className="mt-1 text-3xl font-bold tracking-tight">{duration(checkIn, checkOut)}</p>
          <p className="mt-1 text-[11px] text-muted">Hours = check-out time – check-in time</p>
        </div>
      </Card>
      <p className="mt-4 text-xs text-muted">Added to your contribution history.</p>
      <div className="mt-4 space-y-2">
        {event && (
          <Button href={`/feedback/${event.id}`} variant="primary" size="lg" className="w-full">
            Give feedback
          </Button>
        )}
        <Button variant="outline" size="lg" className="w-full" onClick={() => router.push("/dashboard")}>
          View my dashboard
        </Button>
      </div>
    </div>
  );
}

function Problem({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return (
    <div role="alert">
      <ResultIcon tone="warning" />
      <h2 className="mt-5 text-center text-xl font-bold">{title}</h2>
      <p className="mt-2 text-center text-sm text-muted">{message}</p>
      <Button variant="primary" size="lg" className="mt-5 w-full" onClick={onRetry}>
        Scan again
      </Button>
      <Button href="/activities" variant="outline" size="lg" className="mt-2 w-full">
        Back to my activities
      </Button>
    </div>
  );
}
