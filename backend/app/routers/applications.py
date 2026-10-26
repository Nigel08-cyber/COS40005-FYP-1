"""
Backlog 22a: applications and registrations.

Rules
- Only a volunteer applies; one application per (project, volunteer).
- An application can be withdrawn by the volunteer while pending/approved.
- NGO Admin / Project Coordinator / System Admin approve or reject (decided_by is recorded).
- A registration requires an approved application. If the project is full the volunteer is waitlisted.
- Cancelling a registration frees a spot and promotes the oldest waitlisted volunteer.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models import (
    ApplicationStatus, Project, ProjectApplication, Registration, RegistrationStatus, Role, User,
)
from app.schemas import ApplicationOut, DecisionIn, MyStatusOut, RegistrationOut

router = APIRouter(tags=["applications"])
STAFF = (Role.ngo_admin, Role.project_coordinator)


def _project(db: Session, project_id: int) -> Project:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    return project


def _application(db: Session, project_id: int, volunteer_id: int) -> ProjectApplication | None:
    return db.scalar(select(ProjectApplication).where(
        ProjectApplication.project_id == project_id, ProjectApplication.volunteer_id == volunteer_id))


def _registration(db: Session, project_id: int, volunteer_id: int) -> Registration | None:
    return db.scalar(select(Registration).where(
        Registration.project_id == project_id, Registration.volunteer_id == volunteer_id))


def _registered_count(db: Session, project_id: int) -> int:
    return db.scalar(select(func.count()).select_from(Registration).where(
        Registration.project_id == project_id, Registration.status == RegistrationStatus.registered)) or 0


# ---------- applications ----------

@router.post("/projects/{project_id}/applications", response_model=ApplicationOut, status_code=201)
def apply(project_id: int, db: Session = Depends(get_db), user: User = Depends(require_roles(Role.volunteer))):
    _project(db, project_id)
    existing = _application(db, project_id, user.id)
    if existing:
        if existing.status != ApplicationStatus.withdrawn:
            raise HTTPException(status.HTTP_409_CONFLICT, "You have already applied to this project")
        existing.status, existing.decided_by, existing.decided_at = ApplicationStatus.pending, None, None
        db.commit()
        return existing
    app = ProjectApplication(project_id=project_id, volunteer_id=user.id)
    db.add(app)
    db.commit()
    return app


@router.delete("/projects/{project_id}/applications/me", response_model=ApplicationOut)
def withdraw(project_id: int, db: Session = Depends(get_db), user: User = Depends(require_roles(Role.volunteer))):
    app = _application(db, project_id, user.id)
    if not app or app.status not in (ApplicationStatus.pending, ApplicationStatus.approved):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No active application to withdraw")
    app.status = ApplicationStatus.withdrawn
    reg = _registration(db, project_id, user.id)
    if reg and reg.status != RegistrationStatus.cancelled:
        was_registered = reg.status == RegistrationStatus.registered
        reg.status = RegistrationStatus.cancelled
        if was_registered:
            _promote_waitlist(db, project_id)
    db.commit()
    return app


@router.get("/projects/{project_id}/applications", response_model=list[ApplicationOut])
def list_applications(project_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles(*STAFF))):
    _project(db, project_id)
    return db.scalars(select(ProjectApplication).where(ProjectApplication.project_id == project_id)
                      .order_by(ProjectApplication.created_at)).all()


@router.patch("/applications/{application_id}", response_model=ApplicationOut)
def decide(application_id: int, body: DecisionIn, db: Session = Depends(get_db), user: User = Depends(require_roles(*STAFF))):
    if body.decision not in (ApplicationStatus.approved, ApplicationStatus.rejected):
        raise HTTPException(422, "decision must be approved or rejected")
    app = db.get(ProjectApplication, application_id)
    if not app:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")
    if app.status != ApplicationStatus.pending:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Application is already {app.status.value}")
    app.status, app.decided_by, app.decided_at = body.decision, user.id, datetime.now(timezone.utc)
    db.commit()
    return app


# ---------- registrations ----------

@router.post("/projects/{project_id}/registrations", response_model=RegistrationOut, status_code=201)
def register(project_id: int, db: Session = Depends(get_db), user: User = Depends(require_roles(Role.volunteer))):
    project = _project(db, project_id)
    app = _application(db, project_id, user.id)
    if not app or app.status != ApplicationStatus.approved:
        raise HTTPException(status.HTTP_409_CONFLICT, "You need an approved application before registering")
    full = _registered_count(db, project_id) >= project.volunteers_needed
    new_status = RegistrationStatus.waitlisted if full else RegistrationStatus.registered
    reg = _registration(db, project_id, user.id)
    if reg:
        if reg.status != RegistrationStatus.cancelled:
            raise HTTPException(status.HTTP_409_CONFLICT, f"You are already {reg.status.value}")
        reg.status = new_status
    else:
        reg = Registration(project_id=project_id, volunteer_id=user.id, status=new_status)
        db.add(reg)
    db.commit()
    return reg


def _promote_waitlist(db: Session, project_id: int) -> None:
    db.flush()
    project = db.get(Project, project_id)
    if _registered_count(db, project_id) >= project.volunteers_needed:
        return
    nxt = db.scalar(select(Registration).where(
        Registration.project_id == project_id, Registration.status == RegistrationStatus.waitlisted)
        .order_by(Registration.created_at, Registration.id).limit(1))
    if nxt:
        nxt.status = RegistrationStatus.registered


@router.delete("/projects/{project_id}/registrations/me", response_model=RegistrationOut)
def cancel(project_id: int, db: Session = Depends(get_db), user: User = Depends(require_roles(Role.volunteer))):
    reg = _registration(db, project_id, user.id)
    if not reg or reg.status == RegistrationStatus.cancelled:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No active registration to cancel")
    was_registered = reg.status == RegistrationStatus.registered
    reg.status = RegistrationStatus.cancelled
    if was_registered:
        _promote_waitlist(db, project_id)
    db.commit()
    return reg


# ---------- what the volunteer UI needs ----------

@router.get("/me/applications", response_model=list[MyStatusOut])
def my_applications(db: Session = Depends(get_db), user: User = Depends(require_roles(Role.volunteer))):
    """Status per project in the frontend's vocabulary: pending | approved | registered | waitlisted."""
    out: list[MyStatusOut] = []
    for app in db.scalars(select(ProjectApplication).where(ProjectApplication.volunteer_id == user.id)):
        if app.status in (ApplicationStatus.rejected, ApplicationStatus.withdrawn):
            continue
        st = app.status.value
        reg = _registration(db, app.project_id, user.id)
        if reg and reg.status != RegistrationStatus.cancelled:
            st = reg.status.value
        out.append(MyStatusOut(project_id=app.project_id, status=st))
    return out
