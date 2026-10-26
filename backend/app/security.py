import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from pwdlib import PasswordHash

from app.config import get_settings

# Argon2id with pwdlib's recommended defaults
_hasher = PasswordHash.recommended()
# Verified against when the email is unknown, so login timing doesn't reveal which emails exist
_DUMMY_HASH = _hasher.hash("not-a-real-password")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    return _hasher.verify(password, password_hash or _DUMMY_HASH) and password_hash is not None


def create_access_token(user_id: int, role: str) -> tuple[str, int]:
    s = get_settings()
    expires = timedelta(minutes=s.access_token_minutes)
    now = datetime.now(timezone.utc)
    payload = {"sub": str(user_id), "role": role, "type": "access", "iat": now, "exp": now + expires}
    return jwt.encode(payload, s.jwt_secret, algorithm=s.jwt_algorithm), int(expires.total_seconds())


def decode_access_token(token: str) -> dict:
    s = get_settings()
    payload = jwt.decode(token, s.jwt_secret, algorithms=[s.jwt_algorithm], options={"require": ["exp", "sub"]})
    if payload.get("type") != "access":
        raise jwt.InvalidTokenError("wrong token type")
    return payload


def new_refresh_token() -> tuple[str, str]:
    """Returns (raw token for the cookie, sha256 hash to store)."""
    raw = secrets.token_urlsafe(48)
    return raw, hash_refresh_token(raw)


def hash_refresh_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()
