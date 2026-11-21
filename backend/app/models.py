"""
ORM models mapped onto the EXISTING tables from schema.sql (ERD v3).
Only the columns the API uses are mapped; the rest keep their database defaults.
The one new table is refresh_token (migrations/001_refresh_token.sql).
All timestamps are naive UTC, as in schema.sql.
"""
from datetime import date, datetime, time, timezone

from sqlalchemy import (
    JSON, BigInteger, Boolean, Date, DateTime, ForeignKey, Integer, LargeBinary, Numeric, SmallInteger, String, Text,
    Time,
)
from sqlalchemy.dialects.postgresql import INET, JSONB
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
    organisation_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    contact_person: Mapped[str | None] = mapped_column(String(120), nullable=True)
    standing_skills: Mapped[str | None] = mapped_column(Text, nullable=True)  # comma-separated, like focus_areas
    typical_volunteers: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    logo_updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)  # None = no logo
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | active | suspended
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class NgoLogo(Base):
    """The organisation logo image (migrations/005). One row per NGO; metadata is on ngo.logo_updated_at."""
    __tablename__ = "ngo_logo"
    ngo_id: Mapped[int] = mapped_column(ForeignKey("ngo.ngo_id", ondelete="CASCADE"), primary_key=True)
    content_type: Mapped[str] = mapped_column(String(30))
    data: Mapped[bytes] = mapped_column(LargeBinary)


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
    volunteering_frequency: Mapped[str | None] = mapped_column(String(40), nullable=True)
    preferred_time_of_day: Mapped[str | None] = mapped_column(String(40), nullable=True)
    photo_updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)  # None = no photo
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    # profile_embedding / embedding_model exist in the table but are written by the AI matcher (Part B), not mapped here


class VolunteerPhoto(Base):
    """The volunteer's profile photo (migrations/005). Metadata is on volunteer_profile.photo_updated_at."""
    __tablename__ = "volunteer_photo"
    user_id: Mapped[int] = mapped_column(ForeignKey("volunteer_profile.user_id", ondelete="CASCADE"), primary_key=True)
    content_type: Mapped[str] = mapped_column(String(30))
    data: Mapped[bytes] = mapped_column(LargeBinary)


class Skill(Base):
    __tablename__ = "skill"
    skill_id: Mapped[int] = mapped_column(primary_key=True)
    skill_name: Mapped[str] = mapped_column(String(80), unique=True)
    category: Mapped[str | None] = mapped_column(String(60), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_custom: Mapped[bool] = mapped_column(Boolean, default=False)  # typed in by a volunteer; not in the shared pick-list


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
    latitude: Mapped[float | None] = mapped_column(Numeric(9, 6, asdecimal=False), nullable=True)
    longitude: Mapped[float | None] = mapped_column(Numeric(9, 6, asdecimal=False), nullable=True)
    preferred_day: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)  # 1 = Monday .. 7 = Sunday
    preferred_start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    preferred_end_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    min_experience_years: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    volunteers_needed: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    language: Mapped[str | None] = mapped_column(String(80), nullable=True)
    additional_requirements: Mapped[str | None] = mapped_column(Text, nullable=True)
    require_approval: Mapped[bool] = mapped_column(Boolean, default=True)  # False: applications are approved automatically
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
    qr_token: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)  # rotating check-in token
    qr_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
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


class Attendance(Base):
    """One row per registration, written by the QR scan flow (check-in, then check-out). On PostgreSQL a trigger also
    computes hours_served from the two times; the API sets it too so SQLite behaves the same."""
    __tablename__ = "attendance"
    attendance_id: Mapped[int] = mapped_column(primary_key=True)
    registration_id: Mapped[int] = mapped_column(ForeignKey("registration.registration_id", ondelete="CASCADE"), unique=True)
    check_in_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    check_out_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    hours_served: Mapped[float | None] = mapped_column(Numeric(5, 2, asdecimal=False), nullable=True)
    attendance_status: Mapped[str] = mapped_column(String(20), default="checked_in")  # checked_in | checked_out | absent


class Feedback(Base):
    __tablename__ = "feedback"
    feedback_id: Mapped[int] = mapped_column(primary_key=True)
    registration_id: Mapped[int] = mapped_column(ForeignKey("registration.registration_id", ondelete="CASCADE"), unique=True)
    rating: Mapped[int] = mapped_column(SmallInteger)  # 1..5
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Notification(Base):
    """In-app notifications (channel in_app, shown in the bell) and queued emails (channel email).
    related_type/related_id are soft links (for example 'event' and the event id), not foreign keys."""
    __tablename__ = "notification"
    notification_id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id", ondelete="CASCADE"))
    type: Mapped[str] = mapped_column(String(20))  # confirmation | reminder | update | post_event
    channel: Mapped[str] = mapped_column(String(10))  # in_app | email
    title: Mapped[str] = mapped_column(String(150))
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    related_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    related_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="scheduled")  # scheduled | sent | failed
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_log"
    log_id: Mapped[int] = mapped_column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True)
    action: Mapped[str] = mapped_column(String(50))
    entity_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    entity_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    details: Mapped[dict | None] = mapped_column(JSON().with_variant(JSONB, "postgresql"), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(INET().with_variant(String(45), "sqlite"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Contribution(Base):
    """A volunteer's logged hours (the volunteer history). Check-out in the QR flow creates one linked by attendance_id."""
    __tablename__ = "contribution"
    contribution_id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("volunteer_profile.user_id", ondelete="CASCADE"))
    project_id: Mapped[int] = mapped_column(ForeignKey("project.project_id"))
    event_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    attendance_id: Mapped[int | None] = mapped_column(ForeignKey("attendance.attendance_id", ondelete="SET NULL"), unique=True, nullable=True)
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


class PasswordResetToken(Base):
    """New table (migrations/003_password_reset.sql). Only the SHA-256 of the emailed token is stored."""
    __tablename__ = "password_reset_token"
    token_id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
