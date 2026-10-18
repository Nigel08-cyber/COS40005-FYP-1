"use client";

import { AnimatePresence, motion } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { isLoggedIn } from "@/lib/api/auth";
import type { Application, ApplicationStatus, Opportunity, Volunteer } from "@/lib/types";

type Action = "apply" | "withdraw" | "register" | "cancel" | "joinWaitlist" | "leaveWaitlist";

const nextStatus: Record<Action, ApplicationStatus> = {
  apply: "pending",
  withdraw: "none",
  register: "registered",
  // Cancelling keeps the coordinator's approval, so the volunteer can register again
  cancel: "approved",
  joinWaitlist: "waitlisted",
  leaveWaitlist: "none",
};

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
}

const VolunteerContext = createContext<VolunteerContextValue | null>(null);

export function useVolunteer() {
  const ctx = useContext(VolunteerContext);
  if (!ctx) throw new Error("useVolunteer must be used inside <VolunteerProvider>");
  return ctx;
}

/**
 * Holds the volunteer's application statuses in memory so every page
 * (browse, details, my activities, dashboard) shows the same state.
 * When the backend exists, `act` should call the API and then update this state.
 */
export function VolunteerProvider({
  volunteer,
  initialApplications,
  children,
}: {
  volunteer: Volunteer;
  initialApplications: Application[];
  children: React.ReactNode;
}) {
  const [statuses, setStatuses] = useState<Record<string, ApplicationStatus>>(() =>
    Object.fromEntries(initialApplications.map((a) => [a.opportunityId, a.status])),
  );
  // Signed out (or never signed in)? Send the visitor to the login page.
  // TODO(backend): replace with a real session check, ideally on the server.
  useEffect(() => {
    if (!isLoggedIn()) window.location.replace("/login");
  }, []);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const notify = useCallback((message: string) => {
    const id = nextId.current++;
    setToasts((t) => [...t.slice(-2), { id, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const value = useMemo<VolunteerContextValue>(
    () => ({
      volunteer,
      statusOf: (id) => statuses[id] ?? "none",
      act: (id, action) => {
        // TODO(backend): call the API (apply / withdraw / register / cancel / waitlist) and only
        // update the status after it succeeds. Right now the change lives in memory only.
        setStatuses((s) => ({ ...s, [id]: nextStatus[action] }));
        notify(toastText[action]);
      },
      registeredCount: (o) => o.volunteersRegisteredOthers + (statuses[o.id] === "registered" ? 1 : 0),
      notify,
    }),
    [volunteer, statuses, notify],
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
