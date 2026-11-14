from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./dev.db"
    jwt_secret: str = "dev-only-change-me"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 15
    refresh_token_days: int = 7
    cors_origins: str = "http://localhost:3000"
    cookie_secure: bool = False
    cookie_samesite: str = "lax"  # "none" for cross-site (Vercel -> Funnel), needs cookie_secure=true
    # Password reset (item 19). The emailed link is FRONTEND_URL + /reset-password?token=...
    frontend_url: str = "http://localhost:3000"
    password_reset_minutes: int = 30
    password_reset_cooldown_seconds: int = 60  # at most one reset email per account per minute
    # "log" writes mail to the server log (development); "brevo" sends through the Brevo API (item 26).
    email_backend: str = "log"
    brevo_api_key: str = ""  # secret: environment / .env only, never committed
    mail_from_email: str = ""  # must be a sender verified in Brevo
    mail_from_name: str = "Volunteer Hub"

    # "production" makes startup refuse an unsafe configuration (default JWT secret, insecure cookie)
    environment: str = "development"
    # Sprint 3: notifications, scheduler, QR attendance, audit log
    display_timezone: str = "Asia/Kuala_Lumpur"  # times in emails; the database stores naive UTC
    scheduler_enabled: bool = True  # run ONE backend process (uvicorn without --workers) or reminders are sent twice
    scheduler_interval_seconds: int = 60
    reminder_hours_before: int = 24  # reminder goes out when an event starts within this many hours
    post_event_window_days: int = 3  # a thank-you is still sent up to this long after an event ended
    qr_ttl_minutes: int = 5  # a check-in QR code changes after this long
    qr_grace_seconds: int = 30  # a scan just after expiry still counts (slow phone camera)
    checkin_early_minutes: int = 30  # check-in opens this long before the event starts
    checkout_grace_minutes: int = 180  # check-out closes this long after the event ends
    min_stay_seconds: int = 60  # a second scan sooner than this after check-in is treated as a double scan
    trust_proxy_headers: bool = False  # true behind Tailscale Funnel / a reverse proxy: audit log reads X-Forwarded-For

    def config_problems(self) -> list[str]:
        """Things that must not reach production. ENVIRONMENT=production turns them into a refusal to start."""
        problems = []
        if self.jwt_secret == "dev-only-change-me" or len(self.jwt_secret) < 32:
            problems.append("JWT_SECRET is the development default or shorter than 32 characters")
        if not self.cookie_secure:
            problems.append("COOKIE_SECURE is false (the refresh cookie would travel over plain HTTP)")
        if "localhost" in self.cors_origins and self.environment == "production":
            problems.append("CORS_ORIGINS still lists localhost")
        return problems

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
