from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import Base, engine
from app.routers import applications, auth, projects


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Dev convenience only. On Neon use schema.sql / Alembic instead.
    Base.metadata.create_all(engine)
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
app.include_router(projects.router)
app.include_router(applications.router)


@app.get("/health")
def health():
    return {"ok": True}
