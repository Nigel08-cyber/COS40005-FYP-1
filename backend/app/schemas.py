from datetime import date, datetime, time, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

Category = Literal["food_aid", "education", "environment", "health", "community", "disaster_relief", "fundraising"]
ProjectStatus = Literal["draft", "active", "completed", "cancelled"]
NgoStatus = Literal["pending", "active", "suspended"]
SelfSignupRole = Literal["volunteer", "ngo_admin"]
MemberRole = Literal["ngo_admin", "coordinator"]


def _naive_utc(v: datetime | None) -> datetime | None:
    """schema.sql stores naive UTC timestamps."""
    if v is not None and v.tzinfo is not None:
        return v.astimezone(timezone.utc).replace(tzinfo=None)
    return v


class RegisterIn(BaseModel):
    full_name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: SelfSignupRole = "volunteer"


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class PasswordResetRequestIn(BaseModel):
    email: EmailStr


class PasswordResetTokenIn(BaseModel):
    token: str = Field(min_length=1, max_length=200)


class PasswordResetConfirmIn(PasswordResetTokenIn):
    new_password: str = Field(min_length=8, max_length=128)


class UserStatusIn(BaseModel):
    account_status: Literal["active", "suspended"]


class AdminUserOrgOut(BaseModel):
    ngo_id: int
    name: str
    member_role: str  # ngo_admin | coordinator


class AdminUserOut(BaseModel):
    user_id: int
    full_name: str
    email: str
    account_status: str
    system_role: str
    roles: list[str]  # system_admin, ngo_admin, project_coordinator, volunteer
    organisations: list[AdminUserOrgOut]
    created_at: datetime


class MessageOut(BaseModel):
    message: str


class UserOut(BaseModel):
    user_id: int
    id: int  # same as user_id (the frontend's name for it)
    email: str
    full_name: str
    system_role: str
    roles: list[str]  # effective roles: system_admin, ngo_admin, project_coordinator, volunteer
    role: str  # the highest of `roles` (used to pick the landing page); a user with no role yet is an NGO admin
    #            who has not created an organisation


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut


class SystemRoleIn(BaseModel):
    system_role: Literal["platform_admin", "user"]


class NgoIn(BaseModel):
    registration_no: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=150)
    description: str | None = None
    focus_areas: str | None = None
    service_areas: str | None = None
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=20)
    website: str | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None


class NgoOut(NgoIn):
    model_config = ConfigDict(from_attributes=True)
    ngo_id: int
    status: str


class NgoStatusIn(BaseModel):
    status: NgoStatus


class MemberIn(BaseModel):
    email: EmailStr
    member_role: MemberRole = "coordinator"


class MemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    ngo_id: int
    user_id: int
    member_role: str
    status: str


class ProjectIn(BaseModel):
    ngo_id: int
    title: str = Field(min_length=1, max_length=150)
    description: str | None = None
    category: Category | None = None
    location: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    volunteers_needed: int | None = Field(default=None, gt=0)
    min_experience_years: int | None = Field(default=None, ge=0, le=60)
    preferred_day: int | None = Field(default=None, ge=1, le=7)  # 1 = Monday .. 7 = Sunday
    preferred_start_time: time | None = None
    preferred_end_time: time | None = None
    coordinator_id: int | None = None
    status: ProjectStatus = "draft"


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    project_id: int
    ngo_id: int
    coordinator_id: int | None
    title: str
    description: str | None
    category: str | None
    location: str | None
    start_date: date | None
    end_date: date | None
    volunteers_needed: int | None
    min_experience_years: int | None = None
    preferred_day: int | None = None
    preferred_start_time: time | None = None
    preferred_end_time: time | None = None
    status: str
    created_at: datetime | None = None


class ProjectStatusIn(BaseModel):
    status: ProjectStatus


class EventIn(BaseModel):
    title: str = Field(min_length=1, max_length=150)
    description: str | None = None
    venue: str | None = None
    start_datetime: datetime
    end_datetime: datetime
    capacity: int | None = Field(default=None, gt=0)
    status: ProjectStatus = "active"

    _utc = field_validator("start_datetime", "end_datetime")(_naive_utc)


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    event_id: int
    project_id: int
    title: str
    description: str | None
    venue: str | None
    start_datetime: datetime
    end_datetime: datetime
    capacity: int | None
    status: str
    registered_count: int = 0
    waitlist_count: int = 0


class ApplicationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    application_id: int
    project_id: int
    user_id: int
    status: str
    decided_by: int | None
    decided_at: datetime | None
    coordinator_note: str | None


class DecisionIn(BaseModel):
    decision: Literal["approved", "rejected"]
    coordinator_note: str | None = None


class RegistrationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    registration_id: int
    event_id: int
    user_id: int
    status: str


class MyStatusOut(BaseModel):
    """Per project, in the frontend's vocabulary: pending | approved | registered | waitlisted."""
    project_id: int
    status: str


# ---------- NGO / project / event updates ----------

class NgoUpdate(BaseModel):
    """Editable organisation profile. registration_no and status are not editable here."""
    name: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = None
    focus_areas: str | None = None
    service_areas: str | None = None
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=20)
    website: str | None = Field(default=None, max_length=200)
    address: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=80)
    state: str | None = Field(default=None, max_length=80)


class MemberDetailOut(BaseModel):
    ngo_id: int
    user_id: int
    full_name: str
    email: str
    member_role: str
    status: str


class ProjectUpdate(BaseModel):
    """Partial update. Status and coordinator have their own endpoints."""
    title: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = None
    category: Category | None = None
    location: str | None = Field(default=None, max_length=255)
    start_date: date | None = None
    end_date: date | None = None
    volunteers_needed: int | None = Field(default=None, gt=0)
    min_experience_years: int | None = Field(default=None, ge=0, le=60)
    preferred_day: int | None = Field(default=None, ge=1, le=7)  # 1 = Monday .. 7 = Sunday
    preferred_start_time: time | None = None
    preferred_end_time: time | None = None


class CoordinatorIn(BaseModel):
    coordinator_id: int | None = None  # null unlinks the coordinator


class EventUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = None
    venue: str | None = Field(default=None, max_length=255)
    start_datetime: datetime | None = None
    end_datetime: datetime | None = None
    capacity: int | None = Field(default=None, gt=0)
    status: ProjectStatus | None = None

    _utc = field_validator("start_datetime", "end_datetime")(_naive_utc)


class RequiredSkillIn(BaseModel):
    skill_id: int
    min_proficiency: int = Field(default=1, ge=1, le=5)
    volunteers_needed: int | None = Field(default=None, gt=0)
    is_mandatory: bool = False


class RequiredSkillOut(RequiredSkillIn):
    skill_name: str


# ---------- NGO dashboard ----------

class ProjectFillOut(BaseModel):
    project_id: int
    title: str
    status: str
    volunteers_needed: int | None
    approved_volunteers: int
    fill_percent: float | None


class SkillGapOut(BaseModel):
    skill_id: int
    skill_name: str
    needed: int
    covered: int
    gap: int


class NgoDashboardOut(BaseModel):
    ngo_id: int
    volunteers_total: int          # distinct volunteers with an approved application to any project of this NGO
    pending_applications: int
    total_hours: float             # non-rejected contribution hours on this NGO's projects
    hours_this_month: float
    projects_by_status: dict[str, int]
    upcoming_events: int
    requirement_fill: list[ProjectFillOut]
    skills_gap: list[SkillGapOut]


# ---------- Volunteer profile and history ----------

Interest = Category  # same seven categories
LanguageLevel = Literal["basic", "conversational", "fluent", "native"]


class SkillOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    skill_id: int
    skill_name: str
    category: str | None = None


class SkillIn(BaseModel):
    skill_name: str = Field(min_length=1, max_length=80)
    category: str | None = Field(default=None, max_length=60)
    description: str | None = None


class VolunteerSkillIO(BaseModel):
    skill_id: int
    proficiency_level: int = Field(default=3, ge=1, le=5)
    years_experience: int | None = Field(default=None, ge=0)


class VolunteerSkillOut(VolunteerSkillIO):
    skill_name: str


class LanguageIO(BaseModel):
    language: str = Field(min_length=1, max_length=40)
    proficiency: LanguageLevel = "conversational"


class QualificationIn(BaseModel):
    title: str = Field(min_length=1, max_length=150)
    issuer: str | None = Field(default=None, max_length=150)
    year_obtained: int | None = Field(default=None, ge=1900, le=2100)
    expiry_date: date | None = None


class QualificationOut(QualificationIn):
    qualification_id: int


class AvailabilityIO(BaseModel):
    day_of_week: int = Field(ge=1, le=7)  # 1 = Monday .. 7 = Sunday
    start_time: time
    end_time: time

    @field_validator("end_time")
    @classmethod
    def _end_after_start(cls, v, info):
        start = info.data.get("start_time")
        if start is not None and v <= start:
            raise ValueError("end_time must be after start_time")
        return v


class ProfileIn(BaseModel):
    """Fields left out are unchanged. A collection that is sent (even empty) replaces the stored one."""
    full_name: str | None = Field(default=None, min_length=1, max_length=120)
    phone: str | None = Field(default=None, max_length=20)
    date_of_birth: date | None = None
    bio: str | None = None
    preferred_activity: str | None = Field(default=None, max_length=100)
    experience_summary: str | None = None
    years_experience: int | None = Field(default=None, ge=0)
    city: str | None = Field(default=None, max_length=80)
    state: str | None = Field(default=None, max_length=80)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    max_travel_km: int | None = Field(default=None, ge=0)
    skills: list[VolunteerSkillIO] | None = None
    interests: list[Interest] | None = None
    languages: list[LanguageIO] | None = None
    qualifications: list[QualificationIn] | None = None
    availability: list[AvailabilityIO] | None = None


class ProfileOut(BaseModel):
    user_id: int
    full_name: str
    email: str
    phone: str | None
    date_of_birth: date | None
    bio: str | None
    preferred_activity: str | None
    experience_summary: str | None
    years_experience: int | None
    city: str | None
    state: str | None
    latitude: float | None
    longitude: float | None
    max_travel_km: int | None
    skills: list[VolunteerSkillOut]
    interests: list[str]
    languages: list[LanguageIO]
    qualifications: list[QualificationOut]
    availability: list[AvailabilityIO]


class ContributionOut(BaseModel):
    contribution_id: int
    project_id: int
    project_title: str
    event_id: int | None
    role: str | None
    hours: float
    contribution_date: date
    status: str


class VolunteerStatsOut(BaseModel):
    total_hours: float
    verified_hours: float
    hours_this_month: float
    projects_completed: int
    upcoming_this_week: int
    skills_contributed: list[str]
    certificates: int
    certificates_ready: int


class MonthlyHoursOut(BaseModel):
    month: str  # "YYYY-MM"
    hours: float


class CertificateOut(BaseModel):
    certificate_id: int
    verification_code: str
    project_id: int
    project_title: str
    total_hours: float
    issued_at: datetime


class ActivityOut(BaseModel):
    event_id: int
    event_title: str
    project_id: int
    project_title: str
    venue: str | None
    start_datetime: datetime
    end_datetime: datetime
    registration_status: str  # registered | waitlisted
    hours: float | None = None  # past activities: hours contributed


# ---------- Opportunities (volunteer browse view: a project + its next event + the NGO) ----------

class OpportunityOut(BaseModel):
    project_id: int
    event_id: int | None           # the next upcoming active event; registrations go to this event
    title: str
    description: str | None
    category: str | None
    ngo_id: int
    ngo_name: str
    ngo_state: str | None
    location: str | None
    venue: str | None
    latitude: float | None
    longitude: float | None
    start: datetime                # UTC, naive. Next event, else the project's start date
    end: datetime
    volunteers_needed: int         # event capacity if set, else the project's volunteers_needed, else 0
    registered_count: int          # registered volunteers for `event_id`
    waitlist_count: int
    skills: list[str]
    min_experience_years: int | None
    preferred_day: int | None
    preferred_start_time: time | None
    preferred_end_time: time | None
    distance_km: float | None      # from the volunteer's saved coordinates, when both sides have them
