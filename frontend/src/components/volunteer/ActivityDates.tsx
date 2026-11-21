"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { formatLongDate, formatTimeRange } from "@/lib/format";
import { downloadIcs } from "@/lib/ics";
import type { Opportunity, OpportunitySession } from "@/lib/types";
import { useVolunteer } from "./VolunteerProvider";

/** Every upcoming date of a project; an approved volunteer registers or cancels each date separately. */
export function ActivityDates({ opportunity: o }: { opportunity: Opportunity }) {
  const { statusOf, actOnDate } = useVolunteer();
  const [sessions, setSessions] = useState(o.sessions ?? []);
  const [busyId, setBusyId] = useState<number | null>(null);
  const status = statusOf(o.id);
  const canChoose = status === "approved" || status === "registered" || status === "waitlisted";

  const change = async (s: OpportunitySession) => {
    setBusyId(s.id);
    const wasWaitlisted = s.myStatus === "waitlisted";
    const result = await actOnDate(o.id, s.id, s.myStatus ? "cancel" : "register", wasWaitlisted);
    setBusyId(null);
    if (result === undefined) return;
    setSessions((list) =>
      list.map((x) => {
        if (x.id !== s.id) return x;
        if (result === "registered") return { ...x, myStatus: result, registered: x.registered + 1 };
        if (result === "waitlisted") return { ...x, myStatus: result, waitlisted: x.waitlisted + 1 };
        if (wasWaitlisted) return { ...x, myStatus: null, waitlisted: Math.max(0, x.waitlisted - 1) };
        // Giving up a spot moves the first waitlisted volunteer into it
        return x.waitlisted > 0
          ? { ...x, myStatus: null, waitlisted: x.waitlisted - 1 }
          : { ...x, myStatus: null, registered: Math.max(0, x.registered - 1) };
      }),
    );
  };

  return (
    <Card id="activity-dates" className="scroll-mt-20 p-5">
      <CardTitle>Activity dates</CardTitle>
      <p className="mt-0.5 text-xs text-muted">
        {canChoose ? "Choose the dates you can attend." : "Once your application is approved, you can choose your dates."}
      </p>
      <ul className="mt-3 divide-y divide-line text-sm">
        {sessions.map((s) => {
          const full = s.capacity !== null && s.registered >= s.capacity;
          const label =
            s.myStatus === "registered"
              ? "Cancel"
              : s.myStatus === "waitlisted"
                ? "Leave waitlist"
                : full
                  ? "Join waitlist"
                  : "Register";
          return (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                  {formatLongDate(s.start)}
                  {s.myStatus === "registered" && <Badge tone="success">Registered</Badge>}
                  {s.myStatus === "waitlisted" && <Badge>Waitlisted</Badge>}
                  {!s.myStatus && full && <Badge tone="danger">Full</Badge>}
                </p>
                <p className="mt-0.5 text-xs text-ink-soft">
                  {formatTimeRange(s.start, s.end)} · {s.registered}/{s.capacity ?? "–"} registered
                  {s.waitlisted > 0 && ` · ${s.waitlisted} waitlisted`}
                </p>
              </div>
              {canChoose && (
                <div className="flex flex-wrap gap-2">
                  {s.myStatus === "registered" && (
                    <Button variant="outline" size="sm" onClick={() => downloadIcs({ ...o, start: s.start, end: s.end })}>
                      Add to calendar
                    </Button>
                  )}
                  <Button
                    variant={s.myStatus ? "danger-outline" : full ? "outline" : "brand"}
                    size="sm"
                    loading={busyId === s.id}
                    disabled={busyId !== null}
                    onClick={() => change(s)}
                  >
                    {label}
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
