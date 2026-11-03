from collections import defaultdict
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import assert_ngo_staff, get_current_user, require_roles
from app.models import (
    Contribution, Event, Ngo, NgoMember, Project, ProjectApplication, ProjectRequiredSkill, Skill, User, VolunteerSkill,
    utcnow,
)
from app.schemas import (
    MemberDetailOut, MemberIn, MemberOut, NgoDashboardOut, NgoIn, NgoOut, NgoStatusIn, NgoUpdate, ProjectFillOut,
    SkillGapOut,
)

router = APIRouter(prefix="/ngos", tags=["ngos"])


@router.post("", response_model=NgoOut, status_code=201)
def create_ngo(body: NgoIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Anyone signed in can register an organisation. It starts as 'pending' until a platform admin
    activates it, and the creator becomes its ngo_admin."""
    if db.scalar(select(Ngo).where(Ngo.registration_no == body.registration_no)):
        raise HTTPException(status.HTTP_409_CONFLICT, "An NGO with this registration number already exists")
    ngo = Ngo(**body.model_dump(), status="pending")
    db.add(ngo)
    db.flush()
    db.add(NgoMember(ngo_id=ngo.ngo_id, user_id=user.user_id, member_role="ngo_admin"))
    db.commit()
    return ngo


@router.get("", response_model=list[NgoOut])
def list_ngos(mine: bool = False, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Active organisations for everyone. mine=true lists the organisations the user belongs to (any status);
    a platform admin sees every organisation."""
    q = select(Ngo).order_by(Ngo.name)
    if mine:
        q = q.where(Ngo.ngo_id.in_(select(NgoMember.ngo_id).where(NgoMember.user_id == user.user_id, NgoMember.status == "active")))
    elif user.system_role != "platform_admin":
        q = q.where(Ngo.status == "active")
    return db.scalars(q).all()


@router.get("/{ngo_id}", response_model=NgoOut)
def get_ngo(ngo_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    ngo = db.get(Ngo, ngo_id)
    if not ngo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "NGO not found")
    return ngo


@router.patch("/{ngo_id}", response_model=NgoOut)
def update_ngo(ngo_id: int, body: NgoUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Edit the organisation profile (ngo_admin of this NGO, or platform admin)."""
    ngo = db.get(Ngo, ngo_id)
    if not ngo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "NGO not found")
    assert_ngo_staff(db, user, ngo_id, admin_only=True)
    for k, v in body.model_dump(exclude_unset=True).items():
        if k == "name" and v is None:
            continue
        setattr(ngo, k, v)
    db.commit()
    return ngo


@router.patch("/{ngo_id}/status", response_model=NgoOut)
def set_ngo_status(ngo_id: int, body: NgoStatusIn, db: Session = Depends(get_db), _: User = Depends(require_roles())):
    """System Admin only: approve (active) or suspend an organisation."""
    ngo = db.get(Ngo, ngo_id)
    if not ngo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "NGO not found")
    ngo.status = body.status
    db.commit()
    return ngo


@router.post("/{ngo_id}/members", response_model=MemberOut, status_code=201)
def add_member(ngo_id: int, body: MemberIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """The NGO's admin links an existing user as coordinator (or another admin)."""
    if not db.get(Ngo, ngo_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "NGO not found")
    assert_ngo_staff(db, user, ngo_id, admin_only=True)
    target = db.scalar(select(User).where(User.email == body.email.lower()))
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No user with this email")
    member = db.get(NgoMember, (ngo_id, target.user_id))
    if member and member.status == "active":
        raise HTTPException(status.HTTP_409_CONFLICT, "This user is already a member")
    if member:  # re-activate a removed/invited member
        member.status, member.member_role = "active", body.member_role
    else:
        member = NgoMember(ngo_id=ngo_id, user_id=target.user_id, member_role=body.member_role)
        db.add(member)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Could not add member")
    return member


@router.get("/{ngo_id}/members", response_model=list[MemberDetailOut])
def list_members(ngo_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not db.get(Ngo, ngo_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "NGO not found")
    assert_ngo_staff(db, user, ngo_id)
    rows = db.execute(select(NgoMember, User).join(User, User.user_id == NgoMember.user_id)
                      .where(NgoMember.ngo_id == ngo_id, NgoMember.status != "removed")
                      .order_by(NgoMember.member_role.desc(), User.full_name)).all()
    return [MemberDetailOut(ngo_id=m.ngo_id, user_id=m.user_id, full_name=u.full_name, email=u.email,
                            member_role=m.member_role, status=m.status) for m, u in rows]


@router.delete("/{ngo_id}/members/{user_id}", response_model=MemberOut)
def remove_member(ngo_id: int, user_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Soft-remove a member (status = removed). Projects they coordinated lose their coordinator."""
    assert_ngo_staff(db, user, ngo_id, admin_only=True)
    member = db.get(NgoMember, (ngo_id, user_id))
    if not member or member.status == "removed":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
    if member.member_role == "ngo_admin":
        admins = db.scalar(select(func.count()).select_from(NgoMember).where(
            NgoMember.ngo_id == ngo_id, NgoMember.member_role == "ngo_admin", NgoMember.status == "active")) or 0
        if admins <= 1:
            raise HTTPException(status.HTTP_409_CONFLICT, "An organisation must keep at least one admin")
    member.status = "removed"
    db.execute(update(Project).where(Project.ngo_id == ngo_id, Project.coordinator_id == user_id).values(coordinator_id=None))
    db.commit()
    return member


@router.get("/{ngo_id}/dashboard", response_model=NgoDashboardOut)
def dashboard(ngo_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """NGO dashboard data: volunteer and project stats, requirement fill per active project, skills gap."""
    if not db.get(Ngo, ngo_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "NGO not found")
    assert_ngo_staff(db, user, ngo_id)
    now = utcnow()
    projects = db.scalars(select(Project).where(Project.ngo_id == ngo_id).order_by(Project.project_id)).all()
    pids = [p.project_id for p in projects]
    by_status: dict[str, int] = {k: 0 for k in ("draft", "active", "completed", "cancelled")}
    for p in projects:
        by_status[p.status] = by_status.get(p.status, 0) + 1
    approved: dict[int, set[int]] = defaultdict(set)  # project -> approved volunteer ids
    pending = 0
    hours = month_hours = 0.0
    upcoming = 0
    if pids:
        for pid, uid, st in db.execute(select(ProjectApplication.project_id, ProjectApplication.user_id, ProjectApplication.status)
                                       .where(ProjectApplication.project_id.in_(pids))):
            if st == "approved":
                approved[pid].add(uid)
            elif st == "pending":
                pending += 1
        month_start = now.date().replace(day=1)
        for d, h in db.execute(select(Contribution.contribution_date, Contribution.hours).where(
                Contribution.project_id.in_(pids), Contribution.status != "rejected")):
            hours += float(h)
            if d >= month_start:
                month_hours += float(h)
        upcoming = db.scalar(select(func.count()).select_from(Event).where(
            Event.project_id.in_(pids), Event.status == "active", Event.start_datetime >= now)) or 0
    active = [p for p in projects if p.status == "active"]
    fill = []
    for p in active:
        n = len(approved[p.project_id])
        pct = round(min(100.0, n / p.volunteers_needed * 100), 1) if p.volunteers_needed else None
        fill.append(ProjectFillOut(project_id=p.project_id, title=p.title, status=p.status,
                                   volunteers_needed=p.volunteers_needed, approved_volunteers=n, fill_percent=pct))
    # skills gap: per required skill, how many of the needed spots approved volunteers with that skill cover
    gap: dict[int, list[int]] = defaultdict(lambda: [0, 0])
    names: dict[int, str] = {}
    for p in active:
        reqs = db.execute(select(ProjectRequiredSkill, Skill.skill_name).join(Skill, Skill.skill_id == ProjectRequiredSkill.skill_id)
                          .where(ProjectRequiredSkill.project_id == p.project_id)).all()
        for r, name in reqs:
            need = r.volunteers_needed or 1
            have = 0
            if approved[p.project_id]:
                have = db.scalar(select(func.count()).select_from(VolunteerSkill).where(
                    VolunteerSkill.skill_id == r.skill_id, VolunteerSkill.user_id.in_(list(approved[p.project_id])),
                    VolunteerSkill.proficiency_level >= r.min_proficiency)) or 0
            names[r.skill_id] = name
            gap[r.skill_id][0] += need
            gap[r.skill_id][1] += min(have, need)
    skills_gap = sorted((SkillGapOut(skill_id=k, skill_name=names[k], needed=v[0], covered=v[1], gap=v[0] - v[1])
                         for k, v in gap.items()), key=lambda g: (-g.gap, g.skill_name))
    return NgoDashboardOut(
        ngo_id=ngo_id, volunteers_total=len(set().union(*approved.values())) if approved else 0, pending_applications=pending,
        total_hours=round(hours, 2), hours_this_month=round(month_hours, 2), projects_by_status=by_status,
        upcoming_events=upcoming, requirement_fill=fill, skills_gap=skills_gap)
