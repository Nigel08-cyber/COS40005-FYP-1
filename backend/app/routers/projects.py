from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import assert_ngo_staff, get_current_user, ngo_role
from app.models import Event, Ngo, NgoMember, Project, ProjectRequiredSkill, Skill, User
from app.schemas import (
    CoordinatorIn, EventIn, EventOut, EventUpdate, ProjectIn, ProjectOut, ProjectStatusIn, ProjectUpdate,
    RequiredSkillIn, RequiredSkillOut,
)
from app.services import event_out, promote_waitlist

router = APIRouter(tags=["projects"])


def _visible(db: Session, user: User, project: Project) -> bool:
    return project.status == "active" or user.system_role == "platform_admin" or ngo_role(db, user, project.ngo_id) is not None


def _get_visible(db: Session, user: User, project_id: int) -> Project:
    project = db.get(Project, project_id)
    if not project or not _visible(db, user, project):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    return project


@router.post("/projects", response_model=ProjectOut, status_code=201)
def create_project(body: ProjectIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ngo = db.get(Ngo, body.ngo_id)
    if not ngo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "NGO not found")
    assert_ngo_staff(db, user, body.ngo_id)
    if ngo.status != "active":
        raise HTTPException(status.HTTP_409_CONFLICT, "This organisation has not been approved yet")
    if body.end_date and body.start_date and body.end_date < body.start_date:
        raise HTTPException(422, "end_date is before start_date")
    if body.coordinator_id is not None:
        coordinator = db.get(User, body.coordinator_id)
        if coordinator is None or ngo_role(db, coordinator, body.ngo_id) is None:
            raise HTTPException(422, "coordinator_id must be an active member of the NGO")
    project = Project(**body.model_dump())
    db.add(project)
    db.commit()
    return project


@router.get("/projects", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Active projects for everyone, plus every project of the NGOs the user belongs to."""
    q = select(Project).order_by(Project.start_date, Project.project_id)
    if user.system_role != "platform_admin":
        mine = select(NgoMember.ngo_id).where(NgoMember.user_id == user.user_id, NgoMember.status == "active")
        q = q.where(or_(Project.status == "active", Project.ngo_id.in_(mine)))
    return db.scalars(q).all()


@router.get("/projects/{project_id}", response_model=ProjectOut)
def get_project(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _get_visible(db, user, project_id)


@router.patch("/projects/{project_id}/status", response_model=ProjectOut)
def set_project_status(project_id: int, body: ProjectStatusIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = _get_visible(db, user, project_id)
    assert_ngo_staff(db, user, project.ngo_id)
    project.status = body.status
    db.commit()
    return project


@router.post("/projects/{project_id}/events", response_model=EventOut, status_code=201)
def create_event(project_id: int, body: EventIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = _get_visible(db, user, project_id)
    assert_ngo_staff(db, user, project.ngo_id)
    if body.end_datetime <= body.start_datetime:
        raise HTTPException(422, "end_datetime must be after start_datetime")
    event = Event(project_id=project_id, **body.model_dump())
    db.add(event)
    db.commit()
    return event_out(db, event)


@router.get("/projects/{project_id}/events", response_model=list[EventOut])
def list_events(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _get_visible(db, user, project_id)
    return [event_out(db, e) for e in db.scalars(select(Event).where(Event.project_id == project_id).order_by(Event.start_datetime))]


@router.patch("/projects/{project_id}", response_model=ProjectOut)
def update_project(project_id: int, body: ProjectUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = _get_visible(db, user, project_id)
    assert_ngo_staff(db, user, project.ngo_id)
    data = body.model_dump(exclude_unset=True)
    if data.get("title", "x") is None:
        data.pop("title")
    start, end = data.get("start_date", project.start_date), data.get("end_date", project.end_date)
    if start and end and end < start:
        raise HTTPException(422, "end_date is before start_date")
    for k, v in data.items():
        setattr(project, k, v)
    db.commit()
    return project


@router.put("/projects/{project_id}/coordinator", response_model=ProjectOut)
def set_coordinator(project_id: int, body: CoordinatorIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Link (or unlink with null) the project coordinator. NGO admin only; the coordinator must be an active
    member of the same NGO."""
    project = _get_visible(db, user, project_id)
    assert_ngo_staff(db, user, project.ngo_id, admin_only=True)
    if body.coordinator_id is not None:
        member = db.get(NgoMember, (project.ngo_id, body.coordinator_id))
        if member is None or member.status != "active":
            raise HTTPException(422, "coordinator_id must be an active member of the NGO")
    project.coordinator_id = body.coordinator_id
    db.commit()
    return project


@router.get("/me/coordinated-projects", response_model=list[ProjectOut])
def coordinated_projects(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Projects the signed-in user coordinates (for the coordinator's dashboard)."""
    return db.scalars(select(Project).where(Project.coordinator_id == user.user_id).order_by(Project.start_date, Project.project_id)).all()


@router.get("/projects/{project_id}/skills", response_model=list[RequiredSkillOut])
def get_required_skills(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _get_visible(db, user, project_id)
    rows = db.execute(select(ProjectRequiredSkill, Skill.skill_name).join(Skill, Skill.skill_id == ProjectRequiredSkill.skill_id)
                      .where(ProjectRequiredSkill.project_id == project_id).order_by(Skill.skill_name)).all()
    return [RequiredSkillOut(skill_id=r.skill_id, skill_name=n, min_proficiency=r.min_proficiency,
                             volunteers_needed=r.volunteers_needed, is_mandatory=r.is_mandatory) for r, n in rows]


@router.put("/projects/{project_id}/skills", response_model=list[RequiredSkillOut])
def set_required_skills(project_id: int, body: list[RequiredSkillIn], db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Replace the project's required skills (staff of the project's NGO)."""
    project = _get_visible(db, user, project_id)
    assert_ngo_staff(db, user, project.ngo_id)
    ids = [r.skill_id for r in body]
    if len(set(ids)) != len(ids):
        raise HTTPException(422, "Duplicate skill_id")
    known = set(db.scalars(select(Skill.skill_id).where(Skill.skill_id.in_(ids)))) if ids else set()
    if known != set(ids):
        raise HTTPException(422, f"Unknown skill_id: {sorted(set(ids) - known)}")
    if project.volunteers_needed is not None and any(r.volunteers_needed and r.volunteers_needed > project.volunteers_needed for r in body):
        raise HTTPException(422, "A skill requirement exceeds the project's volunteers_needed")
    db.execute(delete(ProjectRequiredSkill).where(ProjectRequiredSkill.project_id == project_id))
    db.flush()
    db.add_all(ProjectRequiredSkill(project_id=project_id, **r.model_dump()) for r in body)
    db.commit()
    return get_required_skills(project_id, db, user)


def _get_event(db: Session, user: User, event_id: int) -> tuple[Event, Project]:
    event = db.get(Event, event_id)
    project = db.get(Project, event.project_id) if event else None
    if not event or not project or not _visible(db, user, project):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    return event, project


@router.get("/events/{event_id}", response_model=EventOut)
def get_event(event_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    event, _ = _get_event(db, user, event_id)
    return event_out(db, event)


@router.patch("/events/{event_id}", response_model=EventOut)
def update_event(event_id: int, body: EventUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Edit an event or change its status. More capacity (or reopening) promotes people from the waitlist."""
    event, project = _get_event(db, user, event_id)
    assert_ngo_staff(db, user, project.ngo_id)
    data = body.model_dump(exclude_unset=True)
    for required in ("title", "start_datetime", "end_datetime", "status"):
        if required in data and data[required] is None:
            data.pop(required)
    start, end = data.get("start_datetime", event.start_datetime), data.get("end_datetime", event.end_datetime)
    if end <= start:
        raise HTTPException(422, "end_datetime must be after start_datetime")
    for k, v in data.items():
        setattr(event, k, v)
    db.flush()
    if event.status == "active":
        promote_waitlist(db, event)
    db.commit()
    return event_out(db, event)
