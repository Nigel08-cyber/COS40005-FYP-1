from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import Base, engine
from app.models import RefreshToken
from app.routers import applications, auth, ngos, opportunities, projects, volunteers


@asynccontextmanager
async def lifespan(_: FastAPI):
    if engine.dialect.name == "sqlite":
        Base.metadata.create_all(engine)  # local dev / tests only
    else:
        # PostgreSQL (Neon): schema.sql already owns every table. Only add the API's own table.
        RefreshToken.__table__.create(engine, checkfirst=True)
    yield


app = FastAPI(title="VolunteerHub API", lifespan=lifespan)
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


@app.get("/health")
def health():
    return {"ok": True}
