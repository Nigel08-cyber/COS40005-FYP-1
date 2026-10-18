"use client";

import { AnimatePresence, motion } from "motion/react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatLongDate, formatTimeRange } from "@/lib/format";
import { downloadIcs } from "@/lib/ics";
import type { Opportunity } from "@/lib/types";
import { PrimaryAction, StatusBadge } from "./OpportunityStatus";
import { useVolunteer } from "./VolunteerProvider";

/** Right column of the project details page (wireframe 11b). */
export function DetailSidebar({ opportunity: o }: { opportunity: Opportunity }) {
  const { registeredCount, statusOf, act } = useVolunteer();
  const registered = registeredCount(o);
  const left = Math.max(0, o.volunteersNeeded - registered);
  const status = statusOf(o.id);

  return (
    <aside className="space-y-4">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold">{formatLongDate(o.start)}</p>
          <StatusBadge opportunity={o} />
        </div>
        <p className="mt-0.5 text-xs text-muted">
          {formatTimeRange(o.start, o.end)} · {o.area}
        </p>

        <div className="mb-1.5 mt-4 flex justify-between text-xs">
          <span className="font-medium">Spots filled</span>
          <span className="text-muted">
            {registered}/{o.volunteersNeeded} volunteers
          </span>
        </div>
        <ProgressBar value={registered} max={o.volunteersNeeded} />
        <p className={left > 0 ? "mt-1.5 text-xs text-success" : "mt-1.5 text-xs text-danger"}>
          {left > 0 ? `${left} ${left === 1 ? "spot" : "spots"} left` : "No spots left"}
        </p>

        <div className="mt-4 space-y-2">
          <PrimaryAction opportunity={o} size="lg" wording="long" />
          <Button variant="outline" size="lg" className="w-full" onClick={() => downloadIcs(o)}>
            Add to calendar (.ics)
          </Button>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          Your application is reviewed by the project coordinator. Once approved you can register for the event.
        </p>
      </Card>

      {o.matchPercent !== undefined && (
        <Card tone="brand" className="p-5 transition-shadow duration-300 hover:shadow-lg hover:shadow-brand/10">
          <p className="text-sm font-semibold">Recommended for you</p>
          <p className="mt-1 text-3xl font-bold text-brand">{o.matchPercent}% match</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {o.matchReasons?.map((r) => (
              <Badge key={r} tone="brand">
                {r}
              </Badge>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-ink-soft">
            This is a suggestion only. The NGO coordinator makes the final assignment.
          </p>
          <AnimatePresence mode="wait" initial={false}>
            {status === "none" ? (
              <motion.div key="accept" exit={{ opacity: 0, y: -4 }} className="mt-4">
                <Button variant="brand" size="lg" className="w-full" onClick={() => act(o.id, "apply")}>
                  Accept recommendation
                </Button>
              </motion.div>
            ) : (
              <motion.p
                key="accepted"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 rounded-lg bg-surface/70 px-3 py-2.5 text-center text-xs font-medium text-brand"
              >
                ✓ You have responded to this recommendation
              </motion.p>
            )}
          </AnimatePresence>
        </Card>
      )}
    </aside>
  );
}
