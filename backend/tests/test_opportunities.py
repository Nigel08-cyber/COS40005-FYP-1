from datetime import datetime, timedelta, timezone

from app.models import Project, Skill
from tests.conftest import apply_and_approve, login, make_active_ngo, setup_event, signup

FMT = "%Y-%m-%dT%H:%M:%S"


def _later(days, hours=3):
    t = datetime.now(timezone.utc).replace(tzinfo=None, microsecond=0) + timedelta(days=days)
    return t.strftime(FMT), (t + timedelta(hours=hours)).strftime(FMT)


def test_opportunity_shape_counts_skills_and_distance(client, db_session):
    ngo, ngo_id, pid, old_eid = setup_event(client, db_session, capacity=2)          # Day 1 is in 2026-11-01 (past or soon)
    s, e = _later(3)
    next_eid = client.post(f"/projects/{pid}/events", headers=ngo, json={"title": "Next", "venue": "Hall A", "start_datetime": s, "end_datetime": e, "capacity": 1}).json()["event_id"]
    sk = Skill(skill_name="Logistics")
    db_session.add(sk)
    db_session.commit()
    client.put(f"/projects/{pid}/skills", json=[{"skill_id": sk.skill_id}], headers=ngo)
    p = db_session.get(Project, pid)
    p.latitude, p.longitude, p.min_experience_years, p.preferred_day = 3.0567, 101.5851, 2, 6
    db_session.commit()
    v1, v2 = apply_and_approve(client, ngo, pid, "v1@example.com"), apply_and_approve(client, ngo, pid, "v2@example.com")
    client.put("/me/profile", json={"latitude": 3.0733, "longitude": 101.6067}, headers=v1)
    client.post(f"/events/{next_eid}/registrations", headers=v1)
    client.post(f"/events/{next_eid}/registrations", headers=v2)                     # full -> waitlisted
    o = client.get(f"/opportunities/{pid}", headers=v1).json()
    assert o["event_id"] == next_eid and o["venue"] == "Hall A" and o["title"] == "Beach clean"
    assert o["ngo_name"] == "NGO REG-1" and o["skills"] == ["Logistics"] and o["min_experience_years"] == 2 and o["preferred_day"] == 6
    assert (o["volunteers_needed"], o["registered_count"], o["waitlist_count"]) == (1, 1, 1)
    assert o["start"] == s and o["end"] == e
    assert 1 < o["distance_km"] < 5
    assert client.get(f"/opportunities/{pid}", headers=v2).json()["distance_km"] is None   # no saved coordinates
    listed = client.get("/opportunities", headers=v1).json()
    assert [x["project_id"] for x in listed] == [pid]


def test_visibility_and_fallback_dates(client, db_session):
    ngo, ngo_id, pid, eid = setup_event(client, db_session)
    draft = client.post("/projects", json={"ngo_id": ngo_id, "title": "Draft"}, headers=ngo).json()["project_id"]
    nodates = client.post("/projects", json={"ngo_id": ngo_id, "title": "No event", "status": "active", "start_date": "2027-01-10", "end_date": "2027-01-12"}, headers=ngo).json()["project_id"]
    vh = signup(client, "v@example.com")
    got = {o["project_id"]: o for o in client.get("/opportunities", headers=vh).json()}
    assert draft not in got and {pid, nodates} <= set(got)
    assert got[nodates]["event_id"] is None and got[nodates]["start"] == "2027-01-10T00:00:00" and got[nodates]["end"] == "2027-01-12T23:59:00"
    assert client.get(f"/opportunities/{draft}", headers=vh).status_code == 404
    assert client.get("/opportunities/999", headers=vh).status_code == 404
    assert client.get("/opportunities").status_code == 401
    # a suspended NGO's projects disappear
    from app.models import Ngo
    db_session.get(Ngo, ngo_id).status = "suspended"
    db_session.commit()
    assert client.get("/opportunities", headers=vh).json() == []
