"""Outgoing email (backlog item 26).

EMAIL_BACKEND=log (the default) writes the message to the server log instead of sending it, so everything can be built
and tested without an account. EMAIL_BACKEND=brevo sends through the Brevo transactional email API
(POST https://api.brevo.com/v3/smtp/email) and needs BREVO_API_KEY and MAIL_FROM_EMAIL (a sender verified in Brevo).

send_email() is the one place that talks to a provider. Templates (item 24) call it, so adding a mail type never
touches the HTTP code. Sending never raises: mails go out from background tasks and a provider outage must not turn
into a 500 or reveal whether an account exists, so failures are logged and send_email() returns False.
"""
import logging

import httpx

from app.config import get_settings

log = logging.getLogger("app.mailer")

BREVO_URL = "https://api.brevo.com/v3/smtp/email"
BREVO_TIMEOUT_SECONDS = 10


def send_email(to_email: str, to_name: str, subject: str, html: str, text: str) -> bool:
    """Send one transactional email. Returns True when it was sent (or logged), False when it failed."""
    s = get_settings()
    if s.email_backend == "log":
        log.warning("EMAIL_BACKEND=log, to %s (%s), subject %r:\n%s", to_email, to_name, subject, text)
        return True
    if s.email_backend != "brevo":
        log.error("Unknown EMAIL_BACKEND %r, mail to %s not sent", s.email_backend, to_email)
        return False
    if not s.brevo_api_key or not s.mail_from_email:
        log.error("EMAIL_BACKEND=brevo needs BREVO_API_KEY and MAIL_FROM_EMAIL, mail to %s not sent", to_email)
        return False
    payload = {
        "sender": {"name": s.mail_from_name, "email": s.mail_from_email},
        "to": [{"email": to_email, "name": to_name or to_email}],
        "subject": subject,
        "htmlContent": html,
        "textContent": text,
    }
    try:
        r = httpx.post(
            BREVO_URL,
            json=payload,
            headers={"api-key": s.brevo_api_key, "accept": "application/json"},
            timeout=BREVO_TIMEOUT_SECONDS,
        )
        r.raise_for_status()
    except httpx.HTTPStatusError as e:
        # Brevo's error body explains the problem (unverified sender, bad key, daily limit). It never contains the key.
        log.error("Brevo rejected mail to %s: %s %s", to_email, e.response.status_code, e.response.text[:300])
        return False
    except httpx.HTTPError as e:
        log.error("Brevo request failed for mail to %s: %s", to_email, e.__class__.__name__)
        return False
    return True


def send_password_reset(to_email: str, full_name: str, link: str) -> None:
    s = get_settings()
    subject = "Reset your password"
    greeting = f"Hi {full_name}," if full_name else "Hi,"
    text = (
        f"{greeting}\n\nWe received a request to reset your password. Open this link to choose a new one "
        f"(it works once and expires in {s.password_reset_minutes} minutes):\n\n{link}\n\n"
        "If you did not ask for this, you can ignore this email. Your password stays the same."
    )
    html = (
        f"<p>{greeting}</p>"
        "<p>We received a request to reset your password. Click the button to choose a new one. "
        f"The link works once and expires in {s.password_reset_minutes} minutes.</p>"
        f'<p><a href="{link}" style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:6px;'
        'text-decoration:none">Reset password</a></p>'
        f'<p>Or paste this link into your browser:<br>{link}</p>'
        "<p>If you did not ask for this, you can ignore this email. Your password stays the same.</p>"
    )
    send_email(to_email, full_name, subject, html, text)
