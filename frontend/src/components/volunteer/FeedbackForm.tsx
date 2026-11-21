"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextArea } from "@/components/ui/Fields";
import { DataView } from "@/components/volunteer/DataView";
import type { CheckInEvent } from "@/lib/api/attendance";
import { type MyFeedback, getFeedbackPage, submitFeedback } from "@/lib/api/feedback";
import { errorMessage } from "@/lib/api/http";
import { cx, formatLongDate, formatTimeRange } from "@/lib/format";

const RATING_LABELS = ["Poor", "Fair", "Good", "Very good", "Excellent"];
const COMMENT_LIMIT = 2000;

export function FeedbackView({ id }: { id: string }) {
  const eventId = /^\d+$/.test(id) ? Number(id) : 0;
  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="relative mb-5 flex h-8 items-center justify-center">
        <Link href="/activities" className="absolute left-0 rounded text-sm text-brand hover:underline">
          ‹ Back
        </Link>
        <h1 className="text-base font-semibold">Activity feedback</h1>
      </div>
      <DataView load={() => getFeedbackPage(eventId)}>
        {({ event, attended, existing }) =>
          !event ? (
            <Notice title="Feedback not available" message="You can only rate activities you registered for." />
          ) : !attended ? (
            <Notice title="Check in first" message="Only volunteers who checked in to this activity can leave feedback." event={event} />
          ) : (
            <FeedbackForm event={event} existing={existing} />
          )
        }
      </DataView>
    </div>
  );
}

function EventSummary({ event }: { event: CheckInEvent }) {
  return (
    <Card className="p-4">
      <p className="font-semibold">{event.title}</p>
      <p className="mt-0.5 text-xs text-muted">
        {[`${formatLongDate(event.start)} · ${formatTimeRange(event.start, event.end)}`, event.venue].filter(Boolean).join(" · ")}
      </p>
    </Card>
  );
}

function Notice({ title, message, event }: { title: string; message: string; event?: CheckInEvent }) {
  return (
    <div className="space-y-4">
      {event && <EventSummary event={event} />}
      <Card className="p-8 text-center">
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm text-muted">{message}</p>
        <Button href="/activities" variant="outline" className="mt-5">
          Back to my activities
        </Button>
      </Card>
    </div>
  );
}

function Star({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cx(filled ? "fill-warning text-warning" : "fill-none text-line-strong", className)} aria-hidden>
      <path
        d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8-4.2-4.1 5.9-.9L12 3.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FeedbackForm({ event, existing }: { event: CheckInEvent; existing: MyFeedback | null }) {
  const [saved, setSaved] = useState(existing);
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comments, setComments] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shown = hovered || rating;

  const submit = async () => {
    if (!rating) {
      setError("Please choose a star rating.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      setSaved(await submitFeedback(event.id, rating, comments));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <EventSummary event={event} />
      <AnimatePresence mode="wait" initial={false}>
        {saved ? (
          <motion.div key="saved" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="p-6 text-center">
              <p className="text-lg font-bold">Thanks for your feedback!</p>
              <p className="mt-1 text-sm text-muted">It helps the organiser improve future activities.</p>
              <div className="mt-4 flex justify-center gap-1" role="img" aria-label={`${saved.rating} out of 5 stars`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} filled={n <= saved.rating} className="size-7" />
                ))}
              </div>
              <p className="mt-1 text-sm font-medium">{RATING_LABELS[saved.rating - 1]}</p>
              {saved.comments && (
                <p className="mt-4 whitespace-pre-line break-words rounded-lg bg-canvas p-3 text-left text-sm text-ink-soft [overflow-wrap:anywhere]">
                  {saved.comments}
                </p>
              )}
              <Button href="/dashboard" variant="outline" className="mt-5">
                View my dashboard
              </Button>
            </Card>
          </motion.div>
        ) : (
          <motion.div key="form" exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}>
            <Card className="p-5">
              <p className="text-center font-semibold">How was this activity?</p>
              <div
                role="radiogroup"
                aria-label="Rating"
                className="mt-4 flex justify-center gap-1"
                onMouseLeave={() => setHovered(0)}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={rating === n}
                    aria-label={`${n} star${n > 1 ? "s" : ""}: ${RATING_LABELS[n - 1]}`}
                    onMouseEnter={() => setHovered(n)}
                    onClick={() => {
                      setRating(n);
                      setError(null);
                    }}
                    className="rounded-lg p-1 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20 active:scale-95"
                  >
                    <Star filled={n <= shown} className="size-9" />
                  </button>
                ))}
              </div>
              <p className="mt-1 h-5 text-center text-sm font-medium text-ink-soft">{shown ? RATING_LABELS[shown - 1] : ""}</p>

              <div className="mt-4">
                <TextArea
                  id="feedbackComments"
                  label="Comments (optional)"
                  placeholder="What went well? What could be better?"
                  rows={5}
                  value={comments}
                  onChange={(v) => setComments(v.slice(0, COMMENT_LIMIT))}
                />
                <p className="mt-1 text-right text-[11px] text-muted">
                  {comments.length}/{COMMENT_LIMIT}
                </p>
              </div>

              {error && (
                <p role="alert" className="mt-2 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
                  {error}
                </p>
              )}
              <Button variant="primary" size="lg" className="mt-3 w-full" loading={saving} onClick={submit}>
                Submit feedback
              </Button>
              <p className="mt-2 text-center text-[11px] text-muted">
                You can submit once. Your name is visible to the project coordinator.
              </p>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
