# New fields for the Tandem forms (migration 005)

Run `migrations/005_profile_org_project_fields.sql` on the Neon dev branch, then production (adds columns and two small
tables, safe to run twice). Tested on SQLite and on PostgreSQL with the real schema (98 tests).

## Volunteer profile
- `PATCH /me/profile` now also takes `volunteering_frequency` and `preferred_time_of_day` (free text, max 40; use the
  option labels the form already shows). They come back on `GET /me/profile`.
- Custom skills: send them as `custom_skills: [{skill_name, proficiency_level?, years_experience?}]`. `skills` stays the
  pick-list skills (ids from `GET /skills`). Each list replaces only its own kind, so sending one never wipes the other;
  `[]` clears. Removing a custom skill = send the list without it. The profile returns `skills` and `custom_skills`.
  Custom skills never appear in `GET /skills`. A custom name that already exists in the pick-list just uses that skill.
- Custom languages already worked (`languages` is free text); removing one = send the list without it.
- Photo: `PUT /me/profile/photo` with the **raw file as the body** (PNG, JPEG or WebP, max 1 MB, no multipart),
  `DELETE /me/profile/photo` to remove, `GET /me/profile/photo` returns the image. The access token is a header, so an
  `<img src>` cannot load it: fetch it and show a blob URL. `photo_updated_at` on the profile is null when there is no photo.
  Errors: 400 empty, 413 over 1 MB, 415 not PNG/JPEG/WebP (SVG is refused on purpose).

## Organisation
- `POST /ngos` and `PATCH /ngos/{id}` now take `organisation_type`, `contact_person`, `standing_skills` (comma-separated
  string, same as `focus_areas`) and `typical_volunteers` (integer > 0). All come back on `NgoOut`.
- Logo: `PUT /ngos/{id}/logo` (raw file body, same rules as the photo, NGO admin only), `DELETE /ngos/{id}/logo`,
  `GET /ngos/{id}/logo` is public so `<img src="/api/ngos/ID/logo?v=<logo_updated_at>">` works. `logo_updated_at` is
  null when there is no logo and doubles as the cache-buster.

## Project
- `POST /projects` and `PATCH /projects/{id}` now take `language` (one value, max 80), `additional_requirements` and
  `require_approval` (default true). They come back on `ProjectOut`.
- `require_approval: false` means a volunteer's application is approved the moment they apply (status `approved`,
  `decided_by` empty), so they can register for events straight away. Existing projects keep `true`.
- Repeat weekly: no backend change. An event is the unit, so the frontend creates one event per weekly date, the same
  way it already does for "multiple dates".

## Not done
- "Generate AI recommendations": Part B (next semester). The form switch has no effect yet.
