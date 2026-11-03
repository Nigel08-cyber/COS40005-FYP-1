"""
Applications (project level) and registrations (event level), following schema.sql.

- A volunteer applies once per project (UNIQUE project_id, user_id). Withdrawn can re-apply.
- NGO staff of the project's own NGO approve or reject; decided_by/decided_at are recorded.
- A registration is per EVENT and needs an approved application for the event's project
  (the database trigger registration_requires_approval enforces the same rule).
- A full event puts the volunteer on a waitlist (registration.status = 'waitlisted', migrations/002).
  When a spot frees up (cancel, withdraw, capacity raised) the oldest waitlisted volunteer is promoted.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import assert_ngo_staff, get_current_user, require_volunteer
from app.models import Event, Project, ProjectApplication, Registration, User, utcnow
from app.schemas import ApplicationOut, DecisionIn, MyStatusOut, RegistrationOut
from app.services import count_status, promote_waitlist

router = APIRouter(tags=["applications"])


def _project(db: Session, project_id: int) -> Project:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    return project


def _application(db: Session, project_id: int, user_id: int) -> ProjectApplication | None:
    return db.scalar(select(ProjectApplication).where(
        ProjectApplication.project_id == project_id, ProjectApplication.user_id == user_id))


def _registration(db: Session, event_id: int, user_id: int) -> Registration | None:
    return db.scalar(select(Registration).where(Registration.event_id == event_id, Registration.user_id == user_id))


# ---------- applications ----------

@router.post("/projects/{project_id}/applications", response_model=ApplicationOut, status_code=201)
def apply(project_id: int, db: Session = Depends(get_db), user: User = Depends(require_volunteer)):
    project = _project(db, project_id)
    if project.status != "active":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    existing = _application(db, project_id, user.user_id)
    if existing:
        if existing.status != "withdrawn":
            raise HTTPException(status.HTTP_409_CONFLICT, "You have already applied to this project")
        existing.status, existing.decided_by, existing.decided_at, existing.applied_at = "pending", None, None, utcnow()
        db.commit()
        return existing
    app = ProjectApplication(project_id=project_id, user_id=user.user_id, source="applied")
    db.add(app)
    db.commit()
    return app


@router.delete("/projects/{project_id}/applications/me", response_model=ApplicationOut)
def withdraw(project_id: int, db: Session = Depends(get_db), user: User = Depends(require_volunteer)):
    app = _application(db, project_id, user.user_id)
    if not app or app.status not in ("pending", "approved"):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No active application to withdraw")
    app.status = "withdrawn"
    now = utcnow()
    freed: list[int] = []
    for reg in db.scalars(select(Registration).join(Event, Event.event_id == Registration.event_id).where(
            Event.project_id == project_id, Registration.user_id == user.user_id,
            Registration.status.in_(("registered", "waitlisted")))):
        if reg.status == "registered":
            freed.append(reg.event_id)
        reg.status, reg.cancelled_at = "cancelled", now
    db.flush()
    for event_id in freed:
        promote_waitlist(db, db.get(Event, event_id))
    db.commit()
    return app


@router.get("/projects/{project_id}/applications", response_model=list[ApplicationOut])
def list_applications(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = _project(db, project_id)
    assert_ngo_staff(db, user, project.ngo_id)
    return db.scalars(select(ProjectApplication).where(ProjectApplication.project_id == project_id)
                      .order_by(ProjectApplication.applied_at, ProjectApplication.application_id)).all()


@router.patch("/applications/{application_id}", response_model=ApplicationOut)
def decide(application_id: int, body: DecisionIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    app = db.get(ProjectApplication, application_id)
    if not app:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")
    assert_ngo_staff(db, user, _project(db, app.project_id).ngo_id)
    if app.status != "pending":
        raise HTTPException(status.HTTP_409_CONFLICT, f"Application is already {app.status}")
    app.status, app.decided_by, app.decided_at = body.decision, user.user_id, utcnow()
    if body.coordinator_note is not None:
        app.coordinator_note = body.coordinator_note
    db.commit()
    return app


# ---------- registrations (per event) ----------

@router.post("/events/{event_id}/registrations", response_model=RegistrationOut, status_code=201)
def register(event_id: int, db: Session = Depends(get_db), user: User = Depends(require_volunteer)):
    # lock the event row so two volunteers cannot take the last spot at once (no-op on SQLite)
    event = db.scalar(select(Event).where(Event.event_id == event_id).with_for_update())
    if not event or event.status != "active":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    app = _application(db, event.project_id, user.user_id)
    if not app or app.status != "approved":
        raise HTTPException(status.HTTP_409_CONFLICT, "You need an approved application before registering")
    reg = _registration(db, event_id, user.user_id)
    if reg and reg.status == "registered":
        raise HTTPException(status.HTTP_409_CONFLICT, "You are already registered")
    if reg and reg.status == "waitlisted":
        raise HTTPException(status.HTTP_409_CONFLICT, "You are already on the waitlist")
    full = event.capacity is not None and count_status(db, event_id, "registered") >= event.capacity
    new_status = "waitlisted" if full else "registered"
    if reg:  # cancelled earlier: reuse the row (UNIQUE event_id, user_id)
        reg.status, reg.cancelled_at, reg.registered_at = new_status, None, utcnow()
    else:
        reg = Registration(event_id=event_id, user_id=user.user_id, status=new_status)
        db.add(reg)
    db.commit()
    return reg


@router.delete("/events/{event_id}/registrations/me", response_model=RegistrationOut)
def cancel(event_id: int, db: Session = Depends(get_db), user: User = Depends(require_volunteer)):
    """Cancels a registration or leaves the waitlist. Freeing a spot promotes the next waitlisted volunteer."""
    event = db.scalar(select(Event).where(Event.event_id == event_id).with_for_update())
    reg = _registration(db, event_id, user.user_id)
    if not event or not reg or reg.status not in ("registered", "waitlisted"):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No active registration to cancel")
    was_registered = reg.status == "registered"
    reg.status, reg.cancelled_at = "cancelled", utcnow()
    db.flush()
    if was_registered:
        promote_waitlist(db, event)
    db.commit()
    return reg


@router.get("/me/registrations", response_model=list[RegistrationOut])
def my_registrations(db: Session = Depends(get_db), user: User = Depends(require_volunteer)):
    """Registered and waitlisted events (check the status field)."""
    return db.scalars(select(Registration).where(
        Registration.user_id == user.user_id, Registration.status.in_(("registered", "waitlisted")))
        .order_by(Registration.registration_id)).all()


@router.get("/me/applications", response_model=list[MyStatusOut])
def my_applications(db: Session = Depends(get_db), user: User = Depends(require_volunteer)):
    """Status per project: pending | approved, registered if registered for any of its events, else waitlisted
    if only waitlisted."""
    registered, waitlisted = set(), set()
    for project_id, st in db.execute(select(Event.project_id, Registration.status).join(
            Registration, Registration.event_id == Event.event_id).where(
            Registration.user_id == user.user_id, Registration.status.in_(("registered", "waitlisted")))):
        (registered if st == "registered" else waitlisted).add(project_id)
    out = []
    for app in db.scalars(select(ProjectApplication).where(ProjectApplication.user_id == user.user_id)
                          .order_by(ProjectApplication.application_id)):
        if app.status in ("rejected", "withdrawn"):
            continue
        if app.project_id in registered:
            st = "registered"
        elif app.project_id in waitlisted:
            st = "waitlisted"
        else:
            st = app.status
        out.append(MyStatusOut(project_id=app.project_id, status=st))
    return out
