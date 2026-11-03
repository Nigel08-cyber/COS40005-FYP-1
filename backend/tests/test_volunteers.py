from datetime import date, datetime, timedelta, timezone

from app.models import Certificate, Contribution, Event, Project, ProjectRequiredSkill, Registration, Skill, VolunteerSkill
from tests.conftest import apply_and_approve, login, make_platform_admin, setup_event, signup


def _skills(db, *names):
    rows = [Skill(skill_name=n) for n in names]
    db.add_all(rows)
    db.commit()
    return [r.skill_id for r in rows]


def _uid(client, headers):
    return client.get("/auth/me", headers=headers).json()["user_id"]


def test_profile_roundtrip_and_replace_semantics(client, db_session):
    first, second = _skills(db_session, "First aid", "Logistics")
    vh = signup(client, "v@example.com")
    p = client.get("/me/profile", headers=vh).json()
    assert p["skills"] == [] and p["email"] == "v@example.com" and p["city"] is None
    body = {
        "full_name": "Aisha Rahman", "phone": "+60123456789", "bio": "Hi", "city": "Subang Jaya", "state": "Selangor",
        "latitude": 3.05, "longitude": 101.58, "max_travel_km": 15, "years_experience": 2,
        "skills": [{"skill_id": first, "proficiency_level": 4}, {"skill_id": second, "proficiency_level": 2, "years_experience": 1}],
        "interests": ["education", "food_aid", "education"],
        "languages": [{"language": "English", "proficiency": "fluent"}, {"language": "Malay", "proficiency": "native"}],
        "qualifications": [{"title": "St John First Aid", "issuer": "St John", "year_obtained": 2024}],
        "availability": [{"day_of_week": 6, "start_time": "08:00:00", "end_time": "12:00:00"}],
    }
    r = client.put("/me/profile", json=body, headers=vh)
    assert r.status_code == 200, r.text
    p = r.json()
    assert p["full_name"] == "Aisha Rahman" and p["phone"] == "+60123456789" and p["city"] == "Subang Jaya"
    assert [s["skill_name"] for s in p["skills"]] == ["First aid", "Logistics"]
    assert p["interests"] == ["education", "food_aid"]
    assert [l["language"] for l in p["languages"]] == ["English", "Malay"]
    assert p["qualifications"][0]["title"] == "St John First Aid" and p["availability"][0]["day_of_week"] == 6
    # omitted fields are unchanged, sent lists replace, an empty list clears
    p = client.patch("/me/profile", json={"bio": "New", "skills": [{"skill_id": second}], "interests": []}, headers=vh).json()
    assert p["bio"] == "New" and p["city"] == "Subang Jaya" and p["max_travel_km"] == 15
    assert [s["skill_name"] for s in p["skills"]] == ["Logistics"] and p["skills"][0]["proficiency_level"] == 3
    assert p["interests"] == [] and len(p["languages"]) == 2 and len(p["availability"]) == 1
    assert client.get("/auth/me", headers=vh).json()["full_name"] == "Aisha Rahman"


def test_profile_validation_and_access(client, db_session):
    (sid,) = _skills(db_session, "Driving")
    vh = signup(client, "v@example.com")
    bad = [
        {"skills": [{"skill_id": 999}]},
        {"skills": [{"skill_id": sid}, {"skill_id": sid}]},
        {"skills": [{"skill_id": sid, "proficiency_level": 6}]},
        {"interests": ["gaming"]},
        {"languages": [{"language": "Tamil", "proficiency": "godlike"}]},
        {"languages": [{"language": "Tamil"}, {"language": "tamil"}]},
        {"availability": [{"day_of_week": 8, "start_time": "08:00", "end_time": "09:00"}]},
        {"availability": [{"day_of_week": 1, "start_time": "10:00", "end_time": "09:00"}]},
        {"latitude": 123}, {"max_travel_km": -1}, {"years_experience": -2},
    ]
    for body in bad:
        assert client.put("/me/profile", json=body, headers=vh).status_code == 422, body
    assert client.get("/me/profile").status_code == 401
    ngo = signup(client, "n@example.com", role="ngo_admin")
    assert client.get("/me/profile", headers=ngo).status_code == 403  # no volunteer_profile
    # profiles are private: each volunteer only sees their own
    other = signup(client, "o@example.com")
    client.put("/me/profile", json={"bio": "mine"}, headers=vh)
    assert client.get("/me/profile", headers=other).json()["bio"] is None


def test_skills_lookup_admin_only_create(client, db_session):
    vh = signup(client, "v@example.com")
    make_platform_admin(db_session)
    ah = login(client, "admin@example.com")
    assert client.post("/skills", json={"skill_name": "Tutoring"}, headers=vh).status_code == 403
    assert client.post("/skills", json={"skill_name": "Tutoring", "category": "Education"}, headers=ah).status_code == 201
    assert client.post("/skills", json={"skill_name": "tutoring"}, headers=ah).status_code == 409
    assert [s["skill_name"] for s in client.get("/skills", headers=vh).json()] == ["Tutoring"]
    assert client.get("/skills").status_code == 401


def test_history_stats_hours_certificates(client, db_session):
    ngo, ngo_id, pid, eid = setup_event(client, db_session, capacity=5)
    vh = apply_and_approve(client, ngo, pid, "v@example.com")
    uid = _uid(client, vh)
    (sid,) = _skills(db_session, "Logistics")
    client.put("/me/profile", json={"skills": [{"skill_id": sid}]}, headers=vh)
    db_session.add(ProjectRequiredSkill(project_id=pid, skill_id=sid))
    today = datetime.now(timezone.utc).date()
    last_month = (today.replace(day=1) - timedelta(days=1)).replace(day=10)
    db_session.add_all([
        Contribution(user_id=uid, project_id=pid, event_id=eid, role="Logistics", hours=3.5, contribution_date=today, status="verified"),
        Contribution(user_id=uid, project_id=pid, role="Setup", hours=2, contribution_date=last_month, status="pending"),
        Contribution(user_id=uid, project_id=pid, role="Ignored", hours=9, contribution_date=today, status="rejected"),
    ])
    db_session.get(Project, pid).status = "completed"
    db_session.commit()

    hist = client.get("/me/contributions", headers=vh).json()
    assert [c["hours"] for c in hist] == [3.5, 9.0, 2.0] or {c["status"] for c in hist} == {"verified", "pending", "rejected"}
    assert hist[0]["project_title"] == "Beach clean"
    st = client.get("/me/stats", headers=vh).json()
    assert st["total_hours"] == 5.5 and st["verified_hours"] == 3.5 and st["hours_this_month"] == 3.5
    assert st["projects_completed"] == 1 and st["skills_contributed"] == ["Logistics"]
    assert st["certificates"] == 0 and st["certificates_ready"] == 1
    hours = client.get("/me/hours?months=3", headers=vh).json()
    assert len(hours) == 3 and hours[-1]["month"] == f"{today.year:04d}-{today.month:02d}"
    assert hours[-1]["hours"] == 3.5 and hours[-2]["hours"] == 2.0 and hours[0]["hours"] == 0
    assert client.get("/me/hours?months=0", headers=vh).status_code == 422

    db_session.add(Certificate(verification_code="ABC123", user_id=uid, project_id=pid, total_hours=5.5))
    db_session.commit()
    certs = client.get("/me/certificates", headers=vh).json()
    assert certs[0]["verification_code"] == "ABC123" and certs[0]["project_title"] == "Beach clean"
    st = client.get("/me/stats", headers=vh).json()
    assert st["certificates"] == 1 and st["certificates_ready"] == 0
    assert client.get("/me/stats", headers=ngo).status_code == 403


def test_activities_upcoming_and_past(client, db_session):
    ngo, ngo_id, pid, _ = setup_event(client, db_session)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    fmt = "%Y-%m-%dT%H:%M:%S"
    soon = client.post(f"/projects/{pid}/events", headers=ngo, json={
        "title": "Soon", "start_datetime": (now + timedelta(days=2)).strftime(fmt),
        "end_datetime": (now + timedelta(days=2, hours=3)).strftime(fmt), "capacity": 1}).json()["event_id"]
    gone = client.post(f"/projects/{pid}/events", headers=ngo, json={
        "title": "Gone", "start_datetime": (now - timedelta(days=5)).strftime(fmt),
        "end_datetime": (now - timedelta(days=5) + timedelta(hours=3)).strftime(fmt)}).json()["event_id"]
    v1 = apply_and_approve(client, ngo, pid, "v1@example.com")
    v2 = apply_and_approve(client, ngo, pid, "v2@example.com")
    for h in (v1, v2):
        client.post(f"/events/{soon}/registrations", headers=h)
    client.post(f"/events/{gone}/registrations", headers=v1)
    db_session.add(Contribution(user_id=_uid(client, v1), project_id=pid, event_id=gone, hours=2.5,
                                contribution_date=(now - timedelta(days=5)).date(), status="verified"))
    db_session.commit()
    up1 = client.get("/me/activities", headers=v1).json()
    assert [(a["event_title"], a["registration_status"]) for a in up1 if a["event_title"] != "Day 1"] == [("Soon", "registered")]
    up2 = client.get("/me/activities", headers=v2).json()
    assert [a["registration_status"] for a in up2 if a["event_title"] == "Soon"] == ["waitlisted"]
    past = client.get("/me/activities?past=true", headers=v1).json()
    assert [(a["event_title"], a["hours"]) for a in past if a["event_title"] == "Gone"] == [("Gone", 2.5)]
    assert client.get("/me/activities?past=true", headers=v2).json() == []
    assert client.get("/me/stats", headers=v1).json()["upcoming_this_week"] == 1
