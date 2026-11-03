"""Shared helpers: event capacity, waitlist promotion."""
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Event, ProjectApplication, Registration, utcnow
from app.schemas import EventOut


def count_status(db: Session, event_id: int, status: str) -> int:
    return db.scalar(select(func.count()).select_from(Registration).where(
        Registration.event_id == event_id, Registration.status == status)) or 0


def event_out(db: Session, event: Event) -> EventOut:
    out = EventOut.model_validate(event)
    out.registered_count = count_status(db, event.event_id, "registered")
    out.waitlist_count = count_status(db, event.event_id, "waitlisted")
    return out


def promote_waitlist(db: Session, event: Event) -> list[Registration]:
    """Move waitlisted volunteers (oldest first) into free spots. A waitlisted volunteer whose application
    is no longer approved is dropped instead of promoted. Caller commits."""
    promoted: list[Registration] = []
    while event.capacity is None or count_status(db, event.event_id, "registered") < event.capacity:
        nxt = db.scalar(select(Registration).where(
            Registration.event_id == event.event_id, Registration.status == "waitlisted"
        ).order_by(Registration.registered_at, Registration.registration_id).limit(1))
        if nxt is None:
            break
        app = db.scalar(select(ProjectApplication).where(
            ProjectApplication.project_id == event.project_id, ProjectApplication.user_id == nxt.user_id))
        if app is None or app.status != "approved":
            nxt.status, nxt.cancelled_at = "cancelled", utcnow()
        else:
            nxt.status = "registered"
            promoted.append(nxt)
        db.flush()
    return promoted
