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
    # "log" writes the link to the server log (development). Brevo (backlog item 26) replaces it.
    email_backend: str = "log"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
