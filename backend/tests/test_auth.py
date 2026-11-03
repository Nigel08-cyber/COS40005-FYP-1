import jwt

from app.models import User, VolunteerProfile
from tests.conftest import login, make_platform_admin, signup


def test_register_login_me(client):
    h = signup(client, "a@example.com")
    me = client.get("/auth/me", headers=h).json()
    assert me["roles"] == ["volunteer"] and me["system_role"] == "user"
    assert client.get("/auth/me", headers=login(client, "A@Example.com")).json()["email"] == "a@example.com"


def test_volunteer_gets_profile_ngo_admin_does_not(client, db_session):
    signup(client, "v@example.com")
    signup(client, "n@example.com", role="ngo_admin")
    assert db_session.query(VolunteerProfile).count() == 1
    assert client.get("/auth/me", headers=login(client, "n@example.com")).json()["roles"] == []


def test_password_is_argon2_hashed(client, db_session):
    signup(client, "a@example.com")
    assert db_session.query(User).one().password_hash.startswith("$argon2")


def test_duplicate_email_and_bad_login(client):
    signup(client, "a@example.com")
    assert client.post("/auth/register", json={"full_name": "x", "email": "a@example.com", "password": "password123"}).status_code == 409
    assert client.post("/auth/login", json={"email": "a@example.com", "password": "wrong-pass"}).status_code == 401
    assert client.post("/auth/login", json={"email": "nobody@example.com", "password": "password123"}).status_code == 401


def test_validation(client):
    assert client.post("/auth/register", json={"full_name": "x", "email": "b@example.com", "password": "short"}).status_code == 422
    for role in ("platform_admin", "coordinator", "project_coordinator"):
        r = client.post("/auth/register", json={"full_name": "x", "email": "c@example.com", "password": "password123", "role": role})
        assert r.status_code == 422


def test_suspended_account_cannot_login_or_use_token(client, db_session):
    h = signup(client, "a@example.com")
    db_session.query(User).one().account_status = "suspended"
    db_session.commit()
    assert client.post("/auth/login", json={"email": "a@example.com", "password": "password123"}).status_code == 401
    assert client.get("/auth/me", headers=h).status_code == 401


def test_missing_expired_wrong_type_none_alg_tokens(client):
    from app.config import get_settings
    s = get_settings()
    assert client.get("/auth/me").status_code == 401
    assert client.get("/auth/me", headers={"Authorization": "Bearer nope"}).status_code == 401
    for tok in (
        jwt.encode({"sub": "1", "type": "access", "exp": 1}, s.jwt_secret, algorithm="HS256"),
        jwt.encode({"sub": "1", "type": "refresh", "exp": 9999999999}, s.jwt_secret, algorithm="HS256"),
        jwt.encode({"sub": "1", "type": "access", "exp": 9999999999}, "", algorithm="none"),
    ):
        assert client.get("/auth/me", headers={"Authorization": f"Bearer {tok}"}).status_code == 401


def test_refresh_rotation_and_reuse_detection(client):
    client.post("/auth/register", json={"full_name": "x", "email": "r@example.com", "password": "password123"})
    old = client.cookies.get("refresh_token")
    assert old and client.post("/auth/refresh").status_code == 200
    new = client.cookies.get("refresh_token")
    assert new and new != old
    # newer httpx keeps both cookies when one is set again, so clear the jar before replaying a token
    client.cookies.clear()
    client.cookies.set("refresh_token", old, path="/auth")
    assert client.post("/auth/refresh").status_code == 401  # reuse -> everything revoked
    client.cookies.clear()
    client.cookies.set("refresh_token", new, path="/auth")
    assert client.post("/auth/refresh").status_code == 401


def test_logout_revokes_refresh(client):
    client.post("/auth/register", json={"full_name": "x", "email": "r@example.com", "password": "password123"})
    tok = client.cookies.get("refresh_token")
    assert client.post("/auth/logout").status_code == 204
    client.cookies.set("refresh_token", tok, path="/auth")
    assert client.post("/auth/refresh").status_code == 401


def test_system_role_change_is_platform_admin_only(client, db_session):
    vh = signup(client, "v@example.com")
    uid = client.get("/auth/me", headers=vh).json()["user_id"]
    assert client.patch(f"/auth/users/{uid}/system-role", json={"system_role": "platform_admin"}, headers=vh).status_code == 403
    make_platform_admin(db_session)
    ah = login(client, "admin@example.com")
    assert client.get("/auth/me", headers=ah).json()["roles"] == ["system_admin"]
    r = client.patch(f"/auth/users/{uid}/system-role", json={"system_role": "platform_admin"}, headers=ah)
    assert r.status_code == 200 and "system_admin" in r.json()["roles"]


def test_user_object_has_id_and_primary_role(client, db_session):
    """The frontend reads user.id and a single user.role (login, register and /auth/me)."""
    from tests.conftest import login, make_active_ngo, make_ngo_member, make_platform_admin

    r = client.post("/auth/register", json={"full_name": "v", "email": "v@example.com", "password": "password123"}).json()["user"]
    assert r["id"] == r["user_id"] and r["role"] == "volunteer" and r["roles"] == ["volunteer"]
    r = client.post("/auth/register", json={"full_name": "n", "email": "n@example.com", "password": "password123", "role": "ngo_admin"}).json()["user"]
    assert r["role"] == "ngo_admin" and r["roles"] == []          # no organisation yet
    ngo_id, _ = make_active_ngo(db_session, "R1", "a1@example.com")
    make_ngo_member(db_session, ngo_id, "c1@example.com", "coordinator")
    make_platform_admin(db_session)
    for email, expected in (("a1@example.com", "ngo_admin"), ("c1@example.com", "project_coordinator"), ("admin@example.com", "system_admin")):
        res = client.post("/auth/login", json={"email": email, "password": "password123"}).json()
        assert res["user"]["role"] == expected, email
        assert client.get("/auth/me", headers=login(client, email)).json()["role"] == expected
