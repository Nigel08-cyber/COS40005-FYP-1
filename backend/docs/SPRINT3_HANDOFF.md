# Sprint 3 handoff messages (copy into WhatsApp)

## For Trishanth (frontend)

Hi Trish, the Sprint 3 backend for your screens is done and pushed on dev-testing-backup. Full endpoint list: backend/docs/API.md (or /docs on the running backend). What I need from the frontend:

1. Bell icon (item 24): GET /me/notifications, GET /me/notifications/unread-count, POST /me/notifications/{id}/read, POST /me/notifications/read-all. Each item has title, content, is_read, created_at, related_type="event", related_id.
2. Coordinator "show QR" screen (25): GET /events/{id}/qr returns token, scan_url, expires_at, ttl_seconds. Encode scan_url in the QR image (qrcode.react) and re-fetch every 30 s (it hands out a new code when the old one expires). POST /events/{id}/qr rotates it now.
3. Volunteer scan page (25a): scan with @yudiel/react-qr-scanner, then POST /attendance/scan {"token": <decoded text>} (the whole URL or just the token both work). Reply has action "checked_in" or "checked_out", times and hours_served. GET /events/{id}/attendance/me tells the page whether to say "scan to check in" or "scan to check out". Errors come back as {"detail": "..."} with a readable message, show it. Please also make a /check-in?token=... page that does the same scan for people who open the link with their phone camera.
4. Coordinator attendance view (25a): GET /events/{id}/attendance gives counts + one row per registered volunteer (not_arrived / checked_in / checked_out / absent). PUT /events/{id}/attendance/{user_id} with {check_in_time, check_out_time} or {"absent": true} corrects a row.
5. Contribution dashboard (27): GET /me/contributions now includes skills and attendance_id; /me/stats and /me/hours update automatically after check-out. Coordinator list: GET /projects/{id}/contributions, PATCH /contributions/{id} {"status": "verified"|"rejected"}.
6. Feedback (27a): the thank-you email links to /feedback/{eventId}, so please make that page. POST /events/{id}/feedback {rating 1-5, comments}; GET /events/{id}/feedback/me (404 = not yet); GET /me/feedback/pending for a "rate your events" list. Coordinator view: GET /events/{id}/feedback (average, counts per star, rows).

Times are UTC in the API. Certificates (27b) are not in the backend yet.

## For Nigel

Hi Nigel, Sprint 3 backend is on dev-testing-backup. Three things for you:

1. Item 25 (QR): 25a needs the token logic to be testable, so I built it in backend/app/routers/attendance.py (rotating token, expiry, validation, 24 tests). Please review it and tell me if you want anything changed rather than writing it again.
2. Item 26a (last-minute update): the scheduler, reminder and thank-you are done (backend/app/scheduler.py). Please hook the last-minute update into update_event in app/routers/projects.py. After the setattr loop, before db.commit():

       from app import notifications
       if event.status == "cancelled" and old_status != "cancelled":
           notifications.notify_event_changed(db, event, "The organiser cancelled this event.", cancelled=True)
       elif (event.start_datetime, event.end_datetime, event.venue) != old_times:
           notifications.notify_event_changed(db, event, "The time or place changed.")

   (capture old_status = event.status and old_times = (event.start_datetime, event.end_datetime, event.venue) before the loop; add a test next to tests/test_notifications.py).
3. Item 27c: I did the audit log (every change is logged, GET /audit-logs for the admin) and the production config check. Left for you: rate limiting with slowapi on POST /auth/login and POST /auth/password-reset (e.g. 10 per minute per IP), and a quick review of token handling.

Neon needs migration 004 (indexes only, safe to run twice). Run one backend process only, because the scheduler runs inside it.
