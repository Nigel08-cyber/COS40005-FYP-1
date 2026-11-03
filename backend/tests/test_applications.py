from tests.conftest import apply_and_approve, login, make_active_ngo, make_ngo_member, make_platform_admin, setup_event, signup


def test_apply_once_only_volunteers_only_active_projects(client, db_session):
    ngo, ngo_id, pid, eid = setup_event(client, db_session)
    vh = signup(client, "v@example.com")
    assert client.post(f"/projects/{pid}/applications", headers=vh).status_code == 201
    assert client.post(f"/projects/{pid}/applications", headers=vh).status_code == 409
    assert client.post(f"/projects/{pid}/applications", headers=ngo).status_code == 403  # NGO staff are not volunteers
    assert client.post("/projects/999/applications", headers=vh).status_code == 404
    draft = client.post("/projects", json={"ngo_id": ngo_id, "title": "Draft"}, headers=ngo).json()["project_id"]
    assert client.post(f"/projects/{draft}/applications", headers=vh).status_code == 404


def test_decision_records_decider_and_is_scoped_to_own_ngo(client, db_session):
    ngo, ngo_id, pid, eid = setup_event(client, db_session)
    make_active_ngo(db_session, "R2", "a2@example.com")
    vh = signup(client, "v@example.com")
    aid = client.post(f"/projects/{pid}/applications", headers=vh).json()["application_id"]
    other_ngo = login(client, "a2@example.com")
    assert client.patch(f"/applications/{aid}", json={"decision": "approved"}, headers=vh).status_code == 403
    assert client.patch(f"/applications/{aid}", json={"decision": "approved"}, headers=other_ngo).status_code == 403
    assert client.get(f"/projects/{pid}/applications", headers=other_ngo).status_code == 403
    assert client.patch(f"/applications/{aid}", json={"decision": "pending"}, headers=ngo).status_code == 422
    r = client.patch(f"/applications/{aid}", json={"decision": "rejected", "coordinator_note": "Full"}, headers=ngo).json()
    assert r["status"] == "rejected" and r["decided_by"] and r["decided_at"] and r["coordinator_note"] == "Full"
    assert client.patch(f"/applications/{aid}", json={"decision": "approved"}, headers=ngo).status_code == 409
    assert len(client.get(f"/projects/{pid}/applications", headers=ngo).json()) == 1


def test_coordinator_and_platform_admin_can_decide(client, db_session):
    ngo, ngo_id, pid, eid = setup_event(client, db_session)
    make_ngo_member(db_session, ngo_id, "coord@example.com", "coordinator")
    make_platform_admin(db_session)
    for i, who in enumerate(("coord@example.com", "admin@example.com")):
        vh = signup(client, f"v{i}@example.com")
        aid = client.post(f"/projects/{pid}/applications", headers=vh).json()["application_id"]
        assert client.patch(f"/applications/{aid}", json={"decision": "approved"}, headers=login(client, who)).status_code == 200


def test_registration_requires_approved_application(client, db_session):
    ngo, ngo_id, pid, eid = setup_event(client, db_session)
    vh = signup(client, "v@example.com")
    assert client.post(f"/events/{eid}/registrations", headers=vh).status_code == 409
    client.post(f"/projects/{pid}/applications", headers=vh)
    assert client.post(f"/events/{eid}/registrations", headers=vh).status_code == 409  # still pending
    assert client.post("/events/999/registrations", headers=vh).status_code == 404


def test_full_event_waitlists_and_promotes_in_order(client, db_session):
    ngo, ngo_id, pid, eid = setup_event(client, db_session, capacity=1)
    v1 = apply_and_approve(client, ngo, pid, "v1@example.com")
    v2 = apply_and_approve(client, ngo, pid, "v2@example.com")
    v3 = apply_and_approve(client, ngo, pid, "v3@example.com")
    assert client.post(f"/events/{eid}/registrations", headers=v1).json()["status"] == "registered"
    assert client.post(f"/events/{eid}/registrations", headers=v1).status_code == 409   # already registered
    assert client.post(f"/events/{eid}/registrations", headers=v2).json()["status"] == "waitlisted"
    assert client.post(f"/events/{eid}/registrations", headers=v2).status_code == 409   # already waitlisted
    assert client.post(f"/events/{eid}/registrations", headers=v3).json()["status"] == "waitlisted"
    ev = client.get(f"/events/{eid}", headers=v1).json()
    assert (ev["registered_count"], ev["waitlist_count"]) == (1, 2)
    # a registered volunteer cancels -> the oldest waitlisted one is promoted, the next stays waitlisted
    assert client.delete(f"/events/{eid}/registrations/me", headers=v1).json()["status"] == "cancelled"
    assert client.delete(f"/events/{eid}/registrations/me", headers=v1).status_code == 404
    assert client.get("/me/applications", headers=v2).json() == [{"project_id": pid, "status": "registered"}]
    assert client.get("/me/applications", headers=v3).json() == [{"project_id": pid, "status": "waitlisted"}]
    # leaving the waitlist frees nobody; a cancelled volunteer rejoins at the back of the waitlist
    assert client.delete(f"/events/{eid}/registrations/me", headers=v3).json()["status"] == "cancelled"
    assert client.post(f"/events/{eid}/registrations", headers=v1).json()["status"] == "waitlisted"
    assert {r["status"] for r in client.get("/me/registrations", headers=v1).json()} == {"waitlisted"}


def test_withdraw_of_registered_volunteer_promotes_waitlist(client, db_session):
    ngo, ngo_id, pid, eid = setup_event(client, db_session, capacity=1)
    v1 = apply_and_approve(client, ngo, pid, "v1@example.com")
    v2 = apply_and_approve(client, ngo, pid, "v2@example.com")
    client.post(f"/events/{eid}/registrations", headers=v1)
    client.post(f"/events/{eid}/registrations", headers=v2)
    assert client.delete(f"/projects/{pid}/applications/me", headers=v1).json()["status"] == "withdrawn"
    assert client.get("/me/applications", headers=v2).json() == [{"project_id": pid, "status": "registered"}]


def test_raising_capacity_promotes_waitlist(client, db_session):
    ngo, ngo_id, pid, eid = setup_event(client, db_session, capacity=1)
    v1 = apply_and_approve(client, ngo, pid, "v1@example.com")
    v2 = apply_and_approve(client, ngo, pid, "v2@example.com")
    client.post(f"/events/{eid}/registrations", headers=v1)
    client.post(f"/events/{eid}/registrations", headers=v2)
    r = client.patch(f"/events/{eid}", json={"capacity": 2}, headers=ngo).json()
    assert (r["registered_count"], r["waitlist_count"]) == (2, 0)
    assert client.get("/me/applications", headers=v2).json() == [{"project_id": pid, "status": "registered"}]


def test_withdraw_cancels_registrations_and_allows_reapply(client, db_session):
    ngo, ngo_id, pid, eid = setup_event(client, db_session, capacity=1)
    v1 = apply_and_approve(client, ngo, pid, "v1@example.com")
    client.post(f"/events/{eid}/registrations", headers=v1)
    assert client.get("/me/applications", headers=v1).json() == [{"project_id": pid, "status": "registered"}]
    assert client.delete(f"/projects/{pid}/applications/me", headers=v1).json()["status"] == "withdrawn"
    assert client.get("/me/applications", headers=v1).json() == []
    assert client.get("/me/registrations", headers=v1).json() == []
    assert client.post(f"/projects/{pid}/applications", headers=v1).status_code == 201  # re-apply -> pending
    assert client.get("/me/applications", headers=v1).json() == [{"project_id": pid, "status": "pending"}]


def test_my_applications_statuses_and_access(client, db_session):
    ngo, ngo_id, pid, eid = setup_event(client, db_session)
    vh = signup(client, "v@example.com")
    client.post(f"/projects/{pid}/applications", headers=vh)
    assert client.get("/me/applications", headers=vh).json() == [{"project_id": pid, "status": "pending"}]
    assert client.get("/me/applications", headers=ngo).status_code == 403
