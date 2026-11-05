"""Outgoing email. Only the password reset mail exists so far.

EMAIL_BACKEND=log (the default) writes the message to the server log instead of sending it, so the reset flow can be
built and tested before Brevo is connected. Backlog item 26 adds a "brevo" backend here; the endpoints do not change.
"""
import logging

from app.config import get_settings

log = logging.getLogger("app.mailer")


def send_password_reset(to_email: str, full_name: str, link: str) -> None:
    backend = get_settings().email_backend
    if backend == "log":
        log.warning("EMAIL_BACKEND=log, password reset for %s (%s): %s", to_email, full_name, link)
        return
    raise NotImplementedError(f"email backend {backend!r} is not available yet (Brevo is backlog item 26)")
