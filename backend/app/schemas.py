from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models import ApplicationStatus, RegistrationStatus, Role

# Roles a person may pick when signing up themselves. Coordinators and System Admins
# are assigned by an admin, never self-selected.
SelfSignupRole = Role


class RegisterIn(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: Role = Role.volunteer


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: EmailStr
    full_name: str
    role: Role


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut


class RoleChangeIn(BaseModel):
    role: Role


class ProjectIn(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str = ""
    volunteers_needed: int = Field(default=1, ge=1)
    start_at: datetime | None = None
    end_at: datetime | None = None


class ProjectOut(ProjectIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_by: int


class ApplicationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    volunteer_id: int
    status: ApplicationStatus
    decided_by: int | None
    decided_at: datetime | None


class DecisionIn(BaseModel):
    decision: ApplicationStatus  # approved or rejected only (validated in the router)


class RegistrationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    volunteer_id: int
    status: RegistrationStatus


class MyStatusOut(BaseModel):
    """Matches the frontend's ApplicationStatus: pending | approved | registered | waitlisted."""
    project_id: int
    status: str
