-- Password reset tokens (backlog item 19). Run once in the Neon SQL Editor (dev branch first).
-- Only the SHA-256 of the emailed token is stored; a token is single use and expires.
CREATE TABLE IF NOT EXISTS password_reset_token (
    token_id    SERIAL PRIMARY KEY,
    user_id     INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash  VARCHAR(64) NOT NULL UNIQUE,
    expires_at  TIMESTAMP NOT NULL,
    used_at     TIMESTAMP,
    created_at  TIMESTAMP NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')
);
CREATE INDEX IF NOT EXISTS idx_password_reset_token_user ON password_reset_token (user_id);
