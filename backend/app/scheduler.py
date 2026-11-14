"""Scheduled notifications (backlog item 26a).

One APScheduler job runs every SCHEDULER_INTERVAL_SECONDS (default 60). Each run:
  1. plan_notifications(): queues the reminder and the post-event thank-you for events that need them
  2. deliver_pending():    sends every queued email that is due

Why one polling job instead of one job per event: the notification table is the source of truth. A reminder is queued
only if that volunteer has no reminder row for that event yet, so a restart can neither lose nor duplicate a mail, and
an event that is moved or cancelled needs no job to be edited. The job itself is in memory; there is nothing to persist.

Missed reminders (backend was off at the planned time): a reminder is still sent late as long as the event has not
started. Once the event has started it is skipped, because "starts tomorrow" would be wrong. The thank-you is sent
after the event ends, up to POST_EVENT_WINDOW_DAYS later, and only to volunteers who checked in.
"""
import logging
from datetime import datetime, timedelta

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import notifications as n
from app.config import get_settings
from app.models import Attendance, Event, Project, Registration, User, utcnow

log = logging.getLogger("app.scheduler")
_scheduler: BackgroundScheduler | None = None


def plan_notifications(db: Session, now: datetime | None = None) -> dict[str, int]:
    """Queue what is due. Safe to call repeatedly. Returns counts, for logs and tests. Commits."""
    now = now or utcnow()
    s = get_settings()
    counts = {"reminder": 0, "post_event": 0}

    # reminders: active events that start within the window and have not started
    upcoming = db.scalars(select(Event).where(
        Event.status == "active", Event.start_datetime > now,
        Event.start_datetime <= now + timedelta(hours=s.reminder_hours_before))).all()
    for ev in upcoming:
        project = db.get(Project, ev.project_id)
        for reg in db.scalars(select(Registration).where(Registration.event_id == ev.event_id, Registration.status == "registered")):
            if n.already_notified(db, reg.user_id, n.REMINDER, "event", ev.event_id):
                continue
            user = db.get(User, reg.user_id)
            if user is None or user.account_status != "active":
                continue
            n.queue(db, reg.user_id, n.REMINDER, n.event_reminder(user.full_name, ev, project.title if project else ""), "event", ev.event_id)
            counts["reminder"] += 1

    # thank-you: events that ended recently, only for volunteers who checked in
    ended = db.scalars(select(Event).where(
        Event.status.in_(("active", "completed")), Event.end_datetime <= now,
        Event.end_datetime >= now - timedelta(days=s.post_event_window_days))).all()
    for ev in ended:
        project = db.get(Project, ev.project_id)
        rows = db.execute(select(Registration, Attendance).join(Attendance, Attendance.registration_id == Registration.registration_id).where(
            Registration.event_id == ev.event_id, Registration.status == "registered", Attendance.check_in_time.is_not(None))).all()
        for reg, att in rows:
            if n.already_notified(db, reg.user_id, n.POST_EVENT, "event", ev.event_id):
                continue
            user = db.get(User, reg.user_id)
            if user is None or user.account_status != "active":
                continue
            hours = float(att.hours_served) if att.hours_served is not None else None
            n.queue(db, reg.user_id, n.POST_EVENT, n.post_event_thank_you(user.full_name, ev, project.title if project else "", hours), "event", ev.event_id)
            counts["post_event"] += 1
    db.commit()
    return counts


def tick() -> None:
    """One scheduler run. Never raises (an exception would only be logged by APScheduler anyway)."""
    from app.database import SessionLocal
    try:
        with SessionLocal() as db:
            counts = plan_notifications(db)
            sent = n.deliver_pending(db)
            if counts["reminder"] or counts["post_event"] or sent:
                log.info("scheduler: queued %s, sent %d emails", counts, sent)
    except Exception:  # noqa: BLE001
        log.exception("scheduler tick failed")


def start() -> None:
    global _scheduler
    s = get_settings()
    if not s.scheduler_enabled or _scheduler is not None:
        return
    _scheduler = BackgroundScheduler(timezone="UTC")
    # max_instances=1 + coalesce: if a run is slow, runs do not pile up
    _scheduler.add_job(tick, "interval", seconds=s.scheduler_interval_seconds, id="notifications",
                       max_instances=1, coalesce=True, next_run_time=utcnow() + timedelta(seconds=10))
    _scheduler.start()
    log.info("scheduler started, every %ss", s.scheduler_interval_seconds)


def stop() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
