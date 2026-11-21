"""Notifications (backlog items 24 and 26a): message templates, the queue, and delivery.

Every notification is a row in the notification table. An in-app row is shown in the bell straight away. An email row
starts as 'scheduled' and deliver_pending() sends it through mailer.send_email() and marks it 'sent' or 'failed'.
Because the queue lives in the database, nothing is lost when the backend restarts, and a notification is never queued
twice (see already_notified).

Templates are plain functions that return a Message. Add a new mail type by adding a template and calling queue().
"""
import html
import logging
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import mailer
from app.config import get_settings
from app.models import Event, Notification, Project, Registration, User, utcnow
from app.timeutil import fmt_local

log = logging.getLogger("app.notifications")

# notification.type values allowed by schema.sql
CONFIRMATION, REMINDER, UPDATE, POST_EVENT = "confirmation", "reminder", "update", "post_event"


@dataclass
class Message:
    title: str  # email subject and in-app heading (max 150 characters)
    body: str  # plain text; blank lines separate paragraphs
    link: str | None = None  # button in the email
    link_label: str = "Open Tandem"


def _front(path: str) -> str:
    return get_settings().frontend_url.rstrip("/") + path


def _when(event: Event) -> str:
    return fmt_local(event.start_datetime)


# ---------- templates (item 24) ----------

def registration_confirmation(name: str, event: Event, project_title: str, waitlisted: bool = False) -> Message:
    if waitlisted:
        return Message(
            f"You are on the waitlist: {event.title}",
            f"Hi {name},\n\n{event.title} ({project_title}) is full, so you are on the waitlist. "
            "We will email you straight away if a place opens up.\n\n"
            f"When: {_when(event)}\nWhere: {event.venue or 'to be confirmed'}",
            _front("/dashboard"), "View my activities")
    return Message(
        f"You are registered: {event.title}",
        f"Hi {name},\n\nYou are registered for {event.title} ({project_title}).\n\n"
        f"When: {_when(event)}\nWhere: {event.venue or 'to be confirmed'}\n\n"
        "On the day, scan the event's QR code to check in and again to check out so your hours are recorded.",
        _front("/dashboard"), "View my activities")


def waitlist_promoted(name: str, event: Event, project_title: str) -> Message:
    return Message(
        f"A place opened up: {event.title}",
        f"Hi {name},\n\nGood news: a place opened up and you are now registered for {event.title} ({project_title}).\n\n"
        f"When: {_when(event)}\nWhere: {event.venue or 'to be confirmed'}\n\n"
        "If you can no longer come, please cancel so the next person can take your place.",
        _front("/dashboard"), "View my activities")


def event_reminder(name: str, event: Event, project_title: str) -> Message:
    return Message(
        f"Reminder: {event.title} is coming up",
        f"Hi {name},\n\nA reminder that you are registered for {event.title} ({project_title}).\n\n"
        f"When: {_when(event)}\nWhere: {event.venue or 'to be confirmed'}\n\n"
        "Remember to scan the QR code when you arrive and when you leave.",
        _front("/dashboard"), "View my activities")


def event_update(name: str, event: Event, project_title: str, change: str, cancelled: bool = False) -> Message:
    if cancelled:
        return Message(
            f"Cancelled: {event.title}",
            f"Hi {name},\n\nWe are sorry, {event.title} ({project_title}) has been cancelled.\n\n{change}",
            _front("/dashboard"), "View my activities")
    return Message(
        f"Update: {event.title}",
        f"Hi {name},\n\nThere is a change to {event.title} ({project_title}).\n\n{change}\n\n"
        f"It now takes place on {_when(event)}. Where: {event.venue or 'to be confirmed'}.",
        _front("/dashboard"), "View my activities")


def post_event_thank_you(name: str, event: Event, project_title: str, hours: float | None) -> Message:
    hours_line = (f"Your {hours:g} hours have been added to your volunteer history." if hours is not None
                  else "We could not record a check-out for you. Ask the coordinator to correct your hours.")
    return Message(
        f"Thank you for volunteering: {event.title}",
        f"Hi {name},\n\nThank you for taking part in {event.title} ({project_title}). {hours_line}\n\n"
        "It would help the organisers a lot if you shared how it went. It takes a minute.",
        _front(f"/feedback/{event.event_id}"), "Give feedback")


# ---------- rendering ----------

def render(msg: Message) -> tuple[str, str]:
    """(html, text) for an email."""
    text = msg.body + (f"\n\n{msg.link_label}: {msg.link}" if msg.link else "")
    paragraphs = "".join(f"<p>{html.escape(p).replace(chr(10), '<br>')}</p>" for p in msg.body.split("\n\n"))
    button = (f'<p><a href="{html.escape(msg.link, quote=True)}" style="background:#2563eb;color:#fff;padding:10px 18px;'
              f'border-radius:6px;text-decoration:none">{html.escape(msg.link_label)}</a></p>') if msg.link else ""
    return paragraphs + button, text


# ---------- queue ----------

def already_notified(db: Session, user_id: int, ntype: str, related_type: str, related_id: int) -> bool:
    return db.scalar(select(Notification.notification_id).where(
        Notification.user_id == user_id, Notification.type == ntype, Notification.related_type == related_type,
        Notification.related_id == related_id).limit(1)) is not None


def queue(db: Session, user_id: int, ntype: str, msg: Message, related_type: str | None = None,
          related_id: int | None = None, email: bool = True) -> None:
    """Add the in-app notification (visible at once) and, unless email=False, the email (sent by deliver_pending).
    The caller commits."""
    now = utcnow()
    db.add(Notification(user_id=user_id, type=ntype, channel="in_app", title=msg.title[:150], content=msg.body,
                        related_type=related_type, related_id=related_id, status="sent", scheduled_at=now, sent_at=now))
    if email:
        db.add(Notification(user_id=user_id, type=ntype, channel="email", title=msg.title[:150],
                            content=msg.body + (f"\n\n{msg.link_label}: {msg.link}" if msg.link else ""),
                            related_type=related_type, related_id=related_id, status="scheduled", scheduled_at=now))


def deliver_pending(db: Session, limit: int = 50) -> int:
    """Send queued emails that are due. Returns how many were sent. A failure marks that row 'failed' and the rest go on."""
    rows = db.scalars(select(Notification).where(
        Notification.channel == "email", Notification.status == "scheduled", Notification.scheduled_at <= utcnow())
        .order_by(Notification.notification_id).limit(limit)).all()
    sent = 0
    for n in rows:
        user = db.get(User, n.user_id)
        if user is None or user.account_status != "active":
            n.status = "failed"
            db.commit()
            continue
        link_line = None
        body, link = n.content or "", None
        if "\n\n" in body and ": http" in body.rsplit("\n\n", 1)[-1]:
            body, link_line = body.rsplit("\n\n", 1)
            label, link = link_line.split(": ", 1)
            msg = Message(n.title, body, link, label)
        else:
            msg = Message(n.title, body)
        html_body, text = render(msg)
        ok = mailer.send_email(user.email, user.full_name, n.title, html_body, text)
        n.status, n.sent_at = ("sent", utcnow()) if ok else ("failed", None)
        sent += 1 if ok else 0
        db.commit()
    return sent


def deliver_pending_background() -> None:
    """For FastAPI BackgroundTasks: its own session, never raises."""
    from app.database import SessionLocal
    try:
        with SessionLocal() as db:
            deliver_pending(db)
    except Exception:  # noqa: BLE001 - a mail problem must never break a request
        log.exception("deliver_pending failed")


# ---------- events: what the endpoints call ----------

def _name_and_project(db: Session, user_id: int, event: Event) -> tuple[str, str]:
    user = db.get(User, user_id)
    project = db.get(Project, event.project_id)
    return (user.full_name if user else ""), (project.title if project else "")


def notify_registration(db: Session, reg: Registration, event: Event) -> None:
    name, project = _name_and_project(db, reg.user_id, event)
    queue(db, reg.user_id, CONFIRMATION, registration_confirmation(name, event, project, reg.status == "waitlisted"),
          "event", event.event_id)


def notify_promoted(db: Session, reg: Registration, event: Event) -> None:
    name, project = _name_and_project(db, reg.user_id, event)
    queue(db, reg.user_id, CONFIRMATION, waitlist_promoted(name, event, project), "event", event.event_id)


def notify_event_changed(db: Session, event: Event, change: str, cancelled: bool = False) -> int:
    """Last-minute update: tell everyone registered (and waitlisted) that the event changed or was cancelled.
    `change` is a short human sentence such as 'The start time moved from 9:00 AM to 10:00 AM.' Caller commits.
    Returns how many people were notified."""
    regs = db.scalars(select(Registration).where(
        Registration.event_id == event.event_id, Registration.status.in_(("registered", "waitlisted")))).all()
    for r in regs:
        name, project = _name_and_project(db, r.user_id, event)
        queue(db, r.user_id, UPDATE, event_update(name, event, project, change, cancelled), "event", event.event_id)
    return len(regs)
