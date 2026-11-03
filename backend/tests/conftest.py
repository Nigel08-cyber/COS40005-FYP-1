import os
from pathlib import Path

# TEST_DATABASE_URL=postgresql+psycopg://... runs the whole suite on a real PostgreSQL that already has schema.sql
# loaded (the migrations are applied below). Without it the tests use in-memory SQLite.
PG_URL = os.environ.get("TEST_DATABASE_URL")
os.environ["DATABASE_URL"] = PG_URL or "sqlite://"
os.environ["JWT_SECRET"] = "test-secret-test-secret-test-secret-32b"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import Ngo, NgoMember, User, VolunteerProfile
from app.security import hash_password

PASSWORD = "password123"


@pytest.fixture(scope="session")
def pg_engine():
    if not PG_URL:
        return None
    engine = create_engine(PG_URL)
    migrations = sorted((Path(__file__).resolve().parent.parent / "migrations").glob("*.sql"))
    with engine.begin() as conn:
        for f in migrations:
            conn.exec_driver_sql(f.read_text())
    return engine


@pytest.fixture()
def db_session(pg_engine):
    if pg_engine is not None:
        with pg_engine.begin() as conn:
            names = [r[0] for r in conn.exec_driver_sql("select tablename from pg_tables where schemaname = 'public'")]
            conn.exec_driver_sql("TRUNCATE " + ", ".join(f'"{n}"' for n in names) + " RESTART IDENTITY CASCADE")
        s = sessionmaker(bind=pg_engine, expire_on_commit=False)()
        yield s
        s.close()
        return
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    s = sessionmaker(bind=engine, expire_on_commit=False)()
    yield s
    s.close()


@pytest.fixture()
def client(db_session):
    app.dependency_overrides[get_db] = lambda: db_session
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def signup(client, email, role="volunteer"):
    r = client.post("/auth/register", json={"full_name": email.split("@")[0], "email": email, "password": PASSWORD, "role": role})
    assert r.status_code == 201, r.text
    return auth_header(r.json()["access_token"])


def login(client, email):
    r = client.post("/auth/login", json={"email": email, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return auth_header(r.json()["access_token"])


def make_platform_admin(db, email="admin@example.com"):
    db.add(User(email=email, full_name="Admin", password_hash=hash_password(PASSWORD), system_role="platform_admin"))
    db.commit()


def make_ngo_member(db, ngo_id, email, role):
    u = User(email=email, full_name=email, password_hash=hash_password(PASSWORD))
    db.add(u)
    db.flush()
    db.add(NgoMember(ngo_id=ngo_id, user_id=u.user_id, member_role=role))
    db.commit()
    return u


def make_active_ngo(db, reg="REG-1", admin_email="ngo@example.com"):
    """An active NGO with an ngo_admin member; returns (ngo_id, admin user)."""
    ngo = Ngo(registration_no=reg, name=f"NGO {reg}", status="active")
    db.add(ngo)
    db.flush()
    admin = make_ngo_member(db, ngo.ngo_id, admin_email, "ngo_admin")
    return ngo.ngo_id, admin


def setup_event(client, db, capacity=1, ngo_reg="REG-1", admin_email="ngo@example.com"):
    """Active NGO + its admin token + an active project and an active event."""
    ngo_id, _ = make_active_ngo(db, ngo_reg, admin_email)
    ngo = login(client, admin_email)
    pid = client.post("/projects", json={"ngo_id": ngo_id, "title": "Beach clean", "status": "active", "volunteers_needed": 5}, headers=ngo).json()["project_id"]
    ev = client.post(f"/projects/{pid}/events", json={"title": "Day 1", "start_datetime": "2026-11-01T09:00:00", "end_datetime": "2026-11-01T12:00:00", "capacity": capacity}, headers=ngo)
    assert ev.status_code == 201, ev.text
    return ngo, ngo_id, pid, ev.json()["event_id"]


def apply_and_approve(client, ngo, pid, email):
    vh = signup(client, email)
    a = client.post(f"/projects/{pid}/applications", headers=vh)
    assert a.status_code == 201, a.text
    r = client.patch(f"/applications/{a.json()['application_id']}", json={"decision": "approved"}, headers=ngo)
    assert r.status_code == 200, r.text
    return vh
