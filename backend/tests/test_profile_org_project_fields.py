"""Fields the Tandem forms collect (migrations/005): volunteer photo, custom skills, frequency and time of day;
organisation logo, type, contact person, standing skills, typical volunteers; project language, extra requirements
and require_approval."""
from app.models import Skill, VolunteerSkill
from tests.conftest import auth_header, login, make_active_ngo, make_ngo_member, make_platform_admin, signup

PNG = b"\x89PNG\r\n\x1a\n" + b"fake-image-bytes" * 4
JPEG = b"\xff\xd8\xff\xe0" + b"fake-image-bytes" * 4
IMG = {"Content-Type": "application/octet-stream"}  # the real type is read from the bytes, not from the header


def _put(client, url, data, headers):
    return client.put(url, content=data, headers={**headers, **IMG})


# ---------- volunteer profile ----------

def test_frequency_and_time_of_day_roundtrip(client):
    vh = signup(client, "v@example.com")
    p = client.get("/me/profile", headers=vh).json()
    assert p["volunteering_frequency"] is None and p["preferred_time_of_day"] is None and p["photo_updated_at"] is None
    r = client.patch("/me/profile", json={"volunteering_frequency": "Every week", "preferred_time_of_day": "Weekend mornings"}, headers=vh)
    assert r.status_code == 200, r.text
    assert r.json()["volunteering_frequency"] == "Every week" and r.json()["preferred_time_of_day"] == "Weekend mornings"
    # other edits leave them alone
    p = client.patch("/me/profile", json={"bio": "Hi"}, headers=vh).json()
    assert p["volunteering_frequency"] == "Every week"
    assert client.patch("/me/profile", json={"volunteering_frequency": "x" * 41}, headers=vh).status_code == 422


def test_custom_skills_add_keep_remove(client, db_session):
    db_session.add(Skill(skill_name="First aid"))
    db_session.commit()
    first = client.get("/skills", headers=signup(client, "a@example.com")).json()[0]["skill_id"]
    vh = login(client, "a@example.com")

    body = {"skills": [{"skill_id": first, "proficiency_level": 4}],
            "custom_skills": [{"skill_name": "  Sign   language ", "proficiency_level": 2, "years_experience": 1}, {"skill_name": "Welding"}]}
    p = client.patch("/me/profile", json=body, headers=vh).json()
    assert [s["skill_name"] for s in p["skills"]] == ["First aid"]
    assert [s["skill_name"] for s in p["custom_skills"]] == ["Sign language", "Welding"]
    assert p["custom_skills"][0]["proficiency_level"] == 2 and p["custom_skills"][1]["proficiency_level"] == 3
    # custom skills never reach the shared pick-list
    assert [s["skill_name"] for s in client.get("/skills", headers=vh).json()] == ["First aid"]

    # sending only the pick-list skills keeps the custom ones; sending only custom keeps the pick-list ones
    p = client.patch("/me/profile", json={"skills": []}, headers=vh).json()
    assert p["skills"] == [] and len(p["custom_skills"]) == 2
    p = client.patch("/me/profile", json={"skills": [{"skill_id": first}], "custom_skills": [{"skill_name": "Welding"}]}, headers=vh).json()
    assert [s["skill_name"] for s in p["skills"]] == ["First aid"] and [s["skill_name"] for s in p["custom_skills"]] == ["Welding"]
    # a removed custom skill that nobody uses is deleted from the table
    assert db_session.query(Skill).filter(Skill.skill_name == "Sign language").count() == 0
    p = client.patch("/me/profile", json={"custom_skills": []}, headers=vh).json()
    assert p["custom_skills"] == [] and db_session.query(Skill).filter(Skill.is_custom.is_(True)).count() == 0


def test_custom_skill_rules(client, db_session):
    db_session.add(Skill(skill_name="Driving"))
    db_session.commit()
    a, b = signup(client, "a@example.com"), signup(client, "b@example.com")
    client.patch("/me/profile", json={"custom_skills": [{"skill_name": "Welding"}]}, headers=a)
    client.patch("/me/profile", json={"custom_skills": [{"skill_name": "welding"}]}, headers=b)
    assert db_session.query(Skill).filter(Skill.skill_name.ilike("welding")).count() == 1  # shared row
    client.patch("/me/profile", json={"custom_skills": []}, headers=a)
    assert db_session.query(Skill).filter(Skill.skill_name.ilike("welding")).count() == 1  # b still has it
    assert len(client.get("/me/profile", headers=b).json()["custom_skills"]) == 1

    # duplicates are refused; a name already in the pick-list just uses that skill
    assert client.patch("/me/profile", json={"custom_skills": [{"skill_name": "X"}, {"skill_name": "x"}]}, headers=a).status_code == 422
    p = client.patch("/me/profile", json={"custom_skills": [{"skill_name": "driving", "proficiency_level": 5}]}, headers=a).json()
    assert [s["skill_name"] for s in p["skills"]] == ["Driving"] and p["skills"][0]["proficiency_level"] == 5 and p["custom_skills"] == []
    assert db_session.query(Skill).filter(Skill.skill_name.ilike("driving")).count() == 1
    # someone else's custom skill id cannot be sent as a pick-list skill
    custom_id = db_session.query(Skill).filter(Skill.is_custom.is_(True)).one().skill_id
    assert client.patch("/me/profile", json={"skills": [{"skill_id": custom_id}]}, headers=a).status_code == 422


def test_admin_adding_a_typed_in_skill_promotes_it(client, db_session):
    vh = signup(client, "v@example.com")
    client.patch("/me/profile", json={"custom_skills": [{"skill_name": "Welding"}]}, headers=vh)
    make_platform_admin(db_session)
    r = client.post("/skills", json={"skill_name": "welding", "category": "trade"}, headers=login(client, "admin@example.com"))
    assert r.status_code == 201 and r.json()["category"] == "trade"
    assert [s["skill_name"] for s in client.get("/skills", headers=vh).json()] == ["Welding"]
    p = client.get("/me/profile", headers=vh).json()
    assert [s["skill_name"] for s in p["skills"]] == ["Welding"] and p["custom_skills"] == []


def test_profile_photo_upload_replace_remove(client):
    vh = signup(client, "v@example.com")
    assert client.get("/me/profile/photo", headers=vh).status_code == 404
    r = _put(client, "/me/profile/photo", PNG, vh)
    assert r.status_code == 200, r.text
    assert r.json()["photo_updated_at"] is not None
    got = client.get("/me/profile/photo", headers=vh)
    assert got.status_code == 200 and got.content == PNG and got.headers["content-type"] == "image/png"
    assert client.get("/me/profile", headers=vh).json()["photo_updated_at"] is not None
    # replacing with a different type
    assert _put(client, "/me/profile/photo", JPEG, vh).status_code == 200
    got = client.get("/me/profile/photo", headers=vh)
    assert got.content == JPEG and got.headers["content-type"] == "image/jpeg"
    # removing, then the same file can be sent again
    p = client.delete("/me/profile/photo", headers=vh).json()
    assert p["photo_updated_at"] is None and client.get("/me/profile/photo", headers=vh).status_code == 404
    assert _put(client, "/me/profile/photo", JPEG, vh).status_code == 200


def test_photo_rejects_bad_files_and_other_roles(client, db_session):
    vh = signup(client, "v@example.com")
    assert _put(client, "/me/profile/photo", b"", vh).status_code == 400
    assert _put(client, "/me/profile/photo", b"<svg xmlns='http://www.w3.org/2000/svg'><script>1</script></svg>", vh).status_code == 415
    assert _put(client, "/me/profile/photo", b"GIF89a" + b"0" * 20, vh).status_code == 415
    assert _put(client, "/me/profile/photo", PNG + b"0" * 1_000_000, vh).status_code == 413
    assert client.get("/me/profile", headers=vh).json()["photo_updated_at"] is None
    assert client.get("/me/profile/photo").status_code == 401
    _, admin = make_active_ngo(db_session)
    assert _put(client, "/me/profile/photo", PNG, login(client, "ngo@example.com")).status_code == 403  # no volunteer profile


# ---------- organisation ----------

def test_ngo_new_fields_create_and_edit(client, db_session):
    uh = signup(client, "o@example.com", role="ngo_admin")
    body = {"registration_no": "PPM-001-01-00001", "name": "Helping Hands", "organisation_type": "Social enterprise",
            "contact_person": "Mei Ling", "standing_skills": "First Aid, Logistics", "typical_volunteers": 20}
    r = client.post("/ngos", json=body, headers=uh)
    assert r.status_code == 201, r.text
    ngo = r.json()
    assert ngo["organisation_type"] == "Social enterprise" and ngo["contact_person"] == "Mei Ling"
    assert ngo["standing_skills"] == "First Aid, Logistics" and ngo["typical_volunteers"] == 20 and ngo["logo_updated_at"] is None
    r = client.patch(f"/ngos/{ngo['ngo_id']}", json={"contact_person": "Arun", "typical_volunteers": 35}, headers=uh)
    assert r.status_code == 200 and r.json()["contact_person"] == "Arun" and r.json()["typical_volunteers"] == 35
    assert r.json()["organisation_type"] == "Social enterprise"
    assert client.patch(f"/ngos/{ngo['ngo_id']}", json={"typical_volunteers": 0}, headers=uh).status_code == 422


def test_ngo_logo_upload_public_read_remove(client, db_session):
    ngo_id, _ = make_active_ngo(db_session)
    coord = make_ngo_member(db_session, ngo_id, "coord@example.com", "coordinator")
    admin = login(client, "ngo@example.com")
    url = f"/ngos/{ngo_id}/logo"
    assert client.get(url).status_code == 404
    r = _put(client, url, PNG, admin)
    assert r.status_code == 200 and r.json()["logo_updated_at"] is not None
    got = client.get(url)  # no login: it is a public image
    assert got.status_code == 200 and got.content == PNG and got.headers["content-type"] == "image/png"
    assert client.get(f"/ngos/{ngo_id}", headers=admin).json()["logo_updated_at"] is not None
    # only the NGO's admin may change it
    assert _put(client, url, JPEG, login(client, coord.email)).status_code == 403
    assert client.delete(url, headers=login(client, coord.email)).status_code == 403
    assert _put(client, url, b"not an image", admin).status_code == 415
    assert _put(client, url, PNG + b"0" * 1_000_000, admin).status_code == 413
    assert client.delete(url, headers=admin).json()["logo_updated_at"] is None
    assert client.get(url).status_code == 404
    assert _put(client, url, PNG, admin).status_code == 200  # same file again
    assert client.get("/ngos/9999/logo").status_code == 404


# ---------- project ----------

def _event(client, ngo, pid):
    r = client.post(f"/projects/{pid}/events", json={"title": "Day 1", "start_datetime": "2026-12-01T09:00:00",
                                                     "end_datetime": "2026-12-01T12:00:00"}, headers=ngo)
    assert r.status_code == 201, r.text
    return r.json()["event_id"]


def test_project_new_fields_roundtrip(client, db_session):
    ngo_id, _ = make_active_ngo(db_session)
    ngo = login(client, "ngo@example.com")
    r = client.post("/projects", json={"ngo_id": ngo_id, "title": "P"}, headers=ngo)
    assert r.json()["language"] is None and r.json()["additional_requirements"] is None and r.json()["require_approval"] is True
    pid = client.post("/projects", json={"ngo_id": ngo_id, "title": "Q", "language": "Mandarin",
                                         "additional_requirements": "Bring ID", "require_approval": False}, headers=ngo).json()["project_id"]
    p = client.get(f"/projects/{pid}", headers=ngo).json()
    assert (p["language"], p["additional_requirements"], p["require_approval"]) == ("Mandarin", "Bring ID", False)
    p = client.patch(f"/projects/{pid}", json={"language": "English", "require_approval": None}, headers=ngo).json()
    assert p["language"] == "English" and p["require_approval"] is False and p["additional_requirements"] == "Bring ID"
    assert client.patch(f"/projects/{pid}", json={"require_approval": True}, headers=ngo).json()["require_approval"] is True


def test_require_approval_false_approves_applications_automatically(client, db_session):
    ngo_id, _ = make_active_ngo(db_session)
    ngo = login(client, "ngo@example.com")
    open_pid = client.post("/projects", json={"ngo_id": ngo_id, "title": "Open", "status": "active", "require_approval": False}, headers=ngo).json()["project_id"]
    gated_pid = client.post("/projects", json={"ngo_id": ngo_id, "title": "Gated", "status": "active"}, headers=ngo).json()["project_id"]
    open_event = _event(client, ngo, open_pid)
    gated_event = _event(client, ngo, gated_pid)
    vh = signup(client, "v@example.com")

    a = client.post(f"/projects/{open_pid}/applications", headers=vh)
    assert a.status_code == 201 and a.json()["status"] == "approved" and a.json()["decided_by"] is None
    assert client.post(f"/events/{open_event}/registrations", headers=vh).status_code == 201  # no staff step needed
    # withdrawing and applying again is approved again
    assert client.delete(f"/projects/{open_pid}/applications/me", headers=vh).json()["status"] == "withdrawn"
    assert client.post(f"/projects/{open_pid}/applications", headers=vh).json()["status"] == "approved"

    # the other project still needs a decision
    assert client.post(f"/projects/{gated_pid}/applications", headers=vh).json()["status"] == "pending"
    assert client.post(f"/events/{gated_event}/registrations", headers=vh).status_code == 409
