import os

os.environ["DATABASE_URL"] = "sqlite://"  # in-memory
os.environ["JWT_SECRET"] = "test-secret-test-secret-test-secret-32b"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import Role, User
from app.security import hash_password


@pytest.fixture()
def db_session():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, expire_on_commit=False)
    s = Session()
    yield s
    s.close()


@pytest.fixture()
def client(db_session):
    app.dependency_overrides[get_db] = lambda: db_session
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def signup(client, email, role="volunteer", password="password123"):
    r = client.post("/auth/register", json={"full_name": email.split("@")[0], "email": email, "password": password, "role": role})
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def make_user(db, email, role):
    db.add(User(email=email, full_name=email, password_hash=hash_password("password123"), role=role))
    db.commit()


def login(client, email, password="password123"):
    r = client.post("/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}
