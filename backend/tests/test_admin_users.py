from app.models import RefreshToken
from tests.conftest import PASSWORD, auth_header, login, make_active_ngo, make_ngo_member, make_platform_admin, signup


def seed(client, db):
    make_platform_admin(db)
    ngo_id, _ = make_active_ngo(db, "REG-1", "boss@example.com")
    make_ngo_member(db, ngo_id, "coord@example.com", "coordinator")
    signup(client, "vol@example.com")
    return ngo_id, login(client, "admin@example.com")


def test_only_system_admin_can_list_or_change_users(client, db_session):
    seed(client, db_session)
    assert client.get("/users").status_code == 401
    for email in ("vol@example.com", "boss@example.com", "coord@example.com"):
        h = login(client, email)
        assert client.get("/users", headers=h).status_code == 403
        assert client.patch("/users/1/status", json={"account_status": "suspended"}, headers=h).status_code == 403


def test_list_shows_every_kind_of_user_with_roles_and_organisations(client, db_session):
    ngo_id, admin = seed(client, db_session)
    rows = {u["email"]: u for u in client.get("/users", headers=admin).json()}
    assert set(rows) == {"admin@example.com", "boss@example.com", "coord@example.com", "vol@example.com"}
    assert rows["admin@example.com"]["roles"] == ["system_admin"]
    assert rows["vol@example.com"]["roles"] == ["volunteer"] and rows["vol@example.com"]["organisations"] == []
    assert rows["boss@example.com"]["roles"] == ["ngo_admin"]
    assert rows["coord@example.com"]["roles"] == ["project_coordinator"]
    assert rows["coord@example.com"]["organisations"] == [{"ngo_id": ngo_id, "name": "NGO REG-1", "member_role": "coordinator"}]
    assert "password_hash" not in rows["vol@example.com"]


def test_filters_search_and_paging(client, db_session):
    _, admin = seed(client, db_session)
    emails = lambda **p: [u["email"] for u in client.get("/users", params=p, headers=admin).json()]
    assert emails(role="volunteer") == ["vol@example.com"]
    assert emails(role="ngo_admin") == ["boss@example.com"]
    assert emails(role="project_coordinator") == ["coord@example.com"]
    assert emails(role="system_admin") == ["admin@example.com"]
    assert emails(q="COORD") == ["coord@example.com"]
    assert emails(account_status="suspended") == []
    assert len(emails(limit=2)) == 2 and len(emails(limit=2, offset=2)) == 2 and emails(limit=2, offset=4) == []
    assert client.get("/users", params={"role": "wizard"}, headers=admin).status_code == 422
    assert client.get("/users", params={"account_status": "nope"}, headers=admin).status_code == 422


def test_suspend_blocks_login_and_signs_out_then_reactivate(client, db_session):
    _, admin = seed(client, db_session)
    vol_id = next(u["user_id"] for u in client.get("/users", headers=admin).json() if u["email"] == "vol@example.com")
    r = client.patch(f"/users/{vol_id}/status", json={"account_status": "suspended"}, headers=admin)
    assert r.status_code == 200 and r.json()["account_status"] == "suspended"
    assert db_session.query(RefreshToken).filter(RefreshToken.user_id == vol_id, RefreshToken.revoked_at.is_(None)).count() == 0
    assert client.post("/auth/login", json={"email": "vol@example.com", "password": PASSWORD}).status_code == 401
    assert [u["email"] for u in client.get("/users", params={"account_status": "suspended"}, headers=admin).json()] == ["vol@example.com"]
    r = client.patch(f"/users/{vol_id}/status", json={"account_status": "active"}, headers=admin)
    assert r.status_code == 200 and r.json()["roles"] == ["volunteer"]
    assert client.post("/auth/login", json={"email": "vol@example.com", "password": PASSWORD}).status_code == 200


def test_cannot_suspend_yourself_or_use_bad_input(client, db_session):
    _, admin = seed(client, db_session)
    me = client.get("/auth/me", headers=admin).json()["user_id"]
    assert client.patch(f"/users/{me}/status", json={"account_status": "suspended"}, headers=admin).status_code == 400
    assert client.patch("/users/99999/status", json={"account_status": "suspended"}, headers=admin).status_code == 404
    assert client.patch(f"/users/{me + 1}/status", json={"account_status": "deactivated"}, headers=admin).status_code == 422
