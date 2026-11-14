from datetime import datetime

import pytest
from sqlalchemy import select

from app import mailer, notifications as n, scheduler
from app.models import Event, Notification
from tests.conftest import apply_and_approve, register_for_event, setup_event, user_id_of


@pytest.fixture()
def outbox(monkeypatch):
    """Capture emails instead of sending them."""
    sent = []

    def fake(to_email, to_name, subject, html, text):
        sent.append({"to": to_email, "subject": subject, "html": html, "text": text})
        return True
    monkeypatch.setattr(mailer, "send_email", fake)
    return sent


def rows(db, user_id, channel=None):
    q = select(Notification).where(Notification.user_id == user_id)
    if channel:
        q = q.where(Notification.channel == channel)
    return db.scalars(q.order_by(Notification.notification_id)).all()


def event_obj(db, eid):
    return db.get(Event, eid)


def test_templates_use_local_time_and_escape_html():
    class E:  # minimal stand-in for an Event
        event_id, title, venue = 7, "Beach <b>clean</b>", None
        start_datetime = datetime(2026, 11, 1, 9, 0)
    m = n.registration_confirmation("Ann", E, "Project")
    assert "Sun 1 Nov 2026, 5:00 PM" in m.body  # 09:00 UTC is 17:00 in Kuala Lumpur
    assert "to be confirmed" in m.body
    html, text = n.render(m)
    assert "&lt;b&gt;clean&lt;/b&gt;" in html and "<b>" not in html
    assert "View my activities: http" in text
    assert n.post_event_thank_you("Ann", E, "P", 2.5).link.endswith("/feedback/7")
    assert "waitlist" in n.registration_confirmation("Ann", E, "P", waitlisted=True).title.lower()
    assert n.event_update("Ann", E, "P", "Moved.", cancelled=True).title.startswith("Cancelled")


def test_registration_queues_in_app_and_email(client, db_session, outbox):
    ngo, ngo_id, pid, eid = setup_event(client, db_session, capacity=5)
    vh = apply_and_approve(client, ngo, pid, "v@example.com")
    uid = user_id_of(client, vh)
    assert client.post(f"/events/{eid}/registrations", headers=vh).status_code == 201
    assert [r.channel for r in rows(db_session, uid)] == ["in_app", "email"]
    assert rows(db_session, uid, "in_app")[0].status == "sent" and rows(db_session, uid, "email")[0].status == "scheduled"
    assert n.deliver_pending(db_session) == 1
    assert len(outbox) == 1 and outbox[0]["to"] == "v@example.com" and outbox[0]["subject"] == "You are registered: Day 1"
    assert "Open" not in outbox[0]["text"] and "/dashboard" in outbox[0]["text"]
    assert rows(db_session, uid, "email")[0].status == "sent" and rows(db_session, uid, "email")[0].sent_at
    assert n.deliver_pending(db_session) == 0  # nothing is sent twice


def test_failed_send_is_marked_failed_and_others_continue(client, db_session, monkeypatch):
    ngo, ngo_id, pid, eid = setup_event(client, db_session, capacity=5)
    a = register_for_event(client, ngo, pid, eid, "a@example.com")
    register_for_event(client, ngo, pid, eid, "b@example.com")
    monkeypatch.setattr(mailer, "send_email", lambda to, *args: to != "a@example.com")
    assert n.deliver_pending(db_session) == 1
    statuses = {r.user_id: r.status for r in db_session.scalars(select(Notification).where(Notification.channel == "email"))}
    assert sorted(statuses.values()) == ["failed", "sent"]


def test_waitlist_promotion_notifies_the_promoted_volunteer(client, db_session, outbox):
    ngo, ngo_id, pid, eid = setup_event(client, db_session, capacity=1)
    v1 = register_for_event(client, ngo, pid, eid, "v1@example.com")
    v2 = apply_and_approve(client, ngo, pid, "v2@example.com")
    assert client.post(f"/events/{eid}/registrations", headers=v2).json()["status"] == "waitlisted"
    u2 = user_id_of(client, v2)
    assert rows(db_session, u2, "in_app")[0].title.startswith("You are on the waitlist")
    client.delete(f"/events/{eid}/registrations/me", headers=v1)
    titles = [r.title for r in rows(db_session, u2, "in_app")]
    assert titles[-1] == "A place opened up: Day 1"


def test_bell_endpoints(client, db_session, outbox):
    ngo, ngo_id, pid, eid = setup_event(client, db_session, capacity=5)
    vh = register_for_event(client, ngo, pid, eid, "v@example.com")
    other = register_for_event(client, ngo, pid, eid, "o@example.com")
    assert client.get("/me/notifications/unread-count", headers=vh).json() == {"unread": 1}
    items = client.get("/me/notifications", headers=vh).json()
    assert len(items) == 1 and items[0]["type"] == "confirmation" and items[0]["related_type"] == "event" and items[0]["is_read"] is False
    nid = items[0]["notification_id"]
    assert client.post(f"/me/notifications/{nid}/read", headers=other).status_code == 404  # not theirs
    assert client.post(f"/me/notifications/{nid}/read", headers=vh).json()["is_read"] is True
    assert client.get("/me/notifications?unread_only=true", headers=vh).json() == []
    assert client.post("/me/notifications/read-all", headers=other).status_code == 204
    assert client.get("/me/notifications/unread-count", headers=other).json() == {"unread": 0}
    assert client.get("/me/notifications", headers={}).status_code == 401


# ---------- scheduler (26a) ----------

def test_reminders_once_only_for_registered_before_start(client, db_session, outbox):
    ngo, ngo_id, pid, eid = setup_event(client, db_session, capacity=1)
    v1 = register_for_event(client, ngo, pid, eid, "v1@example.com")
    v2 = apply_and_approve(client, ngo, pid, "v2@example.com")
    client.post(f"/events/{eid}/registrations", headers=v2)  # waitlisted, gets no reminder
    assert scheduler.plan_notifications(db_session, datetime(2026, 10, 25, 9, 0))["reminder"] == 0  # a week early
    assert scheduler.plan_notifications(db_session, datetime(2026, 10, 31, 12, 0))["reminder"] == 1  # within 24h
    assert scheduler.plan_notifications(db_session, datetime(2026, 10, 31, 13, 0))["reminder"] == 0  # not twice
    types = [r.type for r in rows(db_session, user_id_of(client, v1), "in_app")]
    assert types == ["confirmation", "reminder"]
    assert [r.type for r in rows(db_session, user_id_of(client, v2), "in_app")] == ["confirmation"]


def test_missed_reminder_is_sent_late_but_not_after_the_event_started(client, db_session, outbox):
    ngo, ngo_id, pid, eid = setup_event(client, db_session, capacity=5)
    register_for_event(client, ngo, pid, eid, "v@example.com")
    assert scheduler.plan_notifications(db_session, datetime(2026, 11, 1, 8, 50))["reminder"] == 1  # backend was off until 10 min before
    ngo2, _, pid2, eid2 = setup_event(client, db_session, capacity=5, ngo_reg="R2", admin_email="n2@example.com")
    register_for_event(client, ngo2, pid2, eid2, "w@example.com")
    assert scheduler.plan_notifications(db_session, datetime(2026, 11, 1, 9, 30))["reminder"] == 0  # started: skipped


def test_cancelled_or_draft_events_get_no_reminder(client, db_session, outbox):
    ngo, ngo_id, pid, eid = setup_event(client, db_session, capacity=5)
    register_for_event(client, ngo, pid, eid, "v@example.com")
    client.patch(f"/events/{eid}", json={"status": "cancelled"}, headers=ngo)
    assert scheduler.plan_notifications(db_session, datetime(2026, 10, 31, 12, 0))["reminder"] == 0


def test_thank_you_only_for_attendees_with_hours_and_feedback_link(client, db_session, outbox):
    ngo, ngo_id, pid, eid = setup_event(client, db_session, capacity=5)
    came = register_for_event(client, ngo, pid, eid, "came@example.com")
    register_for_event(client, ngo, pid, eid, "skipped@example.com")
    client.put(f"/events/{eid}/attendance/{user_id_of(client, came)}", headers=ngo,
               json={"check_in_time": "2026-11-01T09:00:00", "check_out_time": "2026-11-01T11:30:00"})
    assert scheduler.plan_notifications(db_session, datetime(2026, 11, 1, 11, 0))["post_event"] == 0  # not over yet
    assert scheduler.plan_notifications(db_session, datetime(2026, 11, 1, 13, 0))["post_event"] == 1
    assert scheduler.plan_notifications(db_session, datetime(2026, 11, 1, 14, 0))["post_event"] == 0
    assert scheduler.plan_notifications(db_session, datetime(2026, 11, 9, 14, 0))["post_event"] == 0  # past the window
    n.deliver_pending(db_session)
    thanks = [m for m in outbox if m["subject"].startswith("Thank you")]
    assert len(thanks) == 1 and thanks[0]["to"] == "came@example.com"
    assert "2.5 hours" in thanks[0]["text"] and f"/feedback/{eid}" in thanks[0]["text"]


def test_event_change_notifies_registered_and_waitlisted(client, db_session, outbox):
    ngo, ngo_id, pid, eid = setup_event(client, db_session, capacity=1)
    register_for_event(client, ngo, pid, eid, "v1@example.com")
    v2 = apply_and_approve(client, ngo, pid, "v2@example.com")
    client.post(f"/events/{eid}/registrations", headers=v2)
    count = n.notify_event_changed(db_session, event_obj(db_session, eid), "Heavy rain is forecast.", cancelled=True)
    db_session.commit()
    assert count == 2
    n.deliver_pending(db_session)
    assert sum(1 for m in outbox if m["subject"] == "Cancelled: Day 1") == 2


def test_scheduler_disabled_in_tests():
    scheduler.start()
    assert scheduler._scheduler is None
