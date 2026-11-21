-- Fields the frontend collects but could not save yet (Tandem forms). SHARED SCHEMA CHANGE: clear with the team,
-- run on the Neon dev branch first, then production. Only adds columns and two small tables; safe to run twice.

-- Volunteer profile: how often / when, plus profile photo bookkeeping (the image itself is in volunteer_photo)
ALTER TABLE volunteer_profile ADD COLUMN IF NOT EXISTS volunteering_frequency VARCHAR(40);
ALTER TABLE volunteer_profile ADD COLUMN IF NOT EXISTS preferred_time_of_day  VARCHAR(40);
ALTER TABLE volunteer_profile ADD COLUMN IF NOT EXISTS photo_updated_at       TIMESTAMP;

-- Skills a volunteer typed in themselves; hidden from the shared pick-list (GET /skills)
ALTER TABLE skill ADD COLUMN IF NOT EXISTS is_custom BOOLEAN NOT NULL DEFAULT FALSE;

-- Organisation profile
ALTER TABLE ngo ADD COLUMN IF NOT EXISTS organisation_type  VARCHAR(80);
ALTER TABLE ngo ADD COLUMN IF NOT EXISTS contact_person     VARCHAR(120);
ALTER TABLE ngo ADD COLUMN IF NOT EXISTS standing_skills    TEXT;          -- comma-separated, like focus_areas
ALTER TABLE ngo ADD COLUMN IF NOT EXISTS typical_volunteers SMALLINT CHECK (typical_volunteers > 0);
ALTER TABLE ngo ADD COLUMN IF NOT EXISTS logo_updated_at    TIMESTAMP;

-- Project form
ALTER TABLE project ADD COLUMN IF NOT EXISTS language                VARCHAR(80);
ALTER TABLE project ADD COLUMN IF NOT EXISTS additional_requirements TEXT;
ALTER TABLE project ADD COLUMN IF NOT EXISTS require_approval        BOOLEAN NOT NULL DEFAULT TRUE;

-- Images live in the database (free, no extra service). Capped at 1 MB each so Neon Free stays well under its limit.
CREATE TABLE IF NOT EXISTS volunteer_photo (
    user_id      INT PRIMARY KEY REFERENCES volunteer_profile(user_id) ON DELETE CASCADE,
    content_type VARCHAR(30) NOT NULL,
    data         BYTEA NOT NULL CHECK (octet_length(data) <= 1048576)
);
CREATE TABLE IF NOT EXISTS ngo_logo (
    ngo_id       INT PRIMARY KEY REFERENCES ngo(ngo_id) ON DELETE CASCADE,
    content_type VARCHAR(30) NOT NULL,
    data         BYTEA NOT NULL CHECK (octet_length(data) <= 1048576)
);
