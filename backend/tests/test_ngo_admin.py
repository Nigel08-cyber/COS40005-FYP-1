from datetime import datetime, timedelta, timezone

from app.models import Contribution, Skill, VolunteerSkill
from tests.conftest import (
    apply_and_approve, login, make_active_ngo, make_ngo_member, make_platform_admin, setup_event, signup,
)


def _skill(db, name):
    s = Skill(skill_name=name)
    db.add(s)
    db.commit()
    return s.skill_id


def test_list_and_update_ngo_profile(client, db_session):
    id1, _ = make_active_ngo(db_session, "R1", "a1@example.com")
    make_ngo_member(db_session, id1, "c1@example.com", "coordinator")
    pend = signup(client, "n@example.com", role="ngo_admin")
    pid = client.post("/ngos", json={"registration_no": "P1", "name": "Pending Org"}, headers=pend).json()["ngo_id"]
    vh = signup(client, "v@example.com")
    assert [n["ngo_id"] for n in client.get("/ngos", headers=vh).json()] == [id1]          # only active ones
    assert [n["ngo_id"] for n in client.get("/ngos?mine=true", headers=pend).json()] == [pid]
    make_platform_admin(db_session)
    ah = login(client, "admin@example.com")
    assert len(client.get("/ngos", headers=ah).json()) == 2
    a1 = login(client, "a1@example.com")
    r = client.patch(f"/ngos/{id1}", json={"description": "We help", "city": "Subang", "email": "hi@org.my"}, headers=a1)
    assert r.status_code == 200 and r.json()["description"] == "We help" and r.json()["registration_no"] == "R1"
    assert client.patch(f"/ngos/{id1}", json={"registration_no": "HACK", "status": "suspended"}, headers=a1).json()["status"] == "active"
    assert client.patch(f"/ngos/{id1}", json={"description": "x"}, headers=login(client, "c1@example.com")).status_code == 403
    assert client.patch(f"/ngos/{id1}", json={"description": "x"}, headers=vh).status_code == 403
    assert client.patch(f"/ngos/{id1}", json={"email": "not-an-email"}, headers=a1).status_code == 422
    assert client.patch("/ngos/999", json={"city": "x"}, headers=ah).status_code == 404


def test_members_list_and_remove_clears_coordinator(client, db_session):
    id1, admin = make_active_ngo(db_session, "R1", "a1@example.com")
    coord = make_ngo_member(db_session, id1, "c1@example.com", "coordinator")
    a1, c1 = login(client, "a1@example.com"), login(client, "c1@example.com")
    pid = client.post("/projects", json={"ngo_id": id1, "title": "P", "coordinator_id": coord.user_id}, headers=a1).json()["project_id"]
    members = client.get(f"/ngos/{id1}/members", headers=a1).json()
    assert [(m["email"], m["member_role"]) for m in members] == [("a1@example.com", "ngo_admin"), ("c1@example.com", "coordinator")]
    assert client.get(f"/ngos/{id1}/members", headers=c1).status_code == 200
    assert client.get(f"/ngos/{id1}/members", headers=signup(client, "v@example.com")).status_code == 403
    assert client.delete(f"/ngos/{id1}/members/{coord.user_id}", headers=c1).status_code == 403
    assert client.delete(f"/ngos/{id1}/members/{admin.user_id}", headers=a1).status_code == 409   # last admin
    assert client.delete(f"/ngos/{id1}/members/{coord.user_id}", headers=a1).json()["status"] == "removed"
    assert client.get(f"/projects/{pid}", headers=a1).json()["coordinator_id"] is None
    assert [m["email"] for m in client.get(f"/ngos/{id1}/members", headers=a1).json()] == ["a1@example.com"]
    assert "project_coordinator" not in client.get("/auth/me", headers=c1).json()["roles"]


def test_coordinator_linking(client, db_session):
    id1, _ = make_active_ngo(db_session, "R1", "a1@example.com")
    id2, _ = make_active_ngo(db_session, "R2", "a2@example.com")
    c1 = make_ngo_member(db_session, id1, "c1@example.com", "coordinator")
    c2 = make_ngo_member(db_session, id2, "c2@example.com", "coordinator")
    a1 = login(client, "a1@example.com")
    pid = client.post("/projects", json={"ngo_id": id1, "title": "P", "status": "active"}, headers=a1).json()["project_id"]
    assert client.put(f"/projects/{pid}/coordinator", json={"coordinator_id": c1.user_id}, headers=a1).json()["coordinator_id"] == c1.user_id
    cc = login(client, "c1@example.com")
    assert [p["project_id"] for p in client.get("/me/coordinated-projects", headers=cc).json()] == [pid]
    assert client.put(f"/projects/{pid}/coordinator", json={"coordinator_id": c2.user_id}, headers=a1).status_code == 422  # other NGO
    assert client.put(f"/projects/{pid}/coordinator", json={"coordinator_id": 9999}, headers=a1).status_code == 422
    assert client.put(f"/projects/{pid}/coordinator", json={"coordinator_id": None}, headers=cc).status_code == 403    # admin only
    assert client.put(f"/projects/{pid}/coordinator", json={"coordinator_id": None}, headers=a1).json()["coordinator_id"] is None
    # a coordinator manages applications of their NGO's projects
    vh = signup(client, "v@example.com")
    aid = client.post(f"/projects/{pid}/applications", headers=vh).json()["application_id"]
    assert client.patch(f"/applications/{aid}", json={"decision": "approved"}, headers=cc).status_code == 200


def test_project_and_event_update(client, db_session):
    ngo, ngo_id, pid, eid = setup_event(client, db_session)
    make_active_ngo(db_session, "R2", "a2@example.com")
    other = login(client, "a2@example.com")
    vh = signup(client, "v@example.com")
    r = client.patch(f"/projects/{pid}", json={"title": "Beach clean 2", "volunteers_needed": 8, "start_date": "2026-11-01", "end_date": "2026-12-01"}, headers=ngo)
    assert r.status_code == 200 and r.json()["title"] == "Beach clean 2" and r.json()["volunteers_needed"] == 8
    assert client.patch(f"/projects/{pid}", json={"end_date": "2026-10-01"}, headers=ngo).status_code == 422
    assert client.patch(f"/projects/{pid}", json={"category": "nope"}, headers=ngo).status_code == 422
    assert client.patch(f"/projects/{pid}", json={"title": "x"}, headers=vh).status_code == 403
    assert client.patch(f"/projects/{pid}", json={"title": "x"}, headers=other).status_code in (403, 404)
    assert client.patch("/projects/999", json={"title": "x"}, headers=ngo).status_code == 404
    e = client.patch(f"/events/{eid}", json={"title": "Day 1 (moved)", "venue": "Pantai", "capacity": 4}, headers=ngo).json()
    assert e["title"] == "Day 1 (moved)" and e["venue"] == "Pantai" and e["capacity"] == 4
    assert client.patch(f"/events/{eid}", json={"end_datetime": "2026-11-01T08:00:00"}, headers=ngo).status_code == 422
    assert client.patch(f"/events/{eid}", json={"title": "x"}, headers=vh).status_code == 403
    assert client.get(f"/events/{eid}", headers=vh).json()["title"] == "Day 1 (moved)"
    assert client.patch(f"/events/{eid}", json={"status": "cancelled"}, headers=ngo).json()["status"] == "cancelled"
    assert client.patch("/events/999", json={"title": "x"}, headers=ngo).status_code == 404


def test_project_required_skills(client, db_session):
    ngo, ngo_id, pid, eid = setup_event(client, db_session)   # volunteers_needed = 5
    s1, s2 = _skill(db_session, "First aid"), _skill(db_session, "Driving")
    vh = signup(client, "v@example.com")
    body = [{"skill_id": s1, "min_proficiency": 3, "volunteers_needed": 2, "is_mandatory": True}, {"skill_id": s2}]
    r = client.put(f"/projects/{pid}/skills", json=body, headers=ngo)
    assert r.status_code == 200 and [(x["skill_name"], x["min_proficiency"], x["is_mandatory"]) for x in r.json()] == [("Driving", 1, False), ("First aid", 3, True)]
    assert client.put(f"/projects/{pid}/skills", json=body, headers=vh).status_code == 403
    assert client.put(f"/projects/{pid}/skills", json=[{"skill_id": 999}], headers=ngo).status_code == 422
    assert client.put(f"/projects/{pid}/skills", json=[{"skill_id": s1}, {"skill_id": s1}], headers=ngo).status_code == 422
    assert client.put(f"/projects/{pid}/skills", json=[{"skill_id": s1, "volunteers_needed": 6}], headers=ngo).status_code == 422
    assert client.put(f"/projects/{pid}/skills", json=[{"skill_id": s1, "min_proficiency": 9}], headers=ngo).status_code == 422
    assert len(client.get(f"/projects/{pid}/skills", headers=vh).json()) == 2
    assert client.put(f"/projects/{pid}/skills", json=[], headers=ngo).json() == []


def test_ngo_dashboard(client, db_session):
    ngo, ngo_id, pid, eid = setup_event(client, db_session)           # active project, needs 5, one active event
    s1, s2 = _skill(db_session, "First aid"), _skill(db_session, "Driving")
    client.put(f"/projects/{pid}/skills", json=[
        {"skill_id": s1, "min_proficiency": 3, "volunteers_needed": 2}, {"skill_id": s2, "volunteers_needed": 1}], headers=ngo)
    draft = client.post("/projects", json={"ngo_id": ngo_id, "title": "Draft"}, headers=ngo).json()["project_id"]
    v1 = apply_and_approve(client, ngo, pid, "v1@example.com")
    v2 = apply_and_approve(client, ngo, pid, "v2@example.com")
    v3 = signup(client, "v3@example.com")
    client.post(f"/projects/{pid}/applications", headers=v3)           # stays pending
    u1 = client.get("/auth/me", headers=v1).json()["user_id"]
    u2 = client.get("/auth/me", headers=v2).json()["user_id"]
    db_session.add_all([
        VolunteerSkill(user_id=u1, skill_id=s1, proficiency_level=4),   # covers one First aid spot
        VolunteerSkill(user_id=u2, skill_id=s1, proficiency_level=2),   # below min_proficiency 3
    ])
    today = datetime.now(timezone.utc).date()
    db_session.add_all([
        Contribution(user_id=u1, project_id=pid, hours=4, contribution_date=today, status="verified"),
        Contribution(user_id=u2, project_id=pid, hours=1.5, contribution_date=today, status="pending"),
        Contribution(user_id=u2, project_id=pid, hours=8, contribution_date=today, status="rejected"),
    ])
    db_session.commit()
    d = client.get(f"/ngos/{ngo_id}/dashboard", headers=ngo).json()
    assert d["volunteers_total"] == 2 and d["pending_applications"] == 1
    assert d["total_hours"] == 5.5 and d["hours_this_month"] == 5.5
    assert d["projects_by_status"] == {"draft": 1, "active": 1, "completed": 0, "cancelled": 0}
    assert d["requirement_fill"] == [{"project_id": pid, "title": "Beach clean", "status": "active",
                                      "volunteers_needed": 5, "approved_volunteers": 2, "fill_percent": 40.0}]
    gaps = {g["skill_name"]: (g["needed"], g["covered"], g["gap"]) for g in d["skills_gap"]}
    assert gaps == {"First aid": (2, 1, 1), "Driving": (1, 0, 1)}
    # staff of this NGO only
    assert client.get(f"/ngos/{ngo_id}/dashboard", headers=v1).status_code == 403
    make_active_ngo(db_session, "R2", "a2@example.com")
    assert client.get(f"/ngos/{ngo_id}/dashboard", headers=login(client, "a2@example.com")).status_code == 403
    assert client.get("/ngos/999/dashboard", headers=ngo).status_code == 404
    # an NGO with no projects returns zeros, not an error
    empty = client.get(f"/ngos/{make_active_ngo(db_session, 'R3', 'a3@example.com')[0]}/dashboard", headers=login(client, "a3@example.com")).json()
    assert empty["volunteers_total"] == 0 and empty["requirement_fill"] == [] and empty["skills_gap"] == []



def test_project_requirement_fields_roundtrip(client, db_session):
    """Minimum experience and preferred day/time are stored on the project and returned by the API."""
    ngo_id, _ = make_active_ngo(db_session, "R1", "a1@example.com")
    a1 = login(client, "a1@example.com")
    body = {"ngo_id": ngo_id, "title": "Food drive", "min_experience_years": 2, "preferred_day": 6,
            "preferred_start_time": "08:00:00", "preferred_end_time": "13:00:00"}
    created = client.post("/projects", json=body, headers=a1).json()
    assert (created["min_experience_years"], created["preferred_day"], created["preferred_start_time"]) == (2, 6, "08:00:00")
    pid = created["project_id"]
    r = client.patch(f"/projects/{pid}", json={"preferred_day": 7, "min_experience_years": 0}, headers=a1).json()
    assert (r["preferred_day"], r["min_experience_years"], r["preferred_end_time"]) == (7, 0, "13:00:00")
    assert client.post("/projects", json={**body, "preferred_day": 9}, headers=a1).status_code == 422
