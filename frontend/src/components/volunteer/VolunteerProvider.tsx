"use client";

import { AnimatePresence, motion } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { PageSkeleton } from "@/components/volunteer/DataView";
import {
  applyToProject,
  cancelRegistration,
  getMyApplications,
  registerForOpportunity,
  withdrawApplication,
} from "@/lib/api/volunteer";
import { errorMessage } from "@/lib/api/http";
import { initialsOf, useSessionGuard } from "@/lib/useSessionGuard";
import type { ApplicationStatus, Opportunity, Volunteer } from "@/lib/types";

type Action = "apply" | "withdraw" | "register" | "cancel" | "joinWaitlist" | "leaveWaitlist";

const toastText: Record<Action, string> = {
  apply: "Application sent. The coordinator will review it.",
  withdraw: "Application withdrawn.",
  register: "You're registered. See you there!",
  cancel: "Participation cancelled.",
  joinWaitlist: "Added to the waitlist.",
  leaveWaitlist: "Removed from the waitlist.",
};

interface Toast {
  id: number;
  message: string;
}

interface VolunteerContextValue {
  volunteer: Volunteer;
  statusOf: (opportunityId: string) => ApplicationStatus;
  act: (opportunityId: string, action: Action) => void;
  /** Registered volunteers including the signed-in volunteer, if registered. */
  registeredCount: (opportunity: Opportunity) => number;
  notify: (message: string) => void;
  /** Whether the session and the volunteer's statuses are loaded (see <VolunteerGate>) */
  state: { phase: "loading" | "error" | "ready"; error: string | null; retry: () => void };
}

const VolunteerContext = createContext<VolunteerContextValue | null>(null);

export function useVolunteer() {
  const ctx = useContext(VolunteerContext);
  if (!ctx) throw new Error("useVolunteer must be used inside <VolunteerProvider>");
  return ctx;
}

/** Shows a skeleton (or an error with a retry button) until the volunteer's session and statuses are loaded. */
export function VolunteerGate({ children }: { children: React.ReactNode }) {
  const { state } = useVolunteer();
  if (state.phase === "ready") return <>{children}</>;
  if (state.phase === "error") {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-ink-soft">{state.error}</p>
        <Button className="mt-4" onClick={state.retry}>
          Try again
        </Button>
      </div>
    );
  }
  return <PageSkeleton />;
}

/**
 * Holds the volunteer's application statuses so every page (browse, details, my activities, dashboard)
 * shows the same state. `act` calls the API and only updates the status after it succeeds.
 * Wrap the page content in <VolunteerGate> so it only renders once the session and statuses are loaded.
 */
export function VolunteerProvider({ children }: { children: React.ReactNode }) {
  // Login check: signed-out visitors go to /login, other roles to their own pages
  const sessionUser = useSessionGuard(["volunteer"]);
  const [statuses, setStatuses] = useState<Record<string, ApplicationStatus> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const busy = useRef(new Set<string>());

  useEffect(() => {
    if (!sessionUser) return;
    let cancelled = false;
    getMyApplications()
      .then((apps) => !cancelled && setStatuses(Object.fromEntries(apps.map((a) => [a.opportunityId, a.status]))))
      .catch((e) => !cancelled && setLoadError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [sessionUser, attempt]);

  const shownVolunteer = useMemo<Volunteer>(
    () => ({
      id: String(sessionUser?.id ?? ""),
      fullName: sessionUser?.fullName ?? "",
      firstName: sessionUser?.fullName.split(/\s+/)[0] ?? "",
      initials: sessionUser ? initialsOf(sessionUser.fullName) : "",
      email: sessionUser?.email ?? "",
      roleLabel: "Volunteer",
    }),
    [sessionUser],
  );

  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const notify = useCallback((message: string) => {
    const id = nextId.current++;
    setToasts((t) => [...t.slice(-2), { id, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const act = useCallback(
    async (id: string, action: Action) => {
      if (busy.current.has(id)) return; // ignore double clicks while a request is running
      busy.current.add(id);
      try {
        let next: ApplicationStatus;
        let message = toastText[action];
        if (action === "apply") {
          await applyToProject(id);
          next = "pending";
        } else if (action === "withdraw") {
          await withdrawApplication(id);
          next = "none";
        } else if (action === "register" || action === "joinWaitlist") {
          // A full event puts the volunteer on the waitlist, whichever button was pressed
          next = await registerForOpportunity(id);
          if (next === "waitlisted") message = toastText.joinWaitlist;
        } else {
          await cancelRegistration(id);
          next = "approved"; // the coordinator's approval stays, so the volunteer can register again
        }
        setStatuses((s) => ({ ...s, [id]: next }));
        notify(message);
      } catch (e) {
        notify(errorMessage(e));
      } finally {
        busy.current.delete(id);
      }
    },
    [notify],
  );

  const value = useMemo<VolunteerContextValue>(
    () => ({
      volunteer: shownVolunteer,
      statusOf: (id) => statuses?.[id] ?? "none",
      act: (id, action) => void act(id, action),
      registeredCount: (o) => o.volunteersRegisteredOthers + (statuses?.[o.id] === "registered" ? 1 : 0),
      notify,
      state: {
        phase: loadError ? "error" : sessionUser !== null && statuses !== null ? "ready" : "loading",
        error: loadError,
        retry: () => {
          setLoadError(null);
          setAttempt((n) => n + 1);
        },
      },
    }),
    [shownVolunteer, statuses, act, notify, sessionUser, loadError],
  );

  return (
    <VolunteerContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2" aria-live="polite">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, transition: { duration: 0.2 } }}
              className="pointer-events-auto flex items-center gap-2.5 rounded-lg bg-ink px-4 py-3 text-sm text-white shadow-xl shadow-ink/20"
            >
              <span className="size-2 rounded-full bg-success" aria-hidden />
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </VolunteerContext.Provider>
  );
}
