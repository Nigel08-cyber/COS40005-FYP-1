from app.models import Role
from tests.conftest import login, make_user, signup


def setup_project(client, needed=1):
    ngo = signup(client, "ngo@example.com", role="ngo_admin")
    pid = client.post("/projects", json={"title": "Beach clean", "volunteers_needed": needed}, headers=ngo).json()["id"]
    return ngo, pid


def apply_and_approve(client, ngo, pid, email):
    vh = signup(client, email)
    app = client.post(f"/projects/{pid}/applications", headers=vh)
    assert app.status_code == 201
    r = client.patch(f"/applications/{app.json()['id']}", json={"decision": "approved"}, headers=ngo)
    assert r.status_code == 200
    return vh


def test_apply_once_and_staff_cannot_apply(client):
    ngo, pid = setup_project(client)
    vh = signup(client, "v@example.com")
    assert client.post(f"/projects/{pid}/applications", headers=vh).status_code == 201
    assert client.post(f"/projects/{pid}/applications", headers=vh).status_code == 409
    assert client.post(f"/projects/{pid}/applications", headers=ngo).status_code == 403
    assert client.post("/projects/999/applications", headers=vh).status_code == 404


def test_decision_records_decider_and_is_staff_only(client):
    ngo, pid = setup_project(client)
    vh = signup(client, "v@example.com")
    aid = client.post(f"/projects/{pid}/applications", headers=vh).json()["id"]
    assert client.patch(f"/applications/{aid}", json={"decision": "approved"}, headers=vh).status_code == 403
    assert client.patch(f"/applications/{aid}", json={"decision": "pending"}, headers=ngo).status_code == 422
    r = client.patch(f"/applications/{aid}", json={"decision": "rejected"}, headers=ngo).json()
    assert r["status"] == "rejected" and r["decided_by"] and r["decided_at"]
    assert client.patch(f"/applications/{aid}", json={"decision": "approved"}, headers=ngo).status_code == 409
    assert client.get(f"/projects/{pid}/applications", headers=vh).status_code == 403
    assert len(client.get(f"/projects/{pid}/applications", headers=ngo).json()) == 1


def test_registration_requires_approved_application(client):
    ngo, pid = setup_project(client)
    vh = signup(client, "v@example.com")
    assert client.post(f"/projects/{pid}/registrations", headers=vh).status_code == 409
    client.post(f"/projects/{pid}/applications", headers=vh)
    assert client.post(f"/projects/{pid}/registrations", headers=vh).status_code == 409  # still pending


def test_register_waitlist_and_promotion(client):
    ngo, pid = setup_project(client, needed=1)
    v1 = apply_and_approve(client, ngo, pid, "v1@example.com")
    v2 = apply_and_approve(client, ngo, pid, "v2@example.com")
    assert client.post(f"/projects/{pid}/registrations", headers=v1).json()["status"] == "registered"
    assert client.post(f"/projects/{pid}/registrations", headers=v2).json()["status"] == "waitlisted"
    assert client.post(f"/projects/{pid}/registrations", headers=v2).status_code == 409
    assert {s["status"] for s in client.get("/me/applications", headers=v2).json()} == {"waitlisted"}
    # v1 cancels -> v2 promoted
    assert client.delete(f"/projects/{pid}/registrations/me", headers=v1).json()["status"] == "cancelled"
    assert client.get("/me/applications", headers=v2).json()[0]["status"] == "registered"
    # cancelled volunteer can register again (goes to waitlist since full)
    assert client.post(f"/projects/{pid}/registrations", headers=v1).json()["status"] == "waitlisted"


def test_withdraw_cancels_registration_and_allows_reapply(client):
    ngo, pid = setup_project(client, needed=1)
    v1 = apply_and_approve(client, ngo, pid, "v1@example.com")
    v2 = apply_and_approve(client, ngo, pid, "v2@example.com")
    client.post(f"/projects/{pid}/registrations", headers=v1)
    client.post(f"/projects/{pid}/registrations", headers=v2)
    assert client.delete(f"/projects/{pid}/applications/me", headers=v1).json()["status"] == "withdrawn"
    assert client.get("/me/applications", headers=v1).json() == []
    assert client.get("/me/applications", headers=v2).json()[0]["status"] == "registered"
    assert client.post(f"/projects/{pid}/applications", headers=v1).status_code == 201  # reapply -> pending again
    assert client.get("/me/applications", headers=v1).json()[0]["status"] == "pending"


def test_my_applications_statuses(client):
    ngo, pid = setup_project(client)
    vh = signup(client, "v@example.com")
    client.post(f"/projects/{pid}/applications", headers=vh)
    assert client.get("/me/applications", headers=vh).json() == [{"project_id": pid, "status": "pending"}]
    assert client.get("/me/applications", headers=ngo).status_code == 403


def test_coordinator_and_admin_can_decide(client, db_session):
    ngo, pid = setup_project(client)
    make_user(db_session, "coord@example.com", Role.project_coordinator)
    make_user(db_session, "admin@example.com", Role.system_admin)
    for i, email in enumerate(("coord@example.com", "admin@example.com")):
        vh = signup(client, f"v{i}@example.com")
        aid = client.post(f"/projects/{pid}/applications", headers=vh).json()["id"]
        assert client.patch(f"/applications/{aid}", json={"decision": "approved"}, headers=login(client, email)).status_code == 200
