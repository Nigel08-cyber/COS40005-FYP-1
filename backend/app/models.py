"""
ORM models mapped onto the EXISTING tables from schema.sql (ERD v3).
Only the columns the API uses are mapped; the rest keep their database defaults.
The one new table is refresh_token (migrations/001_refresh_token.sql).
All timestamps are naive UTC, as in schema.sql.
"""
from datetime import date, datetime, time, timezone

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, SmallInteger, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"
    user_id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(150), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    system_role: Mapped[str] = mapped_column(String(20), default="user")  # platform_admin | user
    account_status: Mapped[str] = mapped_column(String(20), default="active")  # active | suspended | deactivated
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Ngo(Base):
    __tablename__ = "ngo"
    ngo_id: Mapped[int] = mapped_column(primary_key=True)
    registration_no: Mapped[str] = mapped_column(String(50), unique=True)
    name: Mapped[str] = mapped_column(String(150))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    focus_areas: Mapped[str | None] = mapped_column(Text, nullable=True)
    service_areas: Mapped[str | None] = mapped_column(Text, nullable=True)
    email: Mapped[str | None] = mapped_column(String(150), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    website: Mapped[str | None] = mapped_column(String(200), nullable=True)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    city: Mapped[str | None] = mapped_column(String(80), nullable=True)
    state: Mapped[str | None] = mapped_column(String(80), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | active | suspended
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class NgoMember(Base):
    __tablename__ = "ngo_member"
    ngo_id: Mapped[int] = mapped_column(ForeignKey("ngo.ngo_id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id", ondelete="CASCADE"), primary_key=True)
    member_role: Mapped[str] = mapped_column(String(20))  # ngo_admin | coordinator
    status: Mapped[str] = mapped_column(String(20), default="active")  # invited | active | removed
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class VolunteerProfile(Base):
    __tablename__ = "volunteer_profile"
    user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id", ondelete="CASCADE"), primary_key=True)
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    preferred_activity: Mapped[str | None] = mapped_column(String(100), nullable=True)
    experience_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    years_experience: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    city: Mapped[str | None] = mapped_column(String(80), nullable=True)
    state: Mapped[str | None] = mapped_column(String(80), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Numeric(9, 6, asdecimal=False), nullable=True)
    longitude: Mapped[float | None] = mapped_column(Numeric(9, 6, asdecimal=False), nullable=True)
    max_travel_km: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    # profile_embedding / embedding_model exist in the table but are written by the AI matcher (Part B), not mapped here


class Skill(Base):
    __tablename__ = "skill"
    skill_id: Mapped[int] = mapped_column(primary_key=True)
    skill_name: Mapped[str] = mapped_column(String(80), unique=True)
    category: Mapped[str | None] = mapped_column(String(60), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)


class VolunteerSkill(Base):
    __tablename__ = "volunteer_skill"
    user_id: Mapped[int] = mapped_column(ForeignKey("volunteer_profile.user_id", ondelete="CASCADE"), primary_key=True)
    skill_id: Mapped[int] = mapped_column(ForeignKey("skill.skill_id"), primary_key=True)
    proficiency_level: Mapped[int] = mapped_column(SmallInteger)  # 1..5
    years_experience: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)


class VolunteerInterest(Base):
    __tablename__ = "volunteer_interest"
    user_id: Mapped[int] = mapped_column(ForeignKey("volunteer_profile.user_id", ondelete="CASCADE"), primary_key=True)
    interest_category: Mapped[str] = mapped_column(String(40), primary_key=True)


class VolunteerLanguage(Base):
    __tablename__ = "volunteer_language"
    user_id: Mapped[int] = mapped_column(ForeignKey("volunteer_profile.user_id", ondelete="CASCADE"), primary_key=True)
    language: Mapped[str] = mapped_column(String(40), primary_key=True)
    proficiency: Mapped[str] = mapped_column(String(20))  # basic | conversational | fluent | native


class VolunteerQualification(Base):
    __tablename__ = "volunteer_qualification"
    qualification_id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("volunteer_profile.user_id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(150))
    issuer: Mapped[str | None] = mapped_column(String(150), nullable=True)
    year_obtained: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)


class Availability(Base):
    __tablename__ = "availability"
    availability_id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("volunteer_profile.user_id", ondelete="CASCADE"))
    day_of_week: Mapped[int] = mapped_column(SmallInteger)  # 1 = Monday .. 7 = Sunday
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)


class Project(Base):
    __tablename__ = "project"
    project_id: Mapped[int] = mapped_column(primary_key=True)
    ngo_id: Mapped[int] = mapped_column(ForeignKey("ngo.ngo_id"))
    coordinator_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    title: Mapped[str] = mapped_column(String(150))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(String(40), nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    volunteers_needed: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft | active | completed | cancelled
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Event(Base):
    __tablename__ = "event"
    event_id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("project.project_id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(150))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    venue: Mapped[str | None] = mapped_column(String(255), nullable=True)
    start_datetime: Mapped[datetime] = mapped_column(DateTime)
    end_datetime: Mapped[datetime] = mapped_column(DateTime)
    capacity: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft | active | completed | cancelled
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class ProjectRequiredSkill(Base):
    __tablename__ = "project_required_skill"
    project_id: Mapped[int] = mapped_column(ForeignKey("project.project_id", ondelete="CASCADE"), primary_key=True)
    skill_id: Mapped[int] = mapped_column(ForeignKey("skill.skill_id"), primary_key=True)
    min_proficiency: Mapped[int] = mapped_column(SmallInteger, default=1)
    volunteers_needed: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    is_mandatory: Mapped[bool] = mapped_column(Boolean, default=False)


class ProjectApplication(Base):
    __tablename__ = "project_application"
    application_id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("project.project_id", ondelete="CASCADE"))
    user_id: Mapped[int] = mapped_column(ForeignKey("volunteer_profile.user_id", ondelete="CASCADE"))
    decided_by: Mapped[int | None] = mapped_column(ForeignKey("users.user_id"), nullable=True)
    source: Mapped[str] = mapped_column(String(20), default="applied")
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | approved | rejected | withdrawn
    applied_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    coordinator_note: Mapped[str | None] = mapped_column(Text, nullable=True)


class Registration(Base):
    __tablename__ = "registration"
    registration_id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("event.event_id", ondelete="CASCADE"))
    user_id: Mapped[int] = mapped_column(ForeignKey("volunteer_profile.user_id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(String(20), default="registered")  # registered | waitlisted | cancelled
    registered_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Contribution(Base):
    """A volunteer's logged hours (the volunteer history). The attendance_id link is written by the QR flow (Sprint 3)."""
    __tablename__ = "contribution"
    contribution_id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("volunteer_profile.user_id", ondelete="CASCADE"))
    project_id: Mapped[int] = mapped_column(ForeignKey("project.project_id"))
    event_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    role: Mapped[str | None] = mapped_column(String(80), nullable=True)
    hours: Mapped[float] = mapped_column(Numeric(6, 2, asdecimal=False))
    contribution_date: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | verified | rejected


class Certificate(Base):
    __tablename__ = "certificate"
    certificate_id: Mapped[int] = mapped_column(primary_key=True)
    verification_code: Mapped[str] = mapped_column(String(32), unique=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("volunteer_profile.user_id", ondelete="CASCADE"))
    project_id: Mapped[int] = mapped_column(ForeignKey("project.project_id"))
    total_hours: Mapped[float] = mapped_column(Numeric(6, 2, asdecimal=False))
    issued_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class RefreshToken(Base):
    """New table (migrations/001_refresh_token.sql). Only the SHA-256 of the token is stored."""
    __tablename__ = "refresh_token"
    token_id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
