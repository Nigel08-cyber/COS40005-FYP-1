-- The only table the API adds to schema.sql. Run once in the Neon SQL Editor (dev branch first).
CREATE TABLE IF NOT EXISTS refresh_token (
    token_id    SERIAL PRIMARY KEY,
    user_id     INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash  VARCHAR(64) NOT NULL UNIQUE,
    expires_at  TIMESTAMP NOT NULL,
    revoked_at  TIMESTAMP,
    created_at  TIMESTAMP NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')
);
CREATE INDEX IF NOT EXISTS idx_refresh_token_user ON refresh_token (user_id);
