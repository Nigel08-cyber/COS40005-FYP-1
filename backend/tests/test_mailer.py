import httpx
import pytest

from app import mailer
from app.config import get_settings


@pytest.fixture()
def brevo(monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "email_backend", "brevo")
    monkeypatch.setattr(s, "brevo_api_key", "test-key")
    monkeypatch.setattr(s, "mail_from_email", "noreply@example.com")
    return s


def fake_post(calls, status=201, exc=None):
    def post(url, json=None, headers=None, timeout=None):
        calls.append((url, json, headers, timeout))
        if exc:
            raise exc
        return httpx.Response(status, json={"message": "x"}, request=httpx.Request("POST", url))
    return post


def test_log_backend_sends_nothing(monkeypatch, caplog):
    monkeypatch.setattr(get_settings(), "email_backend", "log")
    calls = []
    monkeypatch.setattr(mailer.httpx, "post", fake_post(calls))
    assert mailer.send_email("a@b.com", "A", "Hi", "<p>x</p>", "x") is True
    assert calls == []


def test_brevo_request_shape(brevo, monkeypatch):
    calls = []
    monkeypatch.setattr(mailer.httpx, "post", fake_post(calls))
    assert mailer.send_email("a@b.com", "Ann", "Subject", "<p>h</p>", "t") is True
    url, body, headers, timeout = calls[0]
    assert url == "https://api.brevo.com/v3/smtp/email"
    assert headers["api-key"] == "test-key"
    assert body["sender"]["email"] == "noreply@example.com"
    assert body["to"] == [{"email": "a@b.com", "name": "Ann"}]
    assert body["subject"] == "Subject" and body["htmlContent"] == "<p>h</p>" and body["textContent"] == "t"
    assert timeout


def test_brevo_http_error_returns_false(brevo, monkeypatch):
    monkeypatch.setattr(mailer.httpx, "post", fake_post([], status=401))
    assert mailer.send_email("a@b.com", "A", "S", "h", "t") is False


def test_brevo_network_error_returns_false(brevo, monkeypatch):
    monkeypatch.setattr(mailer.httpx, "post", fake_post([], exc=httpx.ConnectTimeout("slow")))
    assert mailer.send_email("a@b.com", "A", "S", "h", "t") is False


def test_brevo_missing_config_returns_false(brevo, monkeypatch):
    monkeypatch.setattr(brevo, "brevo_api_key", "")
    calls = []
    monkeypatch.setattr(mailer.httpx, "post", fake_post(calls))
    assert mailer.send_email("a@b.com", "A", "S", "h", "t") is False
    assert calls == []


def test_password_reset_mail_contains_link(brevo, monkeypatch):
    calls = []
    monkeypatch.setattr(mailer.httpx, "post", fake_post(calls))
    mailer.send_password_reset("a@b.com", "Ann", "http://localhost:3000/reset-password?token=abc")
    body = calls[0][1]
    assert "token=abc" in body["htmlContent"] and "token=abc" in body["textContent"]
