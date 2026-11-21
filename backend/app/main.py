import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app import audit, scheduler
from app.config import get_settings
from app.database import Base, engine
from app.models import RefreshToken
from app.routers import (
    applications, attendance, auth, contributions, feedback, ngos, notifications, opportunities, projects, users, volunteers,
)


log = logging.getLogger("app.main")


@asynccontextmanager
async def lifespan(_: FastAPI):
    s = get_settings()
    problems = s.config_problems()
    if s.environment == "production" and problems:
        raise RuntimeError("Unsafe configuration for production: " + "; ".join(problems))
    for p in problems:
        log.warning("config: %s", p)
    if s.email_backend == "log":
        log.warning("config: EMAIL_BACKEND=log, no real email is sent")
    if engine.dialect.name == "sqlite":
        Base.metadata.create_all(engine)  # local dev / tests only
    else:
        # PostgreSQL (Neon): schema.sql already owns every table. Only add the API's own table.
        RefreshToken.__table__.create(engine, checkfirst=True)
    scheduler.start()
    yield
    scheduler.stop()


app = FastAPI(title="Tandem API", lifespan=lifespan)
app.add_middleware(BaseHTTPMiddleware, dispatch=audit.audit_middleware)  # first added = inner; CORS below stays outermost
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origin_list,
    allow_credentials=True,  # needed for the refresh-token cookie
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth.router)
app.include_router(ngos.router)
app.include_router(projects.router)
app.include_router(applications.router)
app.include_router(volunteers.router)
app.include_router(opportunities.router)
app.include_router(users.router)
app.include_router(attendance.router)
app.include_router(contributions.router)
app.include_router(feedback.router)
app.include_router(notifications.router)


@app.get("/health")
def health():
    return {"ok": True}
