"""QR attendance (backlog items 25 and 25a).

Coordinator side: GET /events/{id}/qr shows the current code (it changes every QR_TTL_MINUTES), POST rotates it now.
Volunteer side: POST /attendance/scan. The first valid scan is the check-in, the next one is the check-out. Check-out
works out the hours and creates the volunteer's contribution (verified, because a QR scan is proof).

Rules, all configurable in config.py:
  - the code must be the event's current one (a short grace after it changes)
  - only volunteers REGISTERED for the event can scan (not waitlisted, not cancelled)
  - check-in opens CHECKIN_EARLY_MINUTES before the start and closes when the event ends
  - check-out closes CHECKOUT_GRACE_MINUTES after the end; a scan sooner than MIN_STAY_SECONDS after check-in is a
    double scan and is refused
  - anything else (forgot to scan, phone died) the coordinator corrects with PUT /events/{id}/attendance/{user_id}
"""
import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import audit
from app.config import get_settings
from app.database import get_db
from app.deps import assert_ngo_staff, get_current_user, require_volunteer
from app.models import Attendance, Contribution, Event, Project, Registration, User, utcnow
from app.schemas import (
    AttendanceOut, AttendanceRowOut, EventAttendanceOut, ManualAttendanceIn, MyAttendanceOut, QrOut, ScanIn,
)
from app.timeutil import fmt_local, local_date

router = APIRouter(tags=["attendance"])


def _staff_event(db: Session, user: User, event_id: int) -> Event:
    event = db.get(Event, event_id)
    project = db.get(Project, event.project_id) if event else None
    if not event or not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    assert_ngo_staff(db, user, project.ngo_id)
    return event


def _hours(check_in, check_out) -> float:
    return round((check_out - check_in).total_seconds() / 3600, 2)


def _sync_contribution(db: Session, att: Attendance, reg: Registration, event: Event) -> None:
    """Keep the volunteer's contribution in step with the attendance row (hours, and one contribution per attendance)."""
    if att.hours_served is None:
        return
    db.flush()  # PostgreSQL's trigger copies hours from the attendance row, so it must be saved first
    c = db.scalar(select(Contribution).where(Contribution.attendance_id == att.attendance_id))
    if c is None:
        db.add(Contribution(user_id=reg.user_id, project_id=event.project_id, event_id=event.event_id,
                            attendance_id=att.attendance_id, role="Volunteer", hours=att.hours_served,
                            contribution_date=local_date(att.check_in_time), status="verified"))
    else:
        c.hours = att.hours_served


# ---------- the QR code (coordinator) ----------

def _qr_out(event: Event, now) -> QrOut:
    s = get_settings()
    return QrOut(event_id=event.event_id, token=event.qr_token,
                 scan_url=f"{s.frontend_url.rstrip('/')}/check-in?token={event.qr_token}",
                 expires_at=event.qr_expires_at, ttl_seconds=max(0, int((event.qr_expires_at - now).total_seconds())))


def _issue(db: Session, event: Event, force: bool) -> QrOut:
    now = utcnow()
    if force or not event.qr_token or event.qr_expires_at is None or event.qr_expires_at <= now:
        event.qr_token = secrets.token_urlsafe(24)
        event.qr_expires_at = now + timedelta(minutes=get_settings().qr_ttl_minutes)
        db.commit()
    return _qr_out(event, now)


@router.get("/events/{event_id}/qr", response_model=QrOut)
def get_qr(event_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """The code to show on the coordinator's screen. Poll this: it hands out a fresh code once the old one expired."""
    event = _staff_event(db, user, event_id)
    if event.status != "active":
        raise HTTPException(status.HTTP_409_CONFLICT, "Only an active event has a check-in code")
    return _issue(db, event, force=False)


@router.post("/events/{event_id}/qr", response_model=QrOut)
def rotate_qr(event_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Replace the code now (for example if a photo of the screen was shared). The old code stops working."""
    event = _staff_event(db, user, event_id)
    if event.status != "active":
        raise HTTPException(status.HTTP_409_CONFLICT, "Only an active event has a check-in code")
    return _issue(db, event, force=True)


# ---------- scanning (volunteer) ----------

def _extract_token(raw: str) -> str:
    raw = raw.strip()
    return raw.split("token=", 1)[1].split("&", 1)[0] if "token=" in raw else raw


@router.post("/attendance/scan", response_model=AttendanceOut)
def scan(body: ScanIn, db: Session = Depends(get_db), user: User = Depends(require_volunteer)):
    s = get_settings()
    now = utcnow()
    token = _extract_token(body.token)
    event = db.scalar(select(Event).where(Event.qr_token == token).with_for_update())
    if (event is None or event.qr_expires_at is None
            or now > event.qr_expires_at + timedelta(seconds=s.qr_grace_seconds)):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This QR code is not valid or has expired. Scan the code on the coordinator's screen.")
    if event.status != "active":
        raise HTTPException(status.HTTP_409_CONFLICT, "This event is not active")
    reg = db.scalar(select(Registration).where(Registration.event_id == event.event_id, Registration.user_id == user.user_id))
    if reg is None or reg.status != "registered":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You are not registered for this event")
    att = db.scalar(select(Attendance).where(Attendance.registration_id == reg.registration_id))

    if att is None or att.check_in_time is None:  # ----- check-in
        opens = event.start_datetime - timedelta(minutes=s.checkin_early_minutes)
        if now < opens:
            raise HTTPException(status.HTTP_409_CONFLICT, f"Check-in opens at {fmt_local(opens)}")
        if now > event.end_datetime:
            raise HTTPException(status.HTTP_409_CONFLICT, "This event has ended. Ask the coordinator to record your attendance")
        if att is None:
            att = Attendance(registration_id=reg.registration_id)
            db.add(att)
        att.check_in_time, att.check_out_time, att.hours_served, att.attendance_status = now, None, None, "checked_in"
        action = "checked_in"
    else:  # ----- check-out
        if att.check_out_time is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, "You have already checked out")
        if (now - att.check_in_time).total_seconds() < s.min_stay_seconds:
            raise HTTPException(status.HTTP_409_CONFLICT, "You have just checked in. Scan again when you leave")
        if now > event.end_datetime + timedelta(minutes=s.checkout_grace_minutes):
            raise HTTPException(status.HTTP_409_CONFLICT, "Check-out has closed. Ask the coordinator to record your hours")
        att.check_out_time, att.attendance_status = now, "checked_out"
        att.hours_served = _hours(att.check_in_time, now)
        action = "checked_out"
    db.flush()
    if action == "checked_out":
        _sync_contribution(db, att, reg, event)
    audit.record(db, user.user_id, f"attendance.{action}", "event", event.event_id,
                 {"hours": att.hours_served}, None)
    db.commit()
    return AttendanceOut(attendance_id=att.attendance_id, event_id=event.event_id, event_title=event.title, action=action,
                         check_in_time=att.check_in_time, check_out_time=att.check_out_time,
                         hours_served=att.hours_served, attendance_status=att.attendance_status)


@router.get("/events/{event_id}/attendance/me", response_model=MyAttendanceOut)
def my_attendance(event_id: int, db: Session = Depends(get_db), user: User = Depends(require_volunteer)):
    """Where the volunteer stands for this event, so the scan page can say 'scan to check in' or 'scan to check out'."""
    reg = db.scalar(select(Registration).where(Registration.event_id == event_id, Registration.user_id == user.user_id,
                                               Registration.status == "registered"))
    if reg is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "You are not registered for this event")
    att = db.scalar(select(Attendance).where(Attendance.registration_id == reg.registration_id))
    if att is None:
        return MyAttendanceOut(event_id=event_id, status="not_arrived")
    st = "absent" if att.attendance_status == "absent" else ("checked_out" if att.check_out_time else "checked_in")
    return MyAttendanceOut(event_id=event_id, status=st, check_in_time=att.check_in_time,
                           check_out_time=att.check_out_time, hours_served=att.hours_served)


# ---------- coordinator view and corrections ----------

def _row_status(att: Attendance | None) -> str:
    if att is None:
        return "not_arrived"
    if att.attendance_status == "absent":
        return "absent"
    return "checked_out" if att.check_out_time else ("checked_in" if att.check_in_time else "not_arrived")


@router.get("/events/{event_id}/attendance", response_model=EventAttendanceOut)
def event_attendance(event_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    event = _staff_event(db, user, event_id)
    q = (select(Registration, User, Attendance).join(User, User.user_id == Registration.user_id)
         .outerjoin(Attendance, Attendance.registration_id == Registration.registration_id)
         .where(Registration.event_id == event_id, Registration.status == "registered")
         .order_by(User.full_name, User.user_id))
    rows = [AttendanceRowOut(user_id=u.user_id, full_name=u.full_name, email=u.email, registration_id=r.registration_id,
                             attendance_id=a.attendance_id if a else None, status=_row_status(a),
                             check_in_time=a.check_in_time if a else None, check_out_time=a.check_out_time if a else None,
                             hours_served=a.hours_served if a else None) for r, u, a in db.execute(q).all()]
    count = lambda st: sum(1 for r in rows if r.status == st)  # noqa: E731
    return EventAttendanceOut(event_id=event_id, title=event.title, registered=len(rows), checked_in=count("checked_in"),
                              checked_out=count("checked_out"), not_arrived=count("not_arrived") + count("absent"),
                              total_hours=round(sum(r.hours_served or 0 for r in rows), 2), rows=rows)


@router.put("/events/{event_id}/attendance/{user_id}", response_model=AttendanceRowOut)
def correct_attendance(event_id: int, user_id: int, body: ManualAttendanceIn, db: Session = Depends(get_db),
                       user: User = Depends(get_current_user)):
    """Coordinator correction for one registered volunteer: set the check-in/out times, or mark them absent."""
    event = _staff_event(db, user, event_id)
    reg = db.scalar(select(Registration).where(Registration.event_id == event_id, Registration.user_id == user_id,
                                               Registration.status == "registered"))
    if reg is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That volunteer is not registered for this event")
    att = db.scalar(select(Attendance).where(Attendance.registration_id == reg.registration_id))
    if att is None:
        att = Attendance(registration_id=reg.registration_id)
        db.add(att)
    if body.absent:
        att.check_in_time = att.check_out_time = att.hours_served = None
        att.attendance_status = "absent"
        db.flush()
        for c in db.scalars(select(Contribution).where(Contribution.attendance_id == att.attendance_id)):
            c.status = "rejected"
    else:
        if body.check_in_time is None:
            raise HTTPException(422, "check_in_time is required (or set absent=true)")
        if body.check_out_time is not None and body.check_out_time <= body.check_in_time:
            raise HTTPException(422, "check_out_time must be after check_in_time")
        att.check_in_time, att.check_out_time = body.check_in_time, body.check_out_time
        att.hours_served = _hours(body.check_in_time, body.check_out_time) if body.check_out_time else None
        att.attendance_status = "checked_out" if body.check_out_time else "checked_in"
        db.flush()
        _sync_contribution(db, att, reg, event)
    audit.record(db, user.user_id, "attendance.corrected", "event", event_id,
                 {"volunteer": user_id, "absent": body.absent, "hours": att.hours_served}, None)
    db.commit()
    u = db.get(User, user_id)
    return AttendanceRowOut(user_id=user_id, full_name=u.full_name, email=u.email, registration_id=reg.registration_id,
                            attendance_id=att.attendance_id, status=_row_status(att), check_in_time=att.check_in_time,
                            check_out_time=att.check_out_time, hours_served=att.hours_served)
