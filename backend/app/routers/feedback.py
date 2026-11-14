"""Post-event feedback (backlog item 27a). One review per volunteer per event, only from volunteers who checked in.
The link in the thank-you email is FRONTEND_URL/feedback/{event_id}."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import assert_ngo_staff, get_current_user, require_volunteer
from app.models import Attendance, Event, Feedback, Project, Registration, User, utcnow
from app.schemas import EventFeedbackOut, FeedbackIn, FeedbackOut, FeedbackRowOut, PendingFeedbackOut

router = APIRouter(tags=["feedback"])


def _attended_registration(db: Session, event_id: int, user_id: int) -> Registration | None:
    return db.scalar(select(Registration).join(Attendance, Attendance.registration_id == Registration.registration_id).where(
        Registration.event_id == event_id, Registration.user_id == user_id, Registration.status == "registered",
        Attendance.check_in_time.is_not(None)))


@router.post("/events/{event_id}/feedback", response_model=FeedbackOut, status_code=201)
def submit_feedback(event_id: int, body: FeedbackIn, db: Session = Depends(get_db), user: User = Depends(require_volunteer)):
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    reg = _attended_registration(db, event_id, user.user_id)
    if reg is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only volunteers who checked in to this event can leave feedback")
    if db.scalar(select(Feedback.feedback_id).where(Feedback.registration_id == reg.registration_id)):
        raise HTTPException(status.HTTP_409_CONFLICT, "You have already left feedback for this event")
    fb = Feedback(registration_id=reg.registration_id, rating=body.rating, comments=(body.comments or "").strip() or None)
    db.add(fb)
    db.commit()
    return FeedbackOut(feedback_id=fb.feedback_id, rating=fb.rating, comments=fb.comments, submitted_at=fb.submitted_at, event_id=event_id)


@router.get("/events/{event_id}/feedback/me", response_model=FeedbackOut)
def my_feedback(event_id: int, db: Session = Depends(get_db), user: User = Depends(require_volunteer)):
    fb = db.scalar(select(Feedback).join(Registration, Registration.registration_id == Feedback.registration_id).where(
        Registration.event_id == event_id, Registration.user_id == user.user_id))
    if fb is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No feedback yet")
    return FeedbackOut(feedback_id=fb.feedback_id, rating=fb.rating, comments=fb.comments, submitted_at=fb.submitted_at, event_id=event_id)


@router.get("/me/feedback/pending", response_model=list[PendingFeedbackOut])
def pending_feedback(db: Session = Depends(get_db), user: User = Depends(require_volunteer)):
    """Events the volunteer checked in to and that have ended, without feedback yet (for a 'rate your events' prompt)."""
    rows = db.execute(select(Event, Project.title).join(Project, Project.project_id == Event.project_id)
                      .join(Registration, Registration.event_id == Event.event_id)
                      .join(Attendance, Attendance.registration_id == Registration.registration_id)
                      .outerjoin(Feedback, Feedback.registration_id == Registration.registration_id)
                      .where(Registration.user_id == user.user_id, Registration.status == "registered",
                             Attendance.check_in_time.is_not(None), Feedback.feedback_id.is_(None),
                             Event.end_datetime <= utcnow()).order_by(Event.end_datetime.desc())).all()
    return [PendingFeedbackOut(event_id=e.event_id, event_title=e.title, project_title=t, end_datetime=e.end_datetime) for e, t in rows]


@router.get("/events/{event_id}/feedback", response_model=EventFeedbackOut)
def event_feedback(event_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Coordinator / NGO admin view: every review for the event with the average rating."""
    event = db.get(Event, event_id)
    project = db.get(Project, event.project_id) if event else None
    if not event or not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    assert_ngo_staff(db, user, project.ngo_id)
    rows = db.execute(select(Feedback, User.full_name).join(Registration, Registration.registration_id == Feedback.registration_id)
                      .join(User, User.user_id == Registration.user_id).where(Registration.event_id == event_id)
                      .order_by(Feedback.submitted_at.desc(), Feedback.feedback_id.desc())).all()
    counts = {i: 0 for i in range(1, 6)}
    for f, _ in rows:
        counts[f.rating] += 1
    avg = round(sum(f.rating for f, _ in rows) / len(rows), 2) if rows else None
    return EventFeedbackOut(event_id=event_id, title=event.title, count=len(rows), average_rating=avg, rating_counts=counts,
                            rows=[FeedbackRowOut(feedback_id=f.feedback_id, volunteer_name=n, rating=f.rating,
                                                 comments=f.comments, submitted_at=f.submitted_at) for f, n in rows])
