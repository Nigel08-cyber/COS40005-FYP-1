from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models import RefreshToken, Role, User
from app.schemas import LoginIn, RegisterIn, RoleChangeIn, TokenOut, UserOut
from app.security import (
    create_access_token,
    hash_password,
    hash_refresh_token,
    new_refresh_token,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])
COOKIE = "refresh_token"
# Who can be self-registered. Coordinators/System Admins are promoted by a System Admin.
SELF_SIGNUP = {Role.volunteer, Role.ngo_admin}


def _issue(db: Session, user: User, response: Response) -> TokenOut:
    s = get_settings()
    access, ttl = create_access_token(user.id, user.role.value)
    raw, digest = new_refresh_token()
    expires = datetime.now(timezone.utc) + timedelta(days=s.refresh_token_days)
    db.add(RefreshToken(user_id=user.id, token_hash=digest, expires_at=expires))
    db.commit()
    response.set_cookie(
        COOKIE, raw, max_age=s.refresh_token_days * 86400, httponly=True,
        secure=s.cookie_secure, samesite=s.cookie_samesite, path="/auth",
    )
    return TokenOut(access_token=access, expires_in=ttl, user=UserOut.model_validate(user))


@router.post("/register", response_model=TokenOut, status_code=201)
def register(body: RegisterIn, response: Response, db: Session = Depends(get_db)):
    if body.role not in SELF_SIGNUP:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This role cannot be self-registered")
    email = body.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
    user = User(email=email, full_name=body.full_name.strip(), password_hash=hash_password(body.password), role=body.role)
    db.add(user)
    db.commit()
    return _issue(db, user, response)


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, response: Response, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    ok = verify_password(body.password, user.password_hash if user else None)
    if not user or not ok or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    return _issue(db, user, response)


@router.post("/refresh", response_model=TokenOut)
def refresh(response: Response, db: Session = Depends(get_db), refresh_token: str | None = Cookie(default=None)):
    """Rotate the refresh token: the old one is revoked, a new pair is issued."""
    bad = HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")
    if not refresh_token:
        raise bad
    row = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(refresh_token)))
    if row is None:
        raise bad
    now = datetime.now(timezone.utc)
    expires = row.expires_at if row.expires_at.tzinfo else row.expires_at.replace(tzinfo=timezone.utc)
    if row.revoked_at is not None:
        # Reuse of a rotated token: assume theft and revoke every session for this user
        for t in db.scalars(select(RefreshToken).where(RefreshToken.user_id == row.user_id, RefreshToken.revoked_at.is_(None))):
            t.revoked_at = now
        db.commit()
        raise bad
    if expires < now:
        raise bad
    user = db.get(User, row.user_id)
    if user is None or not user.is_active:
        raise bad
    row.revoked_at = now
    db.commit()
    return _issue(db, user, response)


@router.post("/logout", status_code=204)
def logout(response: Response, db: Session = Depends(get_db), refresh_token: str | None = Cookie(default=None)):
    if refresh_token:
        row = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(refresh_token)))
        if row and row.revoked_at is None:
            row.revoked_at = datetime.now(timezone.utc)
            db.commit()
    response.delete_cookie(COOKIE, path="/auth")


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.patch("/users/{user_id}/role", response_model=UserOut)
def change_role(user_id: int, body: RoleChangeIn, db: Session = Depends(get_db), _: User = Depends(require_roles())):
    """System Admin only: promote/demote, e.g. make someone a Project Coordinator."""
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    target.role = body.role
    db.commit()
    return target
