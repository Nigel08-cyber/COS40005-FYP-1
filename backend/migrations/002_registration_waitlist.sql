-- Adds the 'waitlisted' status to registration. SHARED SCHEMA CHANGE: clear with Nigel before running on Neon
-- (try on a Neon dev branch first). The registration_requires_approval trigger only checks status = 'registered',
-- so waitlisted rows pass it; promotion to 'registered' is re-checked by the trigger.
ALTER TABLE registration DROP CONSTRAINT IF EXISTS registration_status_check;
ALTER TABLE registration
    ADD CONSTRAINT registration_status_check CHECK (status IN ('registered','waitlisted','cancelled'));
