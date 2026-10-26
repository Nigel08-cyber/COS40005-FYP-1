import jwt

from app.models import Role
from tests.conftest import login, make_user, signup


def test_register_login_me(client):
    h = signup(client, "a@example.com")
    assert client.get("/auth/me", headers=h).json()["role"] == "volunteer"
    h2 = login(client, "A@Example.com")  # email is case-insensitive
    assert client.get("/auth/me", headers=h2).json()["email"] == "a@example.com"


def test_password_is_argon2_hashed(client, db_session):
    from app.models import User
    signup(client, "a@example.com")
    assert db_session.query(User).one().password_hash.startswith("$argon2")


def test_duplicate_email_and_bad_login(client):
    signup(client, "a@example.com")
    assert client.post("/auth/register", json={"full_name": "x", "email": "a@example.com", "password": "password123"}).status_code == 409
    assert client.post("/auth/login", json={"email": "a@example.com", "password": "wrong-pass"}).status_code == 401
    assert client.post("/auth/login", json={"email": "nobody@example.com", "password": "password123"}).status_code == 401


def test_short_password_rejected(client):
    r = client.post("/auth/register", json={"full_name": "x", "email": "b@example.com", "password": "short"})
    assert r.status_code == 422


def test_cannot_self_register_privileged_roles(client):
    for role in ("system_admin", "project_coordinator"):
        r = client.post("/auth/register", json={"full_name": "x", "email": f"{role}@example.com", "password": "password123", "role": role})
        assert r.status_code == 403


def test_missing_or_bad_token(client):
    assert client.get("/auth/me").status_code == 401
    assert client.get("/auth/me", headers={"Authorization": "Bearer nope"}).status_code == 401


def test_expired_and_wrong_type_tokens_rejected(client):
    from app.config import get_settings
    s = get_settings()
    expired = jwt.encode({"sub": "1", "type": "access", "exp": 1}, s.jwt_secret, algorithm="HS256")
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {expired}"}).status_code == 401
    wrong = jwt.encode({"sub": "1", "type": "refresh", "exp": 9999999999}, s.jwt_secret, algorithm="HS256")
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {wrong}"}).status_code == 401
    none_alg = jwt.encode({"sub": "1", "type": "access", "exp": 9999999999}, "", algorithm="none")
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {none_alg}"}).status_code == 401


def test_refresh_rotation_and_reuse_detection(client):
    client.post("/auth/register", json={"full_name": "x", "email": "r@example.com", "password": "password123"})
    old = client.cookies.get("refresh_token")
    assert old
    r = client.post("/auth/refresh")
    assert r.status_code == 200
    new = client.cookies.get("refresh_token")
    assert new and new != old
    # replaying the rotated token revokes everything
    client.cookies.set("refresh_token", old, path="/auth")
    assert client.post("/auth/refresh").status_code == 401
    client.cookies.set("refresh_token", new, path="/auth")
    assert client.post("/auth/refresh").status_code == 401


def test_logout_revokes_refresh(client):
    client.post("/auth/register", json={"full_name": "x", "email": "r@example.com", "password": "password123"})
    tok = client.cookies.get("refresh_token")
    assert client.post("/auth/logout").status_code == 204
    client.cookies.set("refresh_token", tok, path="/auth")
    assert client.post("/auth/refresh").status_code == 401


def test_rbac_role_change_admin_only(client, db_session):
    vh = signup(client, "v@example.com")
    uid = client.get("/auth/me", headers=vh).json()["id"]
    assert client.patch(f"/auth/users/{uid}/role", json={"role": "project_coordinator"}, headers=vh).status_code == 403
    make_user(db_session, "admin@example.com", Role.system_admin)
    ah = login(client, "admin@example.com")
    r = client.patch(f"/auth/users/{uid}/role", json={"role": "project_coordinator"}, headers=ah)
    assert r.status_code == 200 and r.json()["role"] == "project_coordinator"


def test_project_create_rbac(client):
    vh = signup(client, "v@example.com")
    nh = signup(client, "n@example.com", role="ngo_admin")
    assert client.post("/projects", json={"title": "Food drive"}, headers=vh).status_code == 403
    assert client.post("/projects", json={"title": "Food drive"}, headers=nh).status_code == 201
    assert client.post("/projects", json={"title": "x"}).status_code == 401
