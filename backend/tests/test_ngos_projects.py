from tests.conftest import login, make_active_ngo, make_ngo_member, make_platform_admin, setup_event, signup


def test_create_ngo_pending_until_admin_activates(client, db_session):
    nh = signup(client, "n@example.com", role="ngo_admin")
    r = client.post("/ngos", json={"registration_no": "SSM-1", "name": "Helping Hands"}, headers=nh)
    assert r.status_code == 201 and r.json()["status"] == "pending"
    ngo_id = r.json()["ngo_id"]
    assert client.post("/ngos", json={"registration_no": "SSM-1", "name": "Dup"}, headers=nh).status_code == 409
    assert "ngo_admin" in client.get("/auth/me", headers=nh).json()["roles"]
    # cannot create projects until approved
    body = {"ngo_id": ngo_id, "title": "Food drive"}
    assert client.post("/projects", json=body, headers=nh).status_code == 409
    assert client.patch(f"/ngos/{ngo_id}/status", json={"status": "active"}, headers=nh).status_code == 403
    make_platform_admin(db_session)
    ah = login(client, "admin@example.com")
    assert client.patch(f"/ngos/{ngo_id}/status", json={"status": "active"}, headers=ah).json()["status"] == "active"
    assert client.post("/projects", json=body, headers=nh).status_code == 201


def test_project_create_is_scoped_to_own_ngo(client, db_session):
    id1, _ = make_active_ngo(db_session, "R1", "a1@example.com")
    id2, _ = make_active_ngo(db_session, "R2", "a2@example.com")
    vh = signup(client, "v@example.com")
    a1 = login(client, "a1@example.com")
    assert client.post("/projects", json={"ngo_id": id1, "title": "P"}, headers=vh).status_code == 403
    assert client.post("/projects", json={"ngo_id": id2, "title": "P"}, headers=a1).status_code == 403  # other NGO
    assert client.post("/projects", json={"ngo_id": id1, "title": "P"}, headers=a1).status_code == 201
    assert client.post("/projects", json={"ngo_id": id1, "title": "P"}).status_code == 401
    assert client.post("/projects", json={"ngo_id": id1, "title": "P", "category": "nope"}, headers=a1).status_code == 422
    assert client.post("/projects", json={"ngo_id": id1, "title": "P", "start_date": "2026-12-02", "end_date": "2026-12-01"}, headers=a1).status_code == 422


def test_coordinator_must_belong_to_ngo(client, db_session):
    id1, _ = make_active_ngo(db_session, "R1", "a1@example.com")
    coord = make_ngo_member(db_session, id1, "c1@example.com", "coordinator")
    other = signup(client, "o@example.com")
    other_id = client.get("/auth/me", headers=other).json()["user_id"]
    a1 = login(client, "a1@example.com")
    ok = client.post("/projects", json={"ngo_id": id1, "title": "P", "coordinator_id": coord.user_id}, headers=a1)
    assert ok.status_code == 201
    assert client.post("/projects", json={"ngo_id": id1, "title": "P", "coordinator_id": other_id}, headers=a1).status_code == 422
    assert client.post("/projects", json={"ngo_id": id1, "title": "P", "coordinator_id": 9999}, headers=a1).status_code == 422
    assert "project_coordinator" in client.get("/auth/me", headers=login(client, "c1@example.com")).json()["roles"]


def test_add_member_admin_only(client, db_session):
    id1, _ = make_active_ngo(db_session, "R1", "a1@example.com")
    signup(client, "newcoord@example.com")
    a1 = login(client, "a1@example.com")
    r = client.post(f"/ngos/{id1}/members", json={"email": "newcoord@example.com", "member_role": "coordinator"}, headers=a1)
    assert r.status_code == 201 and r.json()["member_role"] == "coordinator"
    assert client.post(f"/ngos/{id1}/members", json={"email": "newcoord@example.com"}, headers=a1).status_code == 409
    assert client.post(f"/ngos/{id1}/members", json={"email": "nobody@example.com"}, headers=a1).status_code == 404
    coord = login(client, "newcoord@example.com")  # a coordinator cannot add members
    assert client.post(f"/ngos/{id1}/members", json={"email": "a1@example.com"}, headers=coord).status_code == 403


def test_project_visibility(client, db_session):
    id1, _ = make_active_ngo(db_session, "R1", "a1@example.com")
    a1 = login(client, "a1@example.com")
    draft = client.post("/projects", json={"ngo_id": id1, "title": "Draft"}, headers=a1).json()["project_id"]
    live = client.post("/projects", json={"ngo_id": id1, "title": "Live", "status": "active"}, headers=a1).json()["project_id"]
    vh = signup(client, "v@example.com")
    assert [p["project_id"] for p in client.get("/projects", headers=vh).json()] == [live]
    assert client.get(f"/projects/{draft}", headers=vh).status_code == 404
    assert len(client.get("/projects", headers=a1).json()) == 2
    assert client.get(f"/projects/{draft}", headers=a1).status_code == 200
    assert client.patch(f"/projects/{draft}/status", json={"status": "active"}, headers=vh).status_code == 404
    assert client.patch(f"/projects/{draft}/status", json={"status": "active"}, headers=a1).json()["status"] == "active"


def test_events_validation_and_scope(client, db_session):
    ngo, ngo_id, pid, eid = setup_event(client, db_session)
    vh = signup(client, "v@example.com")
    bad = {"title": "x", "start_datetime": "2026-11-01T12:00:00", "end_datetime": "2026-11-01T09:00:00"}
    assert client.post(f"/projects/{pid}/events", json=bad, headers=ngo).status_code == 422
    ok = {"title": "x", "start_datetime": "2026-11-02T09:00:00", "end_datetime": "2026-11-02T10:00:00"}
    assert client.post(f"/projects/{pid}/events", json=ok, headers=vh).status_code == 403
    other, _ = make_active_ngo(db_session, "R2", "a2@example.com")
    assert client.post(f"/projects/{pid}/events", json=ok, headers=login(client, "a2@example.com")).status_code == 403
    assert len(client.get(f"/projects/{pid}/events", headers=vh).json()) == 1
