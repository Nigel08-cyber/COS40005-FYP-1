"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { daysBetween, formatLongDate, formatTimeRange, weekdayIndex } from "@/lib/format";
import { downloadIcs } from "@/lib/ics";
import type { Opportunity, PastActivity } from "@/lib/types";
import { ActivityRow } from "./ActivityRow";
import { PrimaryAction, StatusBadge } from "./OpportunityStatus";
import { useVolunteer } from "./VolunteerProvider";

type Tab = "upcoming" | "applications" | "past";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** QR check-in opens from the day before the event. */
export const CHECK_IN_WINDOW_DAYS = 1;

export function meta(o: Opportunity) {
  return `${DAYS[weekdayIndex(o.start)]} · ${formatTimeRange(o.start, o.end)} · ${o.area}`;
}

export function MyActivities({
  opportunities,
  past,
  today,
}: {
  opportunities: Opportunity[];
  past: PastActivity[];
  today: string;
}) {
  const [tab, setTab] = useState<Tab>("upcoming");
  const { statusOf, notify } = useVolunteer();

  const byDate = [...opportunities].sort((a, b) => a.start.localeCompare(b.start));
  const upcoming = byDate.filter((o) => ["registered", "approved"].includes(statusOf(o.id)));
  const pending = byDate.filter((o) => statusOf(o.id) === "pending");
  const applications = byDate.filter((o) => statusOf(o.id) !== "none");

  const row = (o: Opportunity) => {
    const status = statusOf(o.id);
    const canCheckIn = status === "registered" && daysBetween(today, o.start) <= CHECK_IN_WINDOW_DAYS;
    return (
      <AnimatedItem key={o.id}>
        <ActivityRow
          date={o.start}
          title={o.title}
          meta={meta(o)}
          badge={<StatusBadge opportunity={o} short />}
          actions={
            <>
              <Button href={`/opportunities/${o.id}`} variant="outline">
                View details
              </Button>
              {status === "registered" && (
                <Button variant="outline" onClick={() => downloadIcs(o)}>
                  Add to calendar
                </Button>
              )}
              {canCheckIn && (
                <Button variant="brand" onClick={() => notify("QR check-in will be added in a later sprint.")}>
                  Scan to check in
                </Button>
              )}
              <PrimaryAction opportunity={o} wording="long" />
            </>
          }
        />
      </AnimatedItem>
    );
  };

  return (
    <div>
      <Tabs
        id="activities"
        items={[
          { value: "upcoming", label: "Upcoming" },
          { value: "applications", label: "Applications" },
          { value: "past", label: "Past" },
        ]}
        value={tab}
        onChange={setTab}
      />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
          transition={{ duration: 0.25 }}
          className="mt-5"
        >
          {tab === "upcoming" && (
            <>
              <List empty="No upcoming activities yet. Browse opportunities to find one.">{upcoming.map(row)}</List>
              <h2 className="mb-3 mt-8 text-lg font-semibold">Pending applications</h2>
              <List empty="No pending applications.">{pending.map(row)}</List>
            </>
          )}

          {tab === "applications" && <List empty="You have not applied to anything yet.">{applications.map(row)}</List>}

          {tab === "past" && (
            <List empty="No past activities yet.">
              {past.map((p) => (
                <AnimatedItem key={p.id}>
                  <ActivityRow
                    date={p.date}
                    title={p.title}
                    meta={`${formatLongDate(p.date)} · ${p.area}`}
                    badge={<Badge tone="success">Completed</Badge>}
                    actions={
                      <div className="text-right text-sm">
                        <p className="font-semibold">{p.hours} hours</p>
                        <p className="text-xs text-muted">{p.role}</p>
                      </div>
                    }
                  />
                </AnimatedItem>
              ))}
            </List>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function AnimatedItem({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -16, transition: { duration: 0.2 } }}
    >
      {children}
    </motion.div>
  );
}

function List({ children, empty }: { children: React.ReactNode[]; empty: string }) {
  return (
    <div className="flex flex-col gap-3">
      <AnimatePresence mode="popLayout" initial={false}>
        {children}
      </AnimatePresence>
      {children.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted">{empty}</Card>
      )}
    </div>
  );
}
