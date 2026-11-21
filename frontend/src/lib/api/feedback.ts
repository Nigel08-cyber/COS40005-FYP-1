/*
  Post-event feedback, connected to the backend (backend/app/routers/feedback.py).
  Volunteers who checked in can leave one rating (1-5) and a comment per event; staff read the results.
*/
import { type CheckInEvent, getMyAttendance, getMyEvents, toCheckInEvent } from "@/lib/api/attendance";
import { ApiError, api, utcToLocal } from "@/lib/api/http";

export interface MyFeedback {
  rating: number;
  comments: string | null;
  submitted_at: string;
}

export interface PendingFeedback {
  eventId: number;
  title: string;
  /** Malaysia local time */
  end: string;
}

export interface EventFeedback {
  count: number;
  average_rating: number | null;
  rating_counts: Record<string, number>;
  rows: { feedback_id: number; volunteer_name: string; rating: number; comments: string | null; submitted_at: string }[];
}

async function getMyFeedback(eventId: number) {
  try {
    return await api<MyFeedback>(`/events/${eventId}/feedback/me`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

/** Everything the feedback page needs. `event` is null when the volunteer did not sign up for this event. */
export async function getFeedbackPage(eventId: number): Promise<{
  event: CheckInEvent | null;
  attended: boolean;
  existing: MyFeedback | null;
}> {
  const { upcoming, past } = await getMyEvents();
  const found = [...past, ...upcoming].find((a) => a.event_id === eventId);
  if (!found) return { event: null, attended: false, existing: null };
  const [attendance, existing] = await Promise.all([getMyAttendance(eventId), getMyFeedback(eventId)]);
  return { event: toCheckInEvent(found), attended: !!attendance?.check_in_time, existing };
}

export const submitFeedback = (eventId: number, rating: number, comments: string) =>
  api<MyFeedback>(`/events/${eventId}/feedback`, { method: "POST", json: { rating, comments: comments.trim() || null } });

/** Events the volunteer attended and has not rated yet. */
export async function getPendingFeedback(): Promise<PendingFeedback[]> {
  const rows = await api<{ event_id: number; project_title: string; end_datetime: string }[]>("/me/feedback/pending");
  return rows.map((r) => ({ eventId: r.event_id, title: r.project_title, end: utcToLocal(r.end_datetime) }));
}

export const getEventFeedback = (eventId: number) => api<EventFeedback>(`/events/${eventId}/feedback`);
