"""Volunteer profile and history (backlog item 20): /me/profile, /skills, /me/contributions, /me/stats,
/me/hours, /me/certificates, /me/activities. All /me routes need a volunteer_profile."""
from collections import defaultdict
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_roles, require_volunteer
from app.models import (
    Availability, Certificate, Contribution, Event, Project, ProjectRequiredSkill, Registration, Skill, User,
    VolunteerInterest, VolunteerLanguage, VolunteerProfile, VolunteerQualification, VolunteerSkill, utcnow,
)
from app.schemas import (
    ActivityOut, AvailabilityIO, CertificateOut, ContributionOut, LanguageIO, MonthlyHoursOut, ProfileIn,
    ProfileOut, QualificationOut, SkillIn, SkillOut, VolunteerSkillOut, VolunteerStatsOut,
)

router = APIRouter(tags=["volunteers"])

_SCALARS = ("date_of_birth", "bio", "preferred_activity", "experience_summary", "years_experience",
            "city", "state", "latitude", "longitude", "max_travel_km")


# ---------- skills lookup ----------

@router.get("/skills", response_model=list[SkillOut])
def list_skills(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.scalars(select(Skill).order_by(Skill.skill_name)).all()


@router.post("/skills", response_model=SkillOut, status_code=201)
def create_skill(body: SkillIn, db: Session = Depends(get_db), _: User = Depends(require_roles())):
    """System Admin only: add a skill to the pick-list."""
    if db.scalar(select(Skill).where(func.lower(Skill.skill_name) == body.skill_name.lower())):
        raise HTTPException(status.HTTP_409_CONFLICT, "This skill already exists")
    skill = Skill(**body.model_dump())
    db.add(skill)
    db.commit()
    return skill


# ---------- profile ----------

def _profile_out(db: Session, user: User) -> ProfileOut:
    p = db.get(VolunteerProfile, user.user_id)
    skills = db.execute(select(VolunteerSkill, Skill.skill_name).join(Skill, Skill.skill_id == VolunteerSkill.skill_id)
                        .where(VolunteerSkill.user_id == user.user_id).order_by(Skill.skill_name)).all()
    return ProfileOut(
        user_id=user.user_id, full_name=user.full_name, email=user.email, phone=user.phone,
        **{f: getattr(p, f) for f in _SCALARS},
        skills=[VolunteerSkillOut(skill_id=v.skill_id, skill_name=n, proficiency_level=v.proficiency_level,
                                  years_experience=v.years_experience) for v, n in skills],
        interests=sorted(db.scalars(select(VolunteerInterest.interest_category).where(VolunteerInterest.user_id == user.user_id))),
        languages=[LanguageIO(language=r.language, proficiency=r.proficiency) for r in db.scalars(
            select(VolunteerLanguage).where(VolunteerLanguage.user_id == user.user_id).order_by(VolunteerLanguage.language))],
        qualifications=[QualificationOut(qualification_id=q.qualification_id, title=q.title, issuer=q.issuer,
                                         year_obtained=q.year_obtained, expiry_date=q.expiry_date)
                        for q in db.scalars(select(VolunteerQualification).where(VolunteerQualification.user_id == user.user_id)
                                            .order_by(VolunteerQualification.qualification_id))],
        availability=[AvailabilityIO(day_of_week=a.day_of_week, start_time=a.start_time, end_time=a.end_time)
                      for a in db.scalars(select(Availability).where(Availability.user_id == user.user_id)
                                          .order_by(Availability.day_of_week, Availability.start_time))],
    )


@router.get("/me/profile", response_model=ProfileOut)
def get_profile(db: Session = Depends(get_db), user: User = Depends(require_volunteer)):
    return _profile_out(db, user)


def _replace(db: Session, model, user_id: int, rows: list) -> None:
    db.execute(delete(model).where(model.user_id == user_id))
    db.flush()
    db.add_all(rows)


@router.api_route("/me/profile", methods=["PUT", "PATCH"], response_model=ProfileOut)
def update_profile(body: ProfileIn, db: Session = Depends(get_db), user: User = Depends(require_volunteer)):
    """Fields left out are unchanged; a list that is sent (even empty) replaces the stored list."""
    data = body.model_dump(exclude_unset=True)
    if "full_name" in data and data["full_name"] is not None:
        user.full_name = data["full_name"].strip()
    if "phone" in data:
        user.phone = data["phone"]
    profile = db.get(VolunteerProfile, user.user_id)
    for f in _SCALARS:
        if f in data:
            setattr(profile, f, data[f])
    profile.updated_at = utcnow()

    if body.skills is not None:
        ids = [s.skill_id for s in body.skills]
        if len(set(ids)) != len(ids):
            raise HTTPException(422, "Duplicate skill in skills")
        known = set(db.scalars(select(Skill.skill_id).where(Skill.skill_id.in_(ids)))) if ids else set()
        if known != set(ids):
            raise HTTPException(422, f"Unknown skill_id: {sorted(set(ids) - known)}")
        _replace(db, VolunteerSkill, user.user_id, [
            VolunteerSkill(user_id=user.user_id, skill_id=s.skill_id, proficiency_level=s.proficiency_level,
                           years_experience=s.years_experience) for s in body.skills])
    if body.interests is not None:
        _replace(db, VolunteerInterest, user.user_id, [
            VolunteerInterest(user_id=user.user_id, interest_category=c) for c in sorted(set(body.interests))])
    if body.languages is not None:
        names = [l.language.strip().lower() for l in body.languages]
        if len(set(names)) != len(names):
            raise HTTPException(422, "Duplicate language in languages")
        _replace(db, VolunteerLanguage, user.user_id, [
            VolunteerLanguage(user_id=user.user_id, language=l.language.strip(), proficiency=l.proficiency)
            for l in body.languages])
    if body.qualifications is not None:
        _replace(db, VolunteerQualification, user.user_id, [
            VolunteerQualification(user_id=user.user_id, **q.model_dump()) for q in body.qualifications])
    if body.availability is not None:
        _replace(db, Availability, user.user_id, [
            Availability(user_id=user.user_id, **a.model_dump()) for a in body.availability])
    db.commit()
    return _profile_out(db, user)


# ---------- history ----------

def _counted(user_id: int):
    """Contributions that count towards totals (everything except rejected)."""
    return (Contribution.user_id == user_id, Contribution.status != "rejected")


@router.get("/me/contributions", response_model=list[ContributionOut])
def my_contributions(db: Session = Depends(get_db), user: User = Depends(require_volunteer)):
    rows = db.execute(select(Contribution, Project.title).join(Project, Project.project_id == Contribution.project_id)
                      .where(Contribution.user_id == user.user_id)
                      .order_by(Contribution.contribution_date.desc(), Contribution.contribution_id.desc())).all()
    return [ContributionOut(contribution_id=c.contribution_id, project_id=c.project_id, project_title=t,
                            event_id=c.event_id, role=c.role, hours=c.hours,
                            contribution_date=c.contribution_date, status=c.status) for c, t in rows]


@router.get("/me/stats", response_model=VolunteerStatsOut)
def my_stats(db: Session = Depends(get_db), user: User = Depends(require_volunteer)):
    now = utcnow()
    month_start = now.date().replace(day=1)
    total = db.scalar(select(func.coalesce(func.sum(Contribution.hours), 0)).where(*_counted(user.user_id))) or 0
    verified = db.scalar(select(func.coalesce(func.sum(Contribution.hours), 0)).where(
        Contribution.user_id == user.user_id, Contribution.status == "verified")) or 0
    this_month = db.scalar(select(func.coalesce(func.sum(Contribution.hours), 0)).where(
        *_counted(user.user_id), Contribution.contribution_date >= month_start)) or 0
    contributed = set(db.scalars(select(Contribution.project_id).where(*_counted(user.user_id))))
    completed = set(db.scalars(select(Project.project_id).where(
        Project.project_id.in_(list(contributed)), Project.status == "completed"))) if contributed else set()
    certified = set(db.scalars(select(Certificate.project_id).where(Certificate.user_id == user.user_id)))
    upcoming = db.scalar(select(func.count()).select_from(Registration).join(Event, Event.event_id == Registration.event_id).where(
        Registration.user_id == user.user_id, Registration.status == "registered", Event.status == "active",
        Event.start_datetime >= now, Event.start_datetime < now + timedelta(days=7))) or 0
    # skills contributed = the volunteer's own skills that the projects they worked on asked for
    skills = sorted(db.scalars(select(Skill.skill_name).join(VolunteerSkill, VolunteerSkill.skill_id == Skill.skill_id).where(
        VolunteerSkill.user_id == user.user_id,
        Skill.skill_id.in_(select(ProjectRequiredSkill.skill_id).where(ProjectRequiredSkill.project_id.in_(list(contributed))))))) if contributed else []
    return VolunteerStatsOut(
        total_hours=float(total), verified_hours=float(verified), hours_this_month=float(this_month),
        projects_completed=len(completed), upcoming_this_week=upcoming, skills_contributed=skills,
        certificates=len(certified), certificates_ready=len(completed - certified))


@router.get("/me/hours", response_model=list[MonthlyHoursOut])
def my_hours(by: str = Query("month", pattern="^month$"), months: int = Query(6, ge=1, le=24),
             db: Session = Depends(get_db), user: User = Depends(require_volunteer)):
    """Hours per calendar month for the last `months` months (oldest first, zero months included)."""
    today = utcnow().date()
    keys, y, m = [], today.year, today.month
    for _ in range(months):
        keys.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    keys.reverse()
    first = date(int(keys[0][:4]), int(keys[0][5:]), 1)
    totals: dict[str, float] = defaultdict(float)
    for d, h in db.execute(select(Contribution.contribution_date, Contribution.hours).where(
            *_counted(user.user_id), Contribution.contribution_date >= first)):
        totals[f"{d.year:04d}-{d.month:02d}"] += float(h)
    return [MonthlyHoursOut(month=k, hours=round(totals.get(k, 0.0), 2)) for k in keys]


@router.get("/me/certificates", response_model=list[CertificateOut])
def my_certificates(db: Session = Depends(get_db), user: User = Depends(require_volunteer)):
    rows = db.execute(select(Certificate, Project.title).join(Project, Project.project_id == Certificate.project_id)
                      .where(Certificate.user_id == user.user_id).order_by(Certificate.issued_at.desc())).all()
    return [CertificateOut(certificate_id=c.certificate_id, verification_code=c.verification_code, project_id=c.project_id,
                           project_title=t, total_hours=c.total_hours, issued_at=c.issued_at) for c, t in rows]


@router.get("/me/activities", response_model=list[ActivityOut])
def my_activities(past: bool = False, db: Session = Depends(get_db), user: User = Depends(require_volunteer)):
    """Upcoming (default) or past events the volunteer is registered for. Upcoming includes the waitlist."""
    now = utcnow()
    q = (select(Registration, Event, Project.title).join(Event, Event.event_id == Registration.event_id)
         .join(Project, Project.project_id == Event.project_id).where(Registration.user_id == user.user_id))
    if past:
        q = q.where(Registration.status == "registered", Event.end_datetime < now).order_by(Event.start_datetime.desc())
    else:
        q = q.where(Registration.status.in_(("registered", "waitlisted")), Event.end_datetime >= now).order_by(Event.start_datetime)
    hours: dict[int, float] = defaultdict(float)
    if past:
        for eid, h in db.execute(select(Contribution.event_id, Contribution.hours).where(
                *_counted(user.user_id), Contribution.event_id.is_not(None))):
            hours[eid] += float(h)
    return [ActivityOut(event_id=e.event_id, event_title=e.title, project_id=e.project_id, project_title=t, venue=e.venue,
                        start_datetime=e.start_datetime, end_datetime=e.end_datetime, registration_status=r.status,
                        hours=round(hours.get(e.event_id, 0.0), 2) if past else None)
            for r, e, t in db.execute(q).all()]
