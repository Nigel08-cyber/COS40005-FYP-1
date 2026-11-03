"""Volunteer browse view: GET /opportunities and /opportunities/{project_id}.
One opportunity = an active project of an active NGO, with its next upcoming event, registration counts,
required skill names and the distance from the volunteer."""
from collections import defaultdict
from datetime import datetime, time
from math import asin, cos, radians, sin, sqrt

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Event, Ngo, Project, ProjectRequiredSkill, Registration, Skill, User, VolunteerProfile, utcnow
from app.schemas import OpportunityOut

router = APIRouter(prefix="/opportunities", tags=["opportunities"])


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    dlat, dlon = radians(lat2 - lat1), radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return 2 * 6371.0 * asin(sqrt(a))


def _build(db: Session, user: User, rows: list[tuple[Project, Ngo]]) -> list[OpportunityOut]:
    if not rows:
        return []
    now = utcnow()
    pids = [p.project_id for p, _ in rows]
    next_event: dict[int, Event] = {}
    for e in db.scalars(select(Event).where(Event.project_id.in_(pids), Event.status == "active", Event.end_datetime >= now)
                        .order_by(Event.start_datetime, Event.event_id)):
        next_event.setdefault(e.project_id, e)
    counts: dict[tuple[int, str], int] = defaultdict(int)
    eids = [e.event_id for e in next_event.values()]
    if eids:
        for eid, st, n in db.execute(select(Registration.event_id, Registration.status, func.count()).where(
                Registration.event_id.in_(eids), Registration.status.in_(("registered", "waitlisted")))
                .group_by(Registration.event_id, Registration.status)):
            counts[(eid, st)] = n
    skills: dict[int, list[str]] = defaultdict(list)
    for pid, name in db.execute(select(ProjectRequiredSkill.project_id, Skill.skill_name).join(
            Skill, Skill.skill_id == ProjectRequiredSkill.skill_id).where(ProjectRequiredSkill.project_id.in_(pids))
            .order_by(Skill.skill_name)):
        skills[pid].append(name)
    me = db.get(VolunteerProfile, user.user_id)
    out = []
    for p, ngo in rows:
        e = next_event.get(p.project_id)
        if e:
            start, end = e.start_datetime, e.end_datetime
        else:
            day = p.start_date or p.created_at.date()
            start = datetime.combine(day, time(0, 0))
            end = datetime.combine(p.end_date or day, time(23, 59))
        dist = None
        if me and me.latitude is not None and me.longitude is not None and p.latitude is not None and p.longitude is not None:
            dist = round(haversine_km(me.latitude, me.longitude, p.latitude, p.longitude), 1)
        out.append(OpportunityOut(
            project_id=p.project_id, event_id=e.event_id if e else None, title=p.title, description=p.description,
            category=p.category, ngo_id=ngo.ngo_id, ngo_name=ngo.name, ngo_state=ngo.state, location=p.location,
            venue=e.venue if e else None, latitude=p.latitude, longitude=p.longitude, start=start, end=end,
            volunteers_needed=(e.capacity if e and e.capacity else p.volunteers_needed) or 0,
            registered_count=counts[(e.event_id, "registered")] if e else 0,
            waitlist_count=counts[(e.event_id, "waitlisted")] if e else 0,
            skills=skills.get(p.project_id, []), min_experience_years=p.min_experience_years,
            preferred_day=p.preferred_day, preferred_start_time=p.preferred_start_time,
            preferred_end_time=p.preferred_end_time, distance_km=dist))
    return out


def _open_projects():
    return (select(Project, Ngo).join(Ngo, Ngo.ngo_id == Project.ngo_id)
            .where(Project.status == "active", Ngo.status == "active"))


@router.get("", response_model=list[OpportunityOut])
def list_opportunities(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = [(p, n) for p, n in db.execute(_open_projects().order_by(Project.start_date, Project.project_id))]
    out = _build(db, user, rows)
    return sorted(out, key=lambda o: (o.start, o.project_id))


@router.get("/{project_id}", response_model=OpportunityOut)
def get_opportunity(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = [(p, n) for p, n in db.execute(_open_projects().where(Project.project_id == project_id))]
    if not rows:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Opportunity not found")
    return _build(db, user, rows)[0]
