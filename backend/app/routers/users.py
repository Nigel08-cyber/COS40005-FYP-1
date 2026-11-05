"""System Admin user management (admin panel, backlog item 23b): list every account and suspend / reactivate one."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import exists, or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_roles, require_roles
from app.models import Ngo, NgoMember, RefreshToken, User, VolunteerProfile, utcnow
from app.schemas import AdminUserOrgOut, AdminUserOut, UserStatusIn

router = APIRouter(prefix="/users", tags=["users"])




def _role_condition(role: str):
    if role == "system_admin":
        return User.system_role == "platform_admin"
    if role == "volunteer":
        return exists().where(VolunteerProfile.user_id == User.user_id)
    member_role = {"ngo_admin": "ngo_admin", "project_coordinator": "coordinator"}.get(role)
    if member_role is None:
        raise HTTPException(422, "role must be system_admin, ngo_admin, project_coordinator or volunteer")
    return exists().where(NgoMember.user_id == User.user_id, NgoMember.member_role == member_role, NgoMember.status == "active")


@router.get("", response_model=list[AdminUserOut])
def list_users(
    q: str | None = Query(default=None, description="search name or email"),
    role: str | None = Query(default=None),
    account_status: str | None = Query(default=None, pattern="^(active|suspended|deactivated)$"),
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles()),
):
    """System Admin only. Every account with its effective roles and organisations, sorted by name."""
    stmt = select(User)
    if q and q.strip():
        like = f"%{q.strip().lower()}%"
        stmt = stmt.where(or_(User.email.ilike(like), User.full_name.ilike(like)))
    if role:
        stmt = stmt.where(_role_condition(role))
    if account_status:
        stmt = stmt.where(User.account_status == account_status)
    users = db.scalars(stmt.order_by(User.full_name, User.user_id).limit(limit).offset(offset)).all()

    ids = [u.user_id for u in users]
    orgs: dict[int, list[AdminUserOrgOut]] = {i: [] for i in ids}
    if ids:
        rows = db.execute(
            select(NgoMember.user_id, Ngo.ngo_id, Ngo.name, NgoMember.member_role)
            .join(Ngo, Ngo.ngo_id == NgoMember.ngo_id)
            .where(NgoMember.user_id.in_(ids), NgoMember.status == "active")
            .order_by(Ngo.name)
        ).all()
        for uid, ngo_id, name, member_role in rows:
            orgs[uid].append(AdminUserOrgOut(ngo_id=ngo_id, name=name, member_role=member_role))
    volunteers = set(db.scalars(select(VolunteerProfile.user_id).where(VolunteerProfile.user_id.in_(ids)))) if ids else set()

    out = []
    for u in users:
        roles = set()
        if u.system_role == "platform_admin":
            roles.add("system_admin")
        if u.user_id in volunteers:
            roles.add("volunteer")
        for o in orgs[u.user_id]:
            roles.add("ngo_admin" if o.member_role == "ngo_admin" else "project_coordinator")
        out.append(AdminUserOut(
            user_id=u.user_id, full_name=u.full_name, email=u.email, account_status=u.account_status,
            system_role=u.system_role, roles=sorted(roles), organisations=orgs[u.user_id], created_at=u.created_at,
        ))
    return out


@router.patch("/{user_id}/status", response_model=AdminUserOut)
def set_user_status(user_id: int, body: UserStatusIn, db: Session = Depends(get_db), admin: User = Depends(require_roles())):
    """System Admin only: suspend or reactivate an account. Suspending also signs the user out everywhere."""
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if target.user_id == admin.user_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot change your own account status")
    target.account_status = body.account_status
    if body.account_status == "suspended":
        now = utcnow()
        for t in db.scalars(select(RefreshToken).where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))):
            t.revoked_at = now
    db.commit()
    orgs = [AdminUserOrgOut(ngo_id=n.ngo_id, name=n.name, member_role=m.member_role)
            for m, n in db.execute(select(NgoMember, Ngo).join(Ngo, Ngo.ngo_id == NgoMember.ngo_id)
                                   .where(NgoMember.user_id == user_id, NgoMember.status == "active").order_by(Ngo.name))]
    return AdminUserOut(user_id=target.user_id, full_name=target.full_name, email=target.email, account_status=target.account_status,
                        system_role=target.system_role, roles=sorted(get_roles(db, target)), organisations=orgs, created_at=target.created_at)
