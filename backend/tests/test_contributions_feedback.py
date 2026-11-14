from tests.conftest import login, make_active_ngo, register_for_event, setup_event, user_id_of


def attended(client, ngo, pid, eid, email, hours_out="2026-11-01T11:00:00"):
    vh = register_for_event(client, ngo, pid, eid, email)
    uid = user_id_of(client, vh)
    r = client.put(f"/events/{eid}/attendance/{uid}", json={"check_in_time": "2026-11-01T09:00:00", "check_out_time": hours_out}, headers=ngo)
    assert r.status_code == 200, r.text
    return vh, uid


def test_staff_can_verify_or_reject_hours(client, db_session):
    ngo, ngo_id, pid, eid = setup_event(client, db_session, capacity=5)
    vh, uid = attended(client, ngo, pid, eid, "v@example.com")
    rows = client.get(f"/projects/{pid}/contributions", headers=ngo).json()
    assert len(rows) == 1 and rows[0]["volunteer_name"] == "v" and rows[0]["hours"] == 2.0 and rows[0]["event_title"] == "Day 1"
    cid = rows[0]["contribution_id"]
    assert client.get(f"/projects/{pid}/contributions", headers=vh).status_code == 403
    assert client.patch(f"/contributions/{cid}", json={"status": "rejected"}, headers=vh).status_code == 403
    make_active_ngo(db_session, "R2", "other@example.com")
    assert client.patch(f"/contributions/{cid}", json={"status": "rejected"}, headers=login(client, "other@example.com")).status_code == 403
    assert client.patch(f"/contributions/{cid}", json={"status": "bogus"}, headers=ngo).status_code == 422
    assert client.patch(f"/contributions/{cid}", json={"status": "rejected"}, headers=ngo).json()["status"] == "rejected"
    assert client.get("/me/stats", headers=vh).json()["total_hours"] == 0  # rejected hours do not count
    assert client.get(f"/projects/{pid}/contributions?status_filter=rejected", headers=ngo).json()[0]["contribution_id"] == cid
    assert client.get(f"/ngos/{ngo_id}/dashboard", headers=ngo).json()["total_hours"] == 0


def test_contribution_lists_skills_the_project_asked_for(client, db_session):
    ngo, ngo_id, pid, eid = setup_event(client, db_session, capacity=5)
    from app.models import ProjectRequiredSkill, Skill, VolunteerSkill
    s = Skill(skill_name="First aid")
    db_session.add(s)
    db_session.flush()
    db_session.add(ProjectRequiredSkill(project_id=pid, skill_id=s.skill_id))
    db_session.commit()
    vh, uid = attended(client, ngo, pid, eid, "v@example.com")
    assert client.get("/me/contributions", headers=vh).json()[0]["skills"] == []  # does not have the skill yet
    db_session.add(VolunteerSkill(user_id=uid, skill_id=s.skill_id, proficiency_level=3))
    db_session.commit()
    assert client.get("/me/contributions", headers=vh).json()[0]["skills"] == ["First aid"]


def test_feedback_only_after_attending_once(client, db_session, clock):
    ngo, ngo_id, pid, eid = setup_event(client, db_session, capacity=5)
    absent = register_for_event(client, ngo, pid, eid, "absent@example.com")
    vh, uid = attended(client, ngo, pid, eid, "v@example.com")
    clock.set("2026-11-01T13:00:00")
    assert client.post(f"/events/{eid}/feedback", json={"rating": 5}, headers=absent).status_code == 403  # never checked in
    assert client.post(f"/events/{eid}/feedback", json={"rating": 0}, headers=vh).status_code == 422
    assert client.post(f"/events/{eid}/feedback", json={"rating": 6}, headers=vh).status_code == 422
    assert client.post("/events/999/feedback", json={"rating": 5}, headers=vh).status_code == 404
    assert client.get(f"/events/{eid}/feedback/me", headers=vh).status_code == 404
    pending = client.get("/me/feedback/pending", headers=vh).json()
    assert [p["event_id"] for p in pending] == [eid] and pending[0]["project_title"] == "Beach clean"
    r = client.post(f"/events/{eid}/feedback", json={"rating": 4, "comments": "  Well organised  "}, headers=vh)
    assert r.status_code == 201 and r.json()["comments"] == "Well organised"
    assert client.post(f"/events/{eid}/feedback", json={"rating": 5}, headers=vh).status_code == 409
    assert client.get(f"/events/{eid}/feedback/me", headers=vh).json()["rating"] == 4
    assert client.get("/me/feedback/pending", headers=vh).json() == []


def test_coordinator_feedback_view(client, db_session, clock):
    ngo, ngo_id, pid, eid = setup_event(client, db_session, capacity=5)
    v1, _ = attended(client, ngo, pid, eid, "v1@example.com")
    v2, _ = attended(client, ngo, pid, eid, "v2@example.com")
    clock.set("2026-11-01T13:00:00")
    client.post(f"/events/{eid}/feedback", json={"rating": 5, "comments": "Great"}, headers=v1)
    client.post(f"/events/{eid}/feedback", json={"rating": 3}, headers=v2)
    out = client.get(f"/events/{eid}/feedback", headers=ngo).json()
    assert out["count"] == 2 and out["average_rating"] == 4.0
    assert out["rating_counts"] == {"1": 0, "2": 0, "3": 1, "4": 0, "5": 1}
    assert {r["volunteer_name"] for r in out["rows"]} == {"v1", "v2"}
    assert client.get(f"/events/{eid}/feedback", headers=v1).status_code == 403
    make_active_ngo(db_session, "R2", "other@example.com")
    assert client.get(f"/events/{eid}/feedback", headers=login(client, "other@example.com")).status_code == 403
