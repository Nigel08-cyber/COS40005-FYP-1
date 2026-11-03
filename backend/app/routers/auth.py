from datetime import datetime, timedelta

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.deps import get_current_user, get_roles, require_roles
from app.models import RefreshToken, User, VolunteerProfile, utcnow
from app.schemas import LoginIn, RegisterIn, SystemRoleIn, TokenOut, UserOut
from app.security import (
    create_access_token, hash_password, hash_refresh_token, new_refresh_token, verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])
COOKIE = "refresh_token"


_ROLE_PRIORITY = ("system_admin", "ngo_admin", "project_coordinator", "volunteer")


def _user_out(db: Session, user: User) -> UserOut:
    roles = get_roles(db, user)
    # Only an NGO admin can self-register without a volunteer profile, so "no role yet" means "NGO admin who
    # still has to create the organisation".
    primary = next((r for r in _ROLE_PRIORITY if r in roles), "ngo_admin")
    return UserOut(user_id=user.user_id, id=user.user_id, email=user.email, full_name=user.full_name,
                   system_role=user.system_role, roles=sorted(roles), role=primary)


def _issue(db: Session, user: User, response: Response) -> TokenOut:
    s = get_settings()
    access, ttl = create_access_token(user.user_id)
    raw, digest = new_refresh_token()
    db.add(RefreshToken(user_id=user.user_id, token_hash=digest, expires_at=utcnow() + timedelta(days=s.refresh_token_days)))
    db.commit()
    response.set_cookie(
        COOKIE, raw, max_age=s.refresh_token_days * 86400, httponly=True,
        secure=s.cookie_secure, samesite=s.cookie_samesite, path="/auth",
    )
    return TokenOut(access_token=access, expires_in=ttl, user=_user_out(db, user))


@router.post("/register", response_model=TokenOut, status_code=201)
def register(body: RegisterIn, response: Response, db: Session = Depends(get_db)):
    """Volunteers get a users row plus an empty volunteer_profile. NGO admins get a users row and then
    create their organisation with POST /ngos (which makes them its ngo_admin). Platform admins and
    coordinators are never self-registered."""
    email = body.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
    user = User(email=email, full_name=body.full_name.strip(), password_hash=hash_password(body.password))
    db.add(user)
    db.flush()
    if body.role == "volunteer":
        db.add(VolunteerProfile(user_id=user.user_id))
    db.commit()
    return _issue(db, user, response)


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, response: Response, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    ok = verify_password(body.password, user.password_hash if user else None)
    if not user or not ok or user.account_status != "active":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    return _issue(db, user, response)


@router.post("/refresh", response_model=TokenOut)
def refresh(response: Response, db: Session = Depends(get_db), refresh_token: str | None = Cookie(default=None)):
    """Rotate the refresh token: the old one is revoked and a new pair is issued."""
    bad = HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")
    if not refresh_token:
        raise bad
    row = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(refresh_token)))
    if row is None:
        raise bad
    now = utcnow()
    if row.revoked_at is not None:
        # A rotated token was used again: assume theft and revoke every session of this user
        for t in db.scalars(select(RefreshToken).where(RefreshToken.user_id == row.user_id, RefreshToken.revoked_at.is_(None))):
            t.revoked_at = now
        db.commit()
        raise bad
    if row.expires_at < now:
        raise bad
    user = db.get(User, row.user_id)
    if user is None or user.account_status != "active":
        raise bad
    row.revoked_at = now
    db.commit()
    return _issue(db, user, response)


@router.post("/logout", status_code=204)
def logout(response: Response, db: Session = Depends(get_db), refresh_token: str | None = Cookie(default=None)):
    if refresh_token:
        row = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(refresh_token)))
        if row and row.revoked_at is None:
            row.revoked_at = utcnow()
            db.commit()
    response.delete_cookie(COOKIE, path="/auth")


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _user_out(db, user)


@router.patch("/users/{user_id}/system-role", response_model=UserOut)
def set_system_role(user_id: int, body: SystemRoleIn, db: Session = Depends(get_db), _: User = Depends(require_roles())):
    """System Admin only: promote or demote a platform admin. (Coordinators are added per NGO, see /ngos/{id}/members.)"""
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    target.system_role = body.system_role
    db.commit()
    return _user_out(db, target)
