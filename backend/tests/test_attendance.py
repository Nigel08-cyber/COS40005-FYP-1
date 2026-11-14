from tests.conftest import login, make_active_ngo, register_for_event, setup_event, signup, user_id_of

# setup_event creates an event on 2026-11-01 09:00-12:00 UTC (17:00-20:00 in Kuala Lumpur)


def qr(client, ngo, eid):
    r = client.get(f"/events/{eid}/qr", headers=ngo)
    assert r.status_code == 200, r.text
    return r.json()


def test_qr_is_stable_then_rotates_and_is_staff_only(client, db_session, clock):
    ngo, ngo_id, pid, eid = setup_event(client, db_session, capacity=5)
    vh = register_for_event(client, ngo, pid, eid, "v@example.com")
    a = qr(client, ngo, eid)
    assert qr(client, ngo, eid)["token"] == a["token"]  # same code until it expires
    assert a["scan_url"].endswith(f"/check-in?token={a['token']}") and 0 < a["ttl_seconds"] <= 300
    b = client.post(f"/events/{eid}/qr", headers=ngo).json()  # forced rotation
    assert b["token"] != a["token"]
    clock.set("2026-11-01T09:10:00")
    assert client.post("/attendance/scan", json={"token": a["token"]}, headers=vh).status_code == 400  # old code is dead
    assert client.get(f"/events/{eid}/qr", headers=vh).status_code == 403  # volunteers cannot read the code
    make_active_ngo(db_session, "R2", "other@example.com")
    assert client.get(f"/events/{eid}/qr", headers=login(client, "other@example.com")).status_code == 403
    clock.set("2026-11-01T09:20:00")  # b expired (5 min) -> a new code is issued on the next GET
    assert qr(client, ngo, eid)["token"] not in (a["token"], b["token"])


def test_draft_event_has_no_qr(client, db_session, clock):
    ngo, ngo_id, pid, eid = setup_event(client, db_session)
    client.patch(f"/events/{eid}", json={"status": "draft"}, headers=ngo)
    assert client.get(f"/events/{eid}/qr", headers=ngo).status_code == 409


def test_check_in_check_out_computes_hours_and_creates_contribution(client, db_session, clock):
    ngo, ngo_id, pid, eid = setup_event(client, db_session, capacity=5)
    vh = register_for_event(client, ngo, pid, eid, "v@example.com")
    assert client.get(f"/events/{eid}/attendance/me", headers=vh).json()["status"] == "not_arrived"
    clock.set("2026-11-01T09:05:00")
    token = qr(client, ngo, eid)["token"]
    r = client.post("/attendance/scan", json={"token": token}, headers=vh)
    assert r.status_code == 200 and r.json()["action"] == "checked_in" and r.json()["hours_served"] is None
    assert client.get(f"/events/{eid}/attendance/me", headers=vh).json()["status"] == "checked_in"
    clock.set("2026-11-01T09:05:20")  # double scan
    assert client.post("/attendance/scan", json={"token": token}, headers=vh).status_code == 409
    clock.set("2026-11-01T09:08:00")  # code expired but leaving: the coordinator's screen shows a fresh one
    token = qr(client, ngo, eid)["token"]
    clock.set("2026-11-01T11:35:00")
    token = qr(client, ngo, eid)["token"]
    scan_url = client.get(f"/events/{eid}/qr", headers=ngo).json()["scan_url"]
    r = client.post("/attendance/scan", json={"token": scan_url}, headers=vh)  # the whole URL works too
    assert r.status_code == 200, r.text
    assert r.json()["action"] == "checked_out" and r.json()["hours_served"] == 2.5
    assert client.post("/attendance/scan", json={"token": token}, headers=vh).status_code == 409  # already checked out
    c = client.get("/me/contributions", headers=vh).json()
    assert len(c) == 1 and c[0]["hours"] == 2.5 and c[0]["status"] == "verified" and c[0]["attendance_id"]
    assert client.get("/me/stats", headers=vh).json()["total_hours"] == 2.5


def test_scan_rules(client, db_session, clock):
    ngo, ngo_id, pid, eid = setup_event(client, db_session, capacity=1)
    v1 = register_for_event(client, ngo, pid, eid, "v1@example.com")
    from tests.conftest import apply_and_approve
    v2 = apply_and_approve(client, ngo, pid, "v2@example.com")
    assert client.post(f"/events/{eid}/registrations", headers=v2).json()["status"] == "waitlisted"
    v3 = signup(client, "v3@example.com")
    clock.set("2026-11-01T08:45:00")
    token = qr(client, ngo, eid)["token"]
    assert client.post("/attendance/scan", json={"token": token}, headers=v2).status_code == 403  # waitlisted
    assert client.post("/attendance/scan", json={"token": token}, headers=v3).status_code == 403  # never applied
    assert client.post("/attendance/scan", json={"token": token}, headers=ngo).status_code == 403  # not a volunteer
    assert client.post("/attendance/scan", json={"token": "x" * 20}, headers=v1).status_code == 400  # unknown code
    assert client.post("/attendance/scan", json={"token": token}, headers=v1).status_code == 200  # 08:45 = 15 min early, allowed
    assert client.post("/attendance/scan", json={"token": token}, headers={}).status_code == 401


def test_check_in_window(client, db_session, clock):
    ngo, ngo_id, pid, eid = setup_event(client, db_session, capacity=5)
    vh = register_for_event(client, ngo, pid, eid, "v@example.com")
    clock.set("2026-11-01T07:00:00")  # more than 30 minutes early
    t = qr(client, ngo, eid)["token"]
    r = client.post("/attendance/scan", json={"token": t}, headers=vh)
    assert r.status_code == 409 and "opens" in r.json()["detail"]
    clock.set("2026-11-01T12:30:00")  # after the end
    t = qr(client, ngo, eid)["token"]
    assert client.post("/attendance/scan", json={"token": t}, headers=vh).status_code == 409


def test_check_out_closes_after_grace(client, db_session, clock):
    ngo, ngo_id, pid, eid = setup_event(client, db_session, capacity=5)
    vh = register_for_event(client, ngo, pid, eid, "v@example.com")
    clock.set("2026-11-01T09:00:00")
    assert client.post("/attendance/scan", json={"token": qr(client, ngo, eid)["token"]}, headers=vh).status_code == 200
    clock.set("2026-11-01T15:30:00")  # 3h30 after the end, grace is 3h
    r = client.post("/attendance/scan", json={"token": qr(client, ngo, eid)["token"]}, headers=vh)
    assert r.status_code == 409 and "closed" in r.json()["detail"]


def test_coordinator_view_and_corrections(client, db_session, clock):
    ngo, ngo_id, pid, eid = setup_event(client, db_session, capacity=5)
    v1 = register_for_event(client, ngo, pid, eid, "v1@example.com")
    v2 = register_for_event(client, ngo, pid, eid, "v2@example.com")
    u1, u2 = user_id_of(client, v1), user_id_of(client, v2)
    clock.set("2026-11-01T09:00:00")
    client.post("/attendance/scan", json={"token": qr(client, ngo, eid)["token"]}, headers=v1)
    view = client.get(f"/events/{eid}/attendance", headers=ngo).json()
    assert (view["registered"], view["checked_in"], view["not_arrived"]) == (2, 1, 1)
    assert client.get(f"/events/{eid}/attendance", headers=v1).status_code == 403
    body = {"check_in_time": "2026-11-01T09:00:00", "check_out_time": "2026-11-01T11:00:00"}
    assert client.put(f"/events/{eid}/attendance/{u2}", json=body, headers=v1).status_code == 403
    r = client.put(f"/events/{eid}/attendance/{u2}", json=body, headers=ngo)
    assert r.status_code == 200 and r.json()["hours_served"] == 2.0 and r.json()["status"] == "checked_out"
    assert client.get("/me/stats", headers=v2).json()["total_hours"] == 2.0
    body["check_out_time"] = "2026-11-01T12:00:00"  # correcting again updates the same contribution
    client.put(f"/events/{eid}/attendance/{u2}", json=body, headers=ngo)
    assert len(client.get("/me/contributions", headers=v2).json()) == 1
    assert client.get("/me/stats", headers=v2).json()["total_hours"] == 3.0
    bad = {"check_in_time": "2026-11-01T10:00:00", "check_out_time": "2026-11-01T09:00:00"}
    assert client.put(f"/events/{eid}/attendance/{u2}", json=bad, headers=ngo).status_code == 422
    r = client.put(f"/events/{eid}/attendance/{u2}", json={"absent": True}, headers=ngo)
    assert r.json()["status"] == "absent"
    assert client.get("/me/stats", headers=v2).json()["total_hours"] == 0  # hours withdrawn
    assert client.put(f"/events/{eid}/attendance/99999", json=body, headers=ngo).status_code == 404
