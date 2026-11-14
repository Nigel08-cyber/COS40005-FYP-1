"""Audit log (backlog item 27c).

audit_middleware writes one audit_log row for every request that changes data (POST, PUT, PATCH, DELETE), including
failed ones (a burst of 401 on /auth/login is what a password-guessing attack looks like). It records who (user id from
the access token), what (method + route, entity id from the path), the HTTP status, and the client IP. It never reads
request bodies, so passwords, tokens and QR codes cannot end up in the log.

record() adds a row with a meaningful action name for places where the route alone is not enough (check-in, check-out).
"""
import ipaddress
import logging

import jwt
from fastapi import Request
from starlette.concurrency import run_in_threadpool

from app.config import get_settings
from app.models import AuditLog
from app.security import decode_access_token

log = logging.getLogger("app.audit")

_MUTATING = {"POST", "PUT", "PATCH", "DELETE"}
_SKIP_PATHS = {"/auth/refresh", "/auth/password-reset/check"}  # called constantly by the frontend, nothing to learn


def open_session():
    """(session, must_close). Tests replace this to write into the test database."""
    from app.database import SessionLocal
    return SessionLocal(), True


def client_ip(request: Request) -> str | None:
    s = get_settings()
    raw = request.client.host if request.client else None
    if s.trust_proxy_headers:
        fwd = request.headers.get("x-forwarded-for")
        if fwd:
            raw = fwd.split(",")[0].strip()
    try:
        return str(ipaddress.ip_address(raw)) if raw else None
    except ValueError:
        return None  # e.g. the TestClient's "testclient" host


def record(db, user_id: int | None, action: str, entity_type: str | None = None, entity_id: int | None = None,
           details: dict | None = None, ip: str | None = None) -> None:
    """Add one row. The caller commits (so it is part of the same transaction as the change)."""
    db.add(AuditLog(user_id=user_id, action=action[:50], entity_type=entity_type, entity_id=entity_id,
                    details=details, ip_address=ip))


def _user_id_from_token(request: Request) -> int | None:
    header = request.headers.get("authorization", "")
    if not header.lower().startswith("bearer "):
        return None
    try:
        return int(decode_access_token(header[7:])["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None


def _entity(path_params: dict) -> tuple[str | None, int | None]:
    for key, value in path_params.items():
        if key.endswith("_id"):
            try:
                return key[:-3], int(value)
            except (TypeError, ValueError):
                return key[:-3], None
    return None, None


def _write(user_id, action, entity_type, entity_id, details, ip) -> None:
    db, must_close = open_session()
    try:
        record(db, user_id, action, entity_type, entity_id, details, ip)
        db.commit()
    except Exception:  # noqa: BLE001 - the audit log must never break a request
        db.rollback()
        log.exception("audit log write failed")
    finally:
        if must_close:
            db.close()


async def audit_middleware(request: Request, call_next):
    response = await call_next(request)
    if request.method not in _MUTATING or request.url.path in _SKIP_PATHS:
        return response
    route = request.scope.get("route")
    template = getattr(route, "path", request.url.path)
    entity_type, entity_id = _entity(request.scope.get("path_params") or {})
    user_id = getattr(request.state, "audit_user_id", None) or _user_id_from_token(request)
    await run_in_threadpool(
        _write, user_id, f"{request.method} {template}", entity_type, entity_id,
        {"status": response.status_code, "path": request.url.path}, client_ip(request))
    return response
