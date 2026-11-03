import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import NgoMember, User, VolunteerProfile
from app.security import decode_access_token

_bearer = HTTPBearer(auto_error=False)

SYSTEM_ADMIN = "system_admin"
NGO_ADMIN = "ngo_admin"
COORDINATOR = "project_coordinator"
VOLUNTEER = "volunteer"


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer), db: Session = Depends(get_db)
) -> User:
    unauthorized = HTTPException(
        status.HTTP_401_UNAUTHORIZED, "Not authenticated", headers={"WWW-Authenticate": "Bearer"}
    )
    if creds is None:
        raise unauthorized
    try:
        payload = decode_access_token(creds.credentials)
    except jwt.PyJWTError:
        raise unauthorized
    user = db.get(User, int(payload["sub"]))
    if user is None or user.account_status != "active":
        raise unauthorized
    return user


def get_roles(db: Session, user: User) -> set[str]:
    """Effective roles, read from the database on every request so changes apply immediately.
    platform_admin comes from users.system_role, org roles from ngo_member, volunteer from volunteer_profile."""
    roles: set[str] = set()
    if user.system_role == "platform_admin":
        roles.add(SYSTEM_ADMIN)
    for m in db.scalars(select(NgoMember).where(NgoMember.user_id == user.user_id, NgoMember.status == "active")):
        roles.add(NGO_ADMIN if m.member_role == "ngo_admin" else COORDINATOR)
    if db.get(VolunteerProfile, user.user_id):
        roles.add(VOLUNTEER)
    return roles


def require_roles(*roles: str):
    """RBAC dependency. System Admin always passes."""
    allowed = set(roles) | {SYSTEM_ADMIN}

    def checker(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
        if not (get_roles(db, user) & allowed):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have permission to do this")
        return user

    return checker


def require_volunteer(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
    """Volunteer actions need a volunteer_profile (no admin bypass: applications reference it)."""
    if not db.get(VolunteerProfile, user.user_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only volunteers can do this")
    return user


def ngo_role(db: Session, user: User, ngo_id: int) -> str | None:
    m = db.get(NgoMember, (ngo_id, user.user_id))
    return m.member_role if m and m.status == "active" else None


def assert_ngo_staff(db: Session, user: User, ngo_id: int, admin_only: bool = False) -> None:
    """Org-scoped check: platform admin, or an active member of THIS NGO (ngo_admin only if admin_only)."""
    if user.system_role == "platform_admin":
        return
    role = ngo_role(db, user, ngo_id)
    if role is None or (admin_only and role != "ngo_admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have permission for this organisation")
