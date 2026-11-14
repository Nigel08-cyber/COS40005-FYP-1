import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.config import get_settings
from app.main import app
from app.models import AuditLog
from tests.conftest import PASSWORD, login, make_platform_admin, signup


def logs(db, prefix=""):
    return [r for r in db.scalars(select(AuditLog).order_by(AuditLog.log_id)) if r.action.startswith(prefix)]


def test_failed_and_successful_logins_are_logged_without_secrets(client, db_session):
    signup(client, "v@example.com")
    client.post("/auth/login", json={"email": "v@example.com", "password": "wrong-password"})
    client.post("/auth/login", json={"email": "v@example.com", "password": PASSWORD})
    rows = logs(db_session, "POST /auth/login")
    assert [r.details["status"] for r in rows] == [401, 200]
    assert rows[0].user_id is None and rows[1].user_id is not None
    dump = " ".join(str(r.details) for r in logs(db_session))
    assert PASSWORD not in dump and "wrong-password" not in dump


def test_only_changes_are_logged_with_user_and_entity(client, db_session):
    from tests.conftest import setup_event
    ngo, ngo_id, pid, eid = setup_event(client, db_session)
    client.get(f"/events/{eid}", headers=ngo)
    assert logs(db_session, "GET") == []  # reads are not logged
    client.patch(f"/events/{eid}", json={"title": "New title"}, headers=ngo)
    row = logs(db_session, "PATCH /events/{event_id}")[0]
    assert row.entity_type == "event" and row.entity_id == eid and row.user_id and row.details["status"] == 200
    assert logs(db_session, "POST /auth/refresh") == []


def test_audit_log_endpoint_is_admin_only_and_filters(client, db_session):
    make_platform_admin(db_session)
    v = signup(client, "v@example.com")
    client.post("/auth/login", json={"email": "v@example.com", "password": "nope-nope-nope"})
    assert client.get("/audit-logs", headers=v).status_code == 403
    admin = login(client, "admin@example.com")
    everything = client.get("/audit-logs", headers=admin).json()
    assert everything and everything[0]["log_id"] > everything[-1]["log_id"]  # newest first
    only = client.get("/audit-logs?action=POST /auth/login", headers=admin).json()
    assert only and all(r["action"] == "POST /auth/login" for r in only)
    assert client.get("/audit-logs?limit=1", headers=admin).json().__len__() == 1


def test_unsafe_config_is_reported(monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "jwt_secret", "dev-only-change-me")
    monkeypatch.setattr(s, "cookie_secure", False)
    problems = s.config_problems()
    assert any("JWT_SECRET" in p for p in problems) and any("COOKIE_SECURE" in p for p in problems)


def test_production_refuses_to_start_with_unsafe_config(monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "environment", "production")
    monkeypatch.setattr(s, "cookie_secure", False)
    with pytest.raises(RuntimeError, match="COOKIE_SECURE"):
        with TestClient(app):
            pass
    monkeypatch.setattr(s, "cookie_secure", True)
    monkeypatch.setattr(s, "cors_origins", "https://example.vercel.app")
    with TestClient(app):  # a safe configuration starts
        pass
