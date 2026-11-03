-- =====================================================================
-- AI-Enabled Community Volunteer and NGO Management Platform (POC-003)
-- PostgreSQL schema for Neon, from ERD v3 (Volunteer_NGO_Platform_ERD_2.pdf)
-- Run once in the Neon SQL Editor on a fresh database.
-- Timestamps are stored in UTC (TIMESTAMP, as in the ERD).
-- The ERD entity "User" is created as "users" because USER is a reserved word.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------
-- Users, NGOs, skills
-- ---------------------------------------------------------------------
CREATE TABLE users (
    user_id         SERIAL PRIMARY KEY,
    email           VARCHAR(150) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(120) NOT NULL,
    phone           VARCHAR(20),
    system_role     VARCHAR(20)  NOT NULL DEFAULT 'user'
                    CHECK (system_role IN ('platform_admin','user')),
    account_status  VARCHAR(20)  NOT NULL DEFAULT 'active'
                    CHECK (account_status IN ('active','suspended','deactivated')),
    created_at      TIMESTAMP    NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')
);

CREATE TABLE ngo (
    ngo_id          SERIAL PRIMARY KEY,
    registration_no VARCHAR(50)  NOT NULL UNIQUE,
    name            VARCHAR(150) NOT NULL,
    description     TEXT,
    focus_areas     TEXT,
    service_areas   TEXT,
    email           VARCHAR(150),
    phone           VARCHAR(20),
    website         VARCHAR(200),
    address         VARCHAR(255),
    city            VARCHAR(80),
    state           VARCHAR(80),
    status          VARCHAR(20)  NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','active','suspended')),
    created_at      TIMESTAMP    NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')
);

CREATE TABLE ngo_member (
    ngo_id          INT NOT NULL REFERENCES ngo(ngo_id)     ON DELETE CASCADE,
    user_id         INT NOT NULL REFERENCES users(user_id)  ON DELETE CASCADE,
    member_role     VARCHAR(20) NOT NULL
                    CHECK (member_role IN ('ngo_admin','coordinator')),
    status          VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('invited','active','removed')),
    joined_at       TIMESTAMP   NOT NULL DEFAULT (now() AT TIME ZONE 'UTC'),
    PRIMARY KEY (ngo_id, user_id)
);

CREATE TABLE skill (
    skill_id    SERIAL PRIMARY KEY,
    skill_name  VARCHAR(80) NOT NULL UNIQUE,
    category    VARCHAR(60),
    description TEXT
);

-- ---------------------------------------------------------------------
-- Volunteer profile and its detail tables
-- ---------------------------------------------------------------------
CREATE TABLE volunteer_profile (
    user_id            INT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    date_of_birth      DATE,
    bio                TEXT,
    preferred_activity VARCHAR(100),
    experience_summary TEXT,
    years_experience   SMALLINT CHECK (years_experience >= 0),
    city               VARCHAR(80),
    state              VARCHAR(80),
    latitude           NUMERIC(9,6) CHECK (latitude  BETWEEN -90  AND 90),
    longitude          NUMERIC(9,6) CHECK (longitude BETWEEN -180 AND 180),
    max_travel_km      SMALLINT CHECK (max_travel_km >= 0),
    profile_embedding  VECTOR(384),
    embedding_model    VARCHAR(80),
    updated_at         TIMESTAMP NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')
);

CREATE TABLE volunteer_interest (
    user_id           INT NOT NULL REFERENCES volunteer_profile(user_id) ON DELETE CASCADE,
    interest_category VARCHAR(40) NOT NULL
        CHECK (interest_category IN ('food_aid','education','environment','health',
                                     'community','disaster_relief','fundraising')),
    PRIMARY KEY (user_id, interest_category)
);

CREATE TABLE volunteer_language (
    user_id     INT NOT NULL REFERENCES volunteer_profile(user_id) ON DELETE CASCADE,
    language    VARCHAR(40) NOT NULL,
    proficiency VARCHAR(20) NOT NULL
        CHECK (proficiency IN ('basic','conversational','fluent','native')),
    PRIMARY KEY (user_id, language)
);

CREATE TABLE volunteer_qualification (
    qualification_id SERIAL PRIMARY KEY,
    user_id          INT NOT NULL REFERENCES volunteer_profile(user_id) ON DELETE CASCADE,
    title            VARCHAR(150) NOT NULL,
    issuer           VARCHAR(150),
    year_obtained    SMALLINT,
    expiry_date      DATE
);

CREATE TABLE availability (
    availability_id SERIAL PRIMARY KEY,
    user_id         INT NOT NULL REFERENCES volunteer_profile(user_id) ON DELETE CASCADE,
    day_of_week     SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    start_time      TIME NOT NULL,
    end_time        TIME NOT NULL,
    CHECK (end_time > start_time)
);

CREATE TABLE volunteer_skill (
    user_id           INT NOT NULL REFERENCES volunteer_profile(user_id) ON DELETE CASCADE,
    skill_id          INT NOT NULL REFERENCES skill(skill_id),
    proficiency_level SMALLINT NOT NULL CHECK (proficiency_level BETWEEN 1 AND 5),
    years_experience  SMALLINT CHECK (years_experience >= 0),
    PRIMARY KEY (user_id, skill_id)
);

-- ---------------------------------------------------------------------
-- Projects and events
-- ---------------------------------------------------------------------
CREATE TABLE project (
    project_id            SERIAL PRIMARY KEY,
    ngo_id                INT NOT NULL REFERENCES ngo(ngo_id),
    coordinator_id        INT,
    title                 VARCHAR(150) NOT NULL,
    description           TEXT,
    category              VARCHAR(40)
        CHECK (category IN ('food_aid','education','environment','health',
                            'community','disaster_relief','fundraising')),
    location              VARCHAR(255),
    latitude              NUMERIC(9,6) CHECK (latitude  BETWEEN -90  AND 90),
    longitude             NUMERIC(9,6) CHECK (longitude BETWEEN -180 AND 180),
    start_date            DATE,
    end_date              DATE,
    preferred_day         SMALLINT CHECK (preferred_day BETWEEN 1 AND 7),
    preferred_start_time  TIME,
    preferred_end_time    TIME,
    min_experience_years  SMALLINT CHECK (min_experience_years >= 0),
    volunteers_needed     SMALLINT CHECK (volunteers_needed > 0),
    requirement_embedding VECTOR(384),
    embedding_model       VARCHAR(80),
    status                VARCHAR(20) NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','active','completed','cancelled')),
    created_at            TIMESTAMP NOT NULL DEFAULT (now() AT TIME ZONE 'UTC'),
    CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date),
    -- coordinator must be a member of the same NGO (NULL coordinator allowed)
    FOREIGN KEY (ngo_id, coordinator_id) REFERENCES ngo_member (ngo_id, user_id)
);

CREATE TABLE project_required_skill (
    project_id        INT NOT NULL REFERENCES project(project_id) ON DELETE CASCADE,
    skill_id          INT NOT NULL REFERENCES skill(skill_id),
    min_proficiency   SMALLINT NOT NULL DEFAULT 1 CHECK (min_proficiency BETWEEN 1 AND 5),
    volunteers_needed SMALLINT CHECK (volunteers_needed > 0),
    is_mandatory      BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (project_id, skill_id)
);

CREATE TABLE event (
    event_id        SERIAL PRIMARY KEY,
    project_id      INT NOT NULL REFERENCES project(project_id) ON DELETE CASCADE,
    title           VARCHAR(150) NOT NULL,
    description     TEXT,
    venue           VARCHAR(255),
    latitude        NUMERIC(9,6) CHECK (latitude  BETWEEN -90  AND 90),
    longitude       NUMERIC(9,6) CHECK (longitude BETWEEN -180 AND 180),
    start_datetime  TIMESTAMP NOT NULL,
    end_datetime    TIMESTAMP NOT NULL,
    capacity        SMALLINT CHECK (capacity > 0),
    qr_token        VARCHAR(64) UNIQUE,
    qr_expires_at   TIMESTAMP,
    status          VARCHAR(20) NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','active','completed','cancelled')),
    created_at      TIMESTAMP NOT NULL DEFAULT (now() AT TIME ZONE 'UTC'),
    CHECK (end_datetime > start_datetime),
    -- needed so Contribution can reference (event_id, project_id)
    UNIQUE (event_id, project_id)
);

-- ---------------------------------------------------------------------
-- AI matching, applications, evaluation labels
-- ---------------------------------------------------------------------
CREATE TABLE ai_match (
    match_id              SERIAL PRIMARY KEY,
    project_id            INT NOT NULL REFERENCES project(project_id) ON DELETE CASCADE,
    user_id               INT NOT NULL REFERENCES volunteer_profile(user_id) ON DELETE CASCADE,
    method                VARCHAR(10) NOT NULL CHECK (method IN ('keyword','semantic','hybrid')),
    rank_position         SMALLINT CHECK (rank_position >= 1),
    match_score           NUMERIC(5,2) NOT NULL CHECK (match_score BETWEEN 0 AND 100),
    score_breakdown       JSONB,
    distance_km           NUMERIC(7,2) CHECK (distance_km >= 0),
    recommendation_reason TEXT,
    model_version         VARCHAR(40),
    status                VARCHAR(20) NOT NULL DEFAULT 'suggested'
                          CHECK (status IN ('suggested','accepted','dismissed')),
    generated_at          TIMESTAMP NOT NULL DEFAULT (now() AT TIME ZONE 'UTC'),
    UNIQUE (project_id, user_id, method, generated_at)
);

CREATE TABLE project_application (
    application_id   SERIAL PRIMARY KEY,
    project_id       INT NOT NULL REFERENCES project(project_id) ON DELETE CASCADE,
    user_id          INT NOT NULL REFERENCES volunteer_profile(user_id) ON DELETE CASCADE,
    match_id         INT UNIQUE REFERENCES ai_match(match_id) ON DELETE SET NULL,
    decided_by       INT REFERENCES users(user_id),
    source           VARCHAR(20) NOT NULL DEFAULT 'applied'
                     CHECK (source IN ('applied','ai_recommended','coordinator_added')),
    status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','approved','rejected','withdrawn')),
    applied_at       TIMESTAMP NOT NULL DEFAULT (now() AT TIME ZONE 'UTC'),
    decided_at       TIMESTAMP,
    coordinator_note TEXT,
    UNIQUE (project_id, user_id)
);

-- relevance labels for the synthetic evaluation set (not application decisions)
CREATE TABLE match_label (
    project_id INT NOT NULL REFERENCES project(project_id) ON DELETE CASCADE,
    user_id    INT NOT NULL REFERENCES volunteer_profile(user_id) ON DELETE CASCADE,
    relevance  SMALLINT NOT NULL CHECK (relevance IN (0,1)),   -- 0 = not relevant, 1 = relevant
    PRIMARY KEY (project_id, user_id)
);

-- ---------------------------------------------------------------------
-- Registration, attendance, contributions, feedback, certificates
-- ---------------------------------------------------------------------
CREATE TABLE registration (
    registration_id SERIAL PRIMARY KEY,
    event_id        INT NOT NULL REFERENCES event(event_id) ON DELETE CASCADE,
    user_id         INT NOT NULL REFERENCES volunteer_profile(user_id) ON DELETE CASCADE,
    status          VARCHAR(20) NOT NULL DEFAULT 'registered'
                    CHECK (status IN ('registered','cancelled')),
    registered_at   TIMESTAMP NOT NULL DEFAULT (now() AT TIME ZONE 'UTC'),
    cancelled_at    TIMESTAMP,
    UNIQUE (event_id, user_id)
);

CREATE TABLE attendance (
    attendance_id     SERIAL PRIMARY KEY,
    registration_id   INT NOT NULL UNIQUE REFERENCES registration(registration_id) ON DELETE CASCADE,
    check_in_time     TIMESTAMP,
    check_out_time    TIMESTAMP,
    hours_served      NUMERIC(5,2) CHECK (hours_served >= 0),
    attendance_status VARCHAR(20) NOT NULL DEFAULT 'checked_in'
                      CHECK (attendance_status IN ('checked_in','checked_out','absent')),
    CHECK (check_out_time IS NULL OR check_in_time IS NULL OR check_out_time > check_in_time)
);

CREATE TABLE contribution (
    contribution_id   SERIAL PRIMARY KEY,
    user_id           INT NOT NULL REFERENCES volunteer_profile(user_id) ON DELETE CASCADE,
    project_id        INT NOT NULL REFERENCES project(project_id),
    event_id          INT,
    attendance_id     INT UNIQUE REFERENCES attendance(attendance_id) ON DELETE SET NULL,
    role              VARCHAR(80),
    hours             NUMERIC(6,2) NOT NULL CHECK (hours >= 0),
    contribution_date DATE NOT NULL,
    status            VARCHAR(20) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','verified','rejected')),
    -- the event, if any, must belong to the same project
    FOREIGN KEY (event_id, project_id) REFERENCES event (event_id, project_id)
);

CREATE TABLE feedback (
    feedback_id     SERIAL PRIMARY KEY,
    registration_id INT NOT NULL UNIQUE REFERENCES registration(registration_id) ON DELETE CASCADE,
    rating          SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comments        TEXT,
    submitted_at    TIMESTAMP NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')
);

-- the PDF is regenerated on demand from these rows; no file is stored
CREATE TABLE certificate (
    certificate_id    SERIAL PRIMARY KEY,
    verification_code VARCHAR(32) NOT NULL UNIQUE,
    user_id           INT NOT NULL REFERENCES volunteer_profile(user_id) ON DELETE CASCADE,
    project_id        INT NOT NULL REFERENCES project(project_id),
    total_hours       NUMERIC(6,2) NOT NULL CHECK (total_hours >= 0),
    issued_at         TIMESTAMP NOT NULL DEFAULT (now() AT TIME ZONE 'UTC'),
    UNIQUE (user_id, project_id)
);

-- ---------------------------------------------------------------------
-- Notifications and audit log
-- (related_type/related_id and entity_type/entity_id are soft links, not FKs)
-- ---------------------------------------------------------------------
CREATE TABLE notification (
    notification_id SERIAL PRIMARY KEY,
    user_id         INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    type            VARCHAR(20) NOT NULL
                    CHECK (type IN ('confirmation','reminder','update','post_event')),
    channel         VARCHAR(10) NOT NULL CHECK (channel IN ('in_app','email')),
    title           VARCHAR(150) NOT NULL,
    content         TEXT,
    related_type    VARCHAR(30),
    related_id      INT,
    status          VARCHAR(20) NOT NULL DEFAULT 'scheduled'
                    CHECK (status IN ('scheduled','sent','failed')),
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    scheduled_at    TIMESTAMP,
    sent_at         TIMESTAMP
);

CREATE TABLE audit_log (
    log_id      BIGSERIAL PRIMARY KEY,
    user_id     INT REFERENCES users(user_id) ON DELETE SET NULL,
    action      VARCHAR(50) NOT NULL,
    entity_type VARCHAR(40),
    entity_id   INT,
    details     JSONB,
    ip_address  INET,
    created_at  TIMESTAMP NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')
);

-- ---------------------------------------------------------------------
-- Triggers for the rules written on the ERD
-- ---------------------------------------------------------------------

-- 1. A registration is accepted only if the volunteer's application is approved
CREATE FUNCTION trg_registration_requires_approval() RETURNS trigger AS $$
BEGIN
    IF NEW.status = 'registered' AND NOT EXISTS (
        SELECT 1
        FROM event e
        JOIN project_application pa ON pa.project_id = e.project_id
        WHERE e.event_id = NEW.event_id
          AND pa.user_id = NEW.user_id
          AND pa.status = 'approved'
    ) THEN
        RAISE EXCEPTION 'User % has no approved application for the project of event %',
            NEW.user_id, NEW.event_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER registration_requires_approval
    BEFORE INSERT OR UPDATE OF status ON registration
    FOR EACH ROW EXECUTE FUNCTION trg_registration_requires_approval();

-- 2. hours_served = check_out_time - check_in_time (in hours)
CREATE FUNCTION trg_attendance_hours() RETURNS trigger AS $$
BEGIN
    IF NEW.check_in_time IS NOT NULL AND NEW.check_out_time IS NOT NULL THEN
        NEW.hours_served := ROUND(EXTRACT(EPOCH FROM (NEW.check_out_time - NEW.check_in_time)) / 3600.0, 2);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER attendance_hours
    BEFORE INSERT OR UPDATE ON attendance
    FOR EACH ROW EXECUTE FUNCTION trg_attendance_hours();

-- 3. Contribution.hours is copied from Attendance.hours_served when attendance_id is set
CREATE FUNCTION trg_contribution_copy_hours() RETURNS trigger AS $$
BEGIN
    IF NEW.attendance_id IS NOT NULL THEN
        SELECT a.hours_served INTO NEW.hours
        FROM attendance a WHERE a.attendance_id = NEW.attendance_id;
        IF NEW.hours IS NULL THEN
            RAISE EXCEPTION 'Attendance % has no hours_served yet (check out first)', NEW.attendance_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contribution_copy_hours
    BEFORE INSERT OR UPDATE OF attendance_id ON contribution
    FOR EACH ROW EXECUTE FUNCTION trg_contribution_copy_hours();

-- keep linked contributions in step if the attendance hours change later
CREATE FUNCTION trg_attendance_sync_contribution() RETURNS trigger AS $$
BEGIN
    UPDATE contribution SET hours = NEW.hours_served
    WHERE attendance_id = NEW.attendance_id AND NEW.hours_served IS NOT NULL;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER attendance_sync_contribution
    AFTER UPDATE ON attendance
    FOR EACH ROW
    WHEN (OLD.hours_served IS DISTINCT FROM NEW.hours_served)
    EXECUTE FUNCTION trg_attendance_sync_contribution();

-- 4. Sum of per-skill volunteers_needed must not exceed Project.volunteers_needed
--    (the ERD calls this an app rule; enforced here as a safety net)
CREATE FUNCTION trg_required_skill_capacity() RETURNS trigger AS $$
DECLARE
    cap SMALLINT;
BEGIN
    SELECT volunteers_needed INTO cap FROM project WHERE project_id = NEW.project_id;
    IF cap IS NOT NULL THEN
        IF NEW.volunteers_needed IS NOT NULL AND NEW.volunteers_needed > cap THEN
            RAISE EXCEPTION 'Skill requirement (%) exceeds project volunteers_needed (%)',
                NEW.volunteers_needed, cap;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER required_skill_capacity
    BEFORE INSERT OR UPDATE ON project_required_skill
    FOR EACH ROW EXECUTE FUNCTION trg_required_skill_capacity();

-- ---------------------------------------------------------------------
-- Indexes (foreign keys and common lookups)
-- ---------------------------------------------------------------------
CREATE INDEX idx_ngo_member_user        ON ngo_member (user_id);
CREATE INDEX idx_project_ngo            ON project (ngo_id);
CREATE INDEX idx_project_status         ON project (status);
CREATE INDEX idx_event_project          ON event (project_id);
CREATE INDEX idx_event_start            ON event (start_datetime);
CREATE INDEX idx_application_user       ON project_application (user_id);
CREATE INDEX idx_application_status     ON project_application (project_id, status);
CREATE INDEX idx_aimatch_project_method ON ai_match (project_id, method, rank_position);
CREATE INDEX idx_aimatch_user           ON ai_match (user_id);
CREATE INDEX idx_registration_user      ON registration (user_id);
CREATE INDEX idx_contribution_user      ON contribution (user_id);
CREATE INDEX idx_contribution_project   ON contribution (project_id);
CREATE INDEX idx_notification_user      ON notification (user_id, status);
CREATE INDEX idx_notification_due       ON notification (scheduled_at) WHERE status = 'scheduled';
CREATE INDEX idx_audit_created          ON audit_log (created_at);
CREATE INDEX idx_audit_entity           ON audit_log (entity_type, entity_id);
CREATE INDEX idx_volskill_skill         ON volunteer_skill (skill_id);

-- vector similarity search (cosine) for the semantic matcher
CREATE INDEX idx_volunteer_embedding ON volunteer_profile USING hnsw (profile_embedding vector_cosine_ops);
CREATE INDEX idx_project_embedding   ON project           USING hnsw (requirement_embedding vector_cosine_ops);
