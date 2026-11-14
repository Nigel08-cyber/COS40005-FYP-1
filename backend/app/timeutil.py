"""The database stores naive UTC. People read local time, so emails and contribution dates convert here."""
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

from app.config import get_settings


def to_local(dt: datetime) -> datetime:
    return dt.replace(tzinfo=timezone.utc).astimezone(ZoneInfo(get_settings().display_timezone))


def fmt_local(dt: datetime) -> str:
    """Sat 1 Nov 2026, 9:00 AM"""
    d = to_local(dt)
    hour = d.strftime("%I").lstrip("0") or "12"
    return f"{d.strftime('%a')} {d.day} {d.strftime('%b %Y')}, {hour}:{d.strftime('%M %p')}"


def local_date(dt: datetime) -> date:
    return to_local(dt).date()
