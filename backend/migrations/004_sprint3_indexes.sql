-- Sprint 3 (notifications, attendance, audit). No new tables: notification, attendance, feedback and audit_log are
-- already in schema.sql. Indexes only, so the scheduler and the bell stay fast. Safe to run more than once.
CREATE INDEX IF NOT EXISTS notification_user_idx ON notification (user_id, channel, notification_id DESC);
CREATE INDEX IF NOT EXISTS notification_related_idx ON notification (user_id, type, related_type, related_id);
CREATE INDEX IF NOT EXISTS notification_due_idx ON notification (status, channel, scheduled_at);
CREATE INDEX IF NOT EXISTS audit_log_action_idx ON audit_log (action, log_id DESC);
CREATE INDEX IF NOT EXISTS audit_log_user_idx ON audit_log (user_id, log_id DESC);
