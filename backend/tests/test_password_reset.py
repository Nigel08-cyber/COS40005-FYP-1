import re
from datetime import timedelta

import pytest

from app import mailer
from app.config import get_settings
from app.models import PasswordResetToken, User, utcnow
from tests.conftest import PASSWORD, login, signup


@pytest.fixture()
def sent(monkeypatch):
    """Captures the reset emails instead of logging them; the cooldown is off unless a test turns it on."""
    mails = []
    monkeypatch.setattr(mailer, "send_password_reset", lambda to, name, link: mails.append((to, link)))
    monkeypatch.setattr(get_settings(), "password_reset_cooldown_seconds", 0)
    return mails


def token_of(mail) -> str:
    return re.search(r"/reset-password\?token=(.+)$", mail[1]).group(1)


def test_unknown_email_gets_the_same_answer_and_no_email(client, sent):
    known = signup(client, "a@example.com") and client.post("/auth/password-reset", json={"email": "a@example.com"})
    unknown = client.post("/auth/password-reset", json={"email": "nobody@example.com"})
    assert known.status_code == unknown.status_code == 202 and known.json() == unknown.json()
    assert [m[0] for m in sent] == ["a@example.com"]


def test_full_reset_flow(client, db_session, sent):
    signup(client, "a@example.com")
    client.post("/auth/password-reset", json={"email": "A@Example.com"})
    token = token_of(sent[0])
    assert sent[0][1].startswith(get_settings().frontend_url)
    assert db_session.query(PasswordResetToken).one().token_hash != token  # only the hash is stored

    assert client.post("/auth/password-reset/check", json={"token": token}).status_code == 204
    r = client.post("/auth/password-reset/confirm", json={"token": token, "new_password": "brand-new-pass"})
    assert r.status_code == 204
    assert client.post("/auth/login", json={"email": "a@example.com", "password": PASSWORD}).status_code == 401
    assert client.post("/auth/login", json={"email": "a@example.com", "password": "brand-new-pass"}).status_code == 200
    assert db_session.query(User).one().password_hash.startswith("$argon2")


def test_link_works_only_once(client, sent):
    signup(client, "a@example.com")
    client.post("/auth/password-reset", json={"email": "a@example.com"})
    token = token_of(sent[0])
    assert client.post("/auth/password-reset/confirm", json={"token": token, "new_password": "brand-new-pass"}).status_code == 204
    assert client.post("/auth/password-reset/confirm", json={"token": token, "new_password": "another-pass1"}).status_code == 400
    assert client.post("/auth/password-reset/check", json={"token": token}).status_code == 400
    assert client.post("/auth/login", json={"email": "a@example.com", "password": "brand-new-pass"}).status_code == 200


def test_expired_and_unknown_tokens_are_rejected(client, db_session, sent):
    signup(client, "a@example.com")
    client.post("/auth/password-reset", json={"email": "a@example.com"})
    token = token_of(sent[0])
    db_session.query(PasswordResetToken).one().expires_at = utcnow() - timedelta(seconds=1)
    db_session.commit()
    for t in (token, "not-a-real-token"):
        assert client.post("/auth/password-reset/check", json={"token": t}).status_code == 400
        assert client.post("/auth/password-reset/confirm", json={"token": t, "new_password": "brand-new-pass"}).status_code == 400
    assert client.post("/auth/login", json={"email": "a@example.com", "password": PASSWORD}).status_code == 200


def test_new_request_replaces_the_old_link(client, sent):
    signup(client, "a@example.com")
    client.post("/auth/password-reset", json={"email": "a@example.com"})
    client.post("/auth/password-reset", json={"email": "a@example.com"})
    first, second = token_of(sent[0]), token_of(sent[1])
    assert client.post("/auth/password-reset/check", json={"token": first}).status_code == 400
    assert client.post("/auth/password-reset/check", json={"token": second}).status_code == 204


def test_cooldown_limits_emails_per_account(client, monkeypatch, sent):
    monkeypatch.setattr(get_settings(), "password_reset_cooldown_seconds", 60)
    signup(client, "a@example.com")
    for _ in range(3):
        assert client.post("/auth/password-reset", json={"email": "a@example.com"}).status_code == 202
    assert len(sent) == 1


def test_reset_signs_out_every_session(client, sent):
    signup(client, "a@example.com")  # the register response set a refresh cookie on the client
    client.post("/auth/password-reset", json={"email": "a@example.com"})
    client.post("/auth/password-reset/confirm", json={"token": token_of(sent[0]), "new_password": "brand-new-pass"})
    assert client.post("/auth/refresh").status_code == 401


def test_suspended_account_gets_no_link(client, db_session, sent):
    signup(client, "a@example.com")
    db_session.query(User).one().account_status = "suspended"
    db_session.commit()
    assert client.post("/auth/password-reset", json={"email": "a@example.com"}).status_code == 202
    assert sent == [] and db_session.query(PasswordResetToken).count() == 0


def test_weak_password_and_bad_input_are_rejected(client, sent):
    signup(client, "a@example.com")
    client.post("/auth/password-reset", json={"email": "a@example.com"})
    token = token_of(sent[0])
    assert client.post("/auth/password-reset/confirm", json={"token": token, "new_password": "short"}).status_code == 422
    assert client.post("/auth/password-reset", json={"email": "not-an-email"}).status_code == 422
    assert client.post("/auth/password-reset/check", json={"token": token}).status_code == 204  # a rejected password does not use the link
