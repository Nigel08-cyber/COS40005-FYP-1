"use client";

import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Select } from "@/components/ui/Fields";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataView } from "@/components/volunteer/DataView";
import { type StaffEvent, staffEventLabel } from "@/lib/api/attendance";
import { type EventFeedback, getEventFeedback } from "@/lib/api/feedback";
import { shortDay, utcToLocal } from "@/lib/api/http";
import { cx } from "@/lib/format";

const STARS = [5, 4, 3, 2, 1];

/** Coordinator: average rating, how many of each star, and every comment for one session. */
export function FeedbackBoard({ events }: { events: StaffEvent[] }) {
  // Finished sessions first: that is where feedback comes from
  const ordered = useMemo(() => {
    const now = utcToLocal(new Date().toISOString().slice(0, 19));
    return [...events.filter((e) => e.end < now), ...events.filter((e) => e.end >= now)];
  }, [events]);
  const [eventId, setEventId] = useState(ordered[0]?.id ?? 0);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Feedback" subtitle="See how volunteers rated your sessions." />
      {ordered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted">No published sessions yet.</Card>
      ) : (
        <>
          <Select
            label="Choose a session"
            className="mb-5 max-w-xl"
            value={String(eventId)}
            onChange={(v) => setEventId(Number(v))}
            options={ordered.map((e) => ({ value: String(e.id), label: staffEventLabel(e) }))}
          />
          <DataView key={eventId} load={() => getEventFeedback(eventId)}>
            {(data) => <Results data={data} />}
          </DataView>
        </>
      )}
    </div>
  );
}

function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cx("inline-flex gap-0.5", className)} role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= Math.round(value) ? "text-warning" : "text-line-strong"} aria-hidden>
          ★
        </span>
      ))}
    </span>
  );
}

function Results({ data }: { data: EventFeedback }) {
  const [star, setStar] = useState<number | null>(null);
  const shown = star ? data.rows.filter((r) => r.rating === star) : data.rows;

  if (data.count === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="font-semibold">No feedback yet</p>
        <p className="mt-1 text-sm text-muted">Volunteers who checked in can rate this session after attending.</p>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <Card className="h-fit p-5">
        <CardTitle>Overall rating</CardTitle>
        <p className="mt-3 text-4xl font-bold tracking-tight">
          {data.average_rating?.toFixed(1)}
          <span className="ml-1 text-base font-normal text-muted">/ 5</span>
        </p>
        <Stars value={data.average_rating ?? 0} className="mt-1 text-lg" />
        <p className="mt-1 text-xs text-muted">
          {data.count} {data.count === 1 ? "review" : "reviews"}
        </p>

        <div className="mt-5 space-y-1">
          {STARS.map((n) => {
            const count = data.rating_counts[String(n)] ?? 0;
            const active = star === n;
            return (
              <button
                key={n}
                type="button"
                aria-pressed={active}
                aria-label={`Show ${n} star reviews (${count})`}
                disabled={count === 0}
                onClick={() => setStar(active ? null : n)}
                className={cx(
                  "flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-xs disabled:cursor-default",
                  active ? "bg-brand-soft" : "enabled:hover:bg-canvas",
                )}
              >
                <span className="w-7 shrink-0 text-left text-ink-soft">{n} ★</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-line">
                  <motion.span
                    className="block h-full rounded-full bg-warning"
                    initial={{ width: 0 }}
                    animate={{ width: `${(count / data.count) * 100}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </span>
                <span className="w-5 shrink-0 text-right text-muted">{count}</span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="min-w-0 p-5">
        <CardTitle>{star ? `${star}-star reviews` : "All reviews"}</CardTitle>
        <ul className="mt-3 divide-y divide-line">
          {shown.map((r) => (
            <li key={r.feedback_id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{r.volunteer_name}</p>
                <span className="flex items-center gap-2 text-xs text-muted">
                  <Stars value={r.rating} />
                  {shortDay(utcToLocal(r.submitted_at))}
                </span>
              </div>
              <p
                className={cx(
                  "mt-1 whitespace-pre-line break-words text-sm [overflow-wrap:anywhere]",
                  r.comments ? "text-ink-soft" : "italic text-faint",
                )}
              >
                {r.comments || "No comment"}
              </p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
