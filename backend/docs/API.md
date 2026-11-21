# Tandem API

Generated from the code by `python -m scripts.export_api_docs`. Interactive version: `/docs` (Swagger UI) on the running backend.

**Authentication.** `POST /auth/login` returns an access token (15 minutes). Send it as `Authorization: Bearer <token>`. A rotating httpOnly refresh cookie renews it via `POST /auth/refresh`. Roles: `system_admin`, `ngo_admin`, `project_coordinator`, `volunteer`; NGO endpoints are scoped to the caller's own organisation. Errors are `{"detail": "..."}` with 400/401/403/404/409/422.

**Times** are UTC (ISO 8601). Emails show Asia/Kuala_Lumpur.

## applications

| Method | Path | Request body | Success | Query | Notes |
|---|---|---|---|---|---|
| `GET` | `/projects/{project_id}/applications` | - | 200 list[ApplicationDetailOut] | - | Applicants of one project with their name, email and skills (NGO staff of that project only). |
| `POST` | `/projects/{project_id}/applications` | - | 201 ApplicationOut | - | Apply |
| `DELETE` | `/projects/{project_id}/applications/me` | - | 200 ApplicationOut | - | Withdraw |
| `PATCH` | `/applications/{application_id}` | DecisionIn | 200 ApplicationOut | - | Decide |
| `POST` | `/events/{event_id}/registrations` | - | 201 RegistrationOut | - | Register |
| `DELETE` | `/events/{event_id}/registrations/me` | - | 200 RegistrationOut | - | Cancels a registration or leaves the waitlist. Freeing a spot promotes the next waitlisted volunteer. |
| `GET` | `/me/registrations` | - | 200 list[RegistrationOut] | - | Registered and waitlisted events (check the status field). |
| `GET` | `/me/applications` | - | 200 list[MyStatusOut] | - | Status per project: pending / approved, registered if registered for any of its events, else waitlisted if only waitlisted. |

## attendance

| Method | Path | Request body | Success | Query | Notes |
|---|---|---|---|---|---|
| `GET` | `/events/{event_id}/qr` | - | 200 QrOut | - | The code to show on the coordinator's screen. Poll this: it hands out a fresh code once the old one expired. |
| `POST` | `/events/{event_id}/qr` | - | 200 QrOut | - | Replace the code now (for example if a photo of the screen was shared). The old code stops working. |
| `POST` | `/attendance/scan` | ScanIn | 200 AttendanceOut | - | Scan |
| `GET` | `/events/{event_id}/attendance/me` | - | 200 MyAttendanceOut | - | Where the volunteer stands for this event, so the scan page can say 'scan to check in' or 'scan to check out'. |
| `GET` | `/events/{event_id}/attendance` | - | 200 EventAttendanceOut | - | Event Attendance |
| `PUT` | `/events/{event_id}/attendance/{user_id}` | ManualAttendanceIn | 200 AttendanceRowOut | - | Coordinator correction for one registered volunteer: set the check-in/out times, or mark them absent. |

## auth

| Method | Path | Request body | Success | Query | Notes |
|---|---|---|---|---|---|
| `POST` | `/auth/register` | RegisterIn | 201 TokenOut | - | Volunteers get a users row plus an empty volunteer_profile. NGO admins get a users row and then create their organisation with POST /ngos (which makes them its ngo_admin). Platform admins and coordinators are never self-registered. |
| `POST` | `/auth/login` | LoginIn | 200 TokenOut | - | Login |
| `POST` | `/auth/refresh` | - | 200 TokenOut | - | Rotate the refresh token: the old one is revoked and a new pair is issued. |
| `POST` | `/auth/logout` | - | 204 | - | Logout |
| `POST` | `/auth/password-reset` | PasswordResetRequestIn | 202 MessageOut | - | Always answers the same way, so it cannot be used to find out which emails have an account. If the account exists and is active, a single-use link is emailed (at most one per cooldown period). |
| `POST` | `/auth/password-reset/check` | PasswordResetTokenIn | 204 | - | Lets the /reset-password page show the "expired link" screen before the user types a new password. |
| `POST` | `/auth/password-reset/confirm` | PasswordResetConfirmIn | 204 | - | Sets the new password, uses up the link and signs the account out everywhere (all refresh tokens revoked). |
| `GET` | `/auth/me` | - | 200 UserOut | - | Me |
| `PATCH` | `/auth/users/{user_id}/system-role` | SystemRoleIn | 200 UserOut | - | System Admin only: promote or demote a platform admin. (Coordinators are added per NGO, see /ngos/{id}/members.) |

## contributions

| Method | Path | Request body | Success | Query | Notes |
|---|---|---|---|---|---|
| `GET` | `/projects/{project_id}/contributions` | - | 200 list[ContributionStaffOut] | status_filter? | Project Contributions |
| `PATCH` | `/contributions/{contribution_id}` | ContributionStatusIn | 200 ContributionStaffOut | - | Verify or reject logged hours. Rejected hours no longer count in totals, the dashboard or certificates. |

## feedback

| Method | Path | Request body | Success | Query | Notes |
|---|---|---|---|---|---|
| `GET` | `/events/{event_id}/feedback` | - | 200 EventFeedbackOut | - | Coordinator / NGO admin view: every review for the event with the average rating. |
| `POST` | `/events/{event_id}/feedback` | FeedbackIn | 201 FeedbackOut | - | Submit Feedback |
| `GET` | `/events/{event_id}/feedback/me` | - | 200 FeedbackOut | - | My Feedback |
| `GET` | `/me/feedback/pending` | - | 200 list[PendingFeedbackOut] | - | Events the volunteer checked in to and that have ended, without feedback yet (for a 'rate your events' prompt). |

## ngos

| Method | Path | Request body | Success | Query | Notes |
|---|---|---|---|---|---|
| `GET` | `/ngos` | - | 200 list[NgoOut] | mine? | Active organisations for everyone. mine=true lists the organisations the user belongs to (any status); a platform admin sees every organisation. |
| `POST` | `/ngos` | NgoIn | 201 NgoOut | - | Anyone signed in can register an organisation. It starts as 'pending' until a platform admin activates it, and the creator becomes its ngo_admin. |
| `GET` | `/ngos/{ngo_id}` | - | 200 NgoOut | - | Get Ngo |
| `PATCH` | `/ngos/{ngo_id}` | NgoUpdate | 200 NgoOut | - | Edit the organisation profile (ngo_admin of this NGO, or platform admin). |
| `GET` | `/ngos/{ngo_id}/logo` | - | 200 | - | The organisation logo. Public on purpose (it is brand material), so a plain <img src> works. |
| `PUT` | `/ngos/{ngo_id}/logo` | - | 200 NgoOut | - | Send the raw image as the body (PNG, JPEG or WebP, at most 1 MB). ngo_admin of this NGO or platform admin. |
| `DELETE` | `/ngos/{ngo_id}/logo` | - | 200 NgoOut | - | Delete Logo |
| `PATCH` | `/ngos/{ngo_id}/status` | NgoStatusIn | 200 NgoOut | - | System Admin only: approve (active) or suspend an organisation. |
| `GET` | `/ngos/{ngo_id}/members` | - | 200 list[MemberDetailOut] | - | List Members |
| `POST` | `/ngos/{ngo_id}/members` | MemberIn | 201 MemberOut | - | The NGO's admin links an existing user as coordinator (or another admin). |
| `DELETE` | `/ngos/{ngo_id}/members/{user_id}` | - | 200 MemberOut | - | Soft-remove a member (status = removed). Projects they coordinated lose their coordinator. |
| `GET` | `/ngos/{ngo_id}/dashboard` | - | 200 NgoDashboardOut | - | NGO dashboard data: volunteer and project stats, requirement fill per active project, skills gap. |

## notifications

| Method | Path | Request body | Success | Query | Notes |
|---|---|---|---|---|---|
| `GET` | `/me/notifications` | - | 200 list[NotificationOut] | unread_only?, limit?, offset? | My Notifications |
| `GET` | `/me/notifications/unread-count` | - | 200 UnreadCountOut | - | Unread Count |
| `POST` | `/me/notifications/read-all` | - | 204 | - | Read All |
| `POST` | `/me/notifications/{notification_id}/read` | - | 200 NotificationOut | - | Mark Read |
| `GET` | `/audit-logs` | - | 200 list[AuditLogOut] | action?, user_id?, limit?, offset? | System admin only. Newest first. `action` matches the start of the action, e.g. 'POST /auth/login'. |

## opportunities

| Method | Path | Request body | Success | Query | Notes |
|---|---|---|---|---|---|
| `GET` | `/opportunities` | - | 200 list[OpportunityOut] | - | List Opportunities |
| `GET` | `/opportunities/{project_id}` | - | 200 OpportunityOut | - | Get Opportunity |

## other

| Method | Path | Request body | Success | Query | Notes |
|---|---|---|---|---|---|
| `GET` | `/health` | - | 200 | - | Health |

## projects

| Method | Path | Request body | Success | Query | Notes |
|---|---|---|---|---|---|
| `GET` | `/projects` | - | 200 list[ProjectOut] | - | Active projects for everyone, plus every project of the NGOs the user belongs to. |
| `POST` | `/projects` | ProjectIn | 201 ProjectOut | - | Create Project |
| `GET` | `/projects/{project_id}` | - | 200 ProjectOut | - | Get Project |
| `PATCH` | `/projects/{project_id}` | ProjectUpdate | 200 ProjectOut | - | Update Project |
| `PATCH` | `/projects/{project_id}/status` | ProjectStatusIn | 200 ProjectOut | - | Set Project Status |
| `GET` | `/projects/{project_id}/events` | - | 200 list[EventOut] | - | List Events |
| `POST` | `/projects/{project_id}/events` | EventIn | 201 EventOut | - | Create Event |
| `PUT` | `/projects/{project_id}/coordinator` | CoordinatorIn | 200 ProjectOut | - | Link (or unlink with null) the project coordinator. NGO admin only; the coordinator must be an active member of the same NGO. |
| `GET` | `/me/coordinated-projects` | - | 200 list[ProjectOut] | - | Projects the signed-in user coordinates (for the coordinator's dashboard). |
| `GET` | `/projects/{project_id}/skills` | - | 200 list[RequiredSkillOut] | - | Get Required Skills |
| `PUT` | `/projects/{project_id}/skills` | list[RequiredSkillIn] | 200 list[RequiredSkillOut] | - | Replace the project's required skills (staff of the project's NGO). |
| `GET` | `/events/{event_id}` | - | 200 EventOut | - | Get Event |
| `PATCH` | `/events/{event_id}` | EventUpdate | 200 EventOut | - | Edit an event or change its status. More capacity (or reopening) promotes people from the waitlist. |

## users

| Method | Path | Request body | Success | Query | Notes |
|---|---|---|---|---|---|
| `GET` | `/users` | - | 200 list[AdminUserOut] | q?, role?, account_status?, limit?, offset? | System Admin only. Every account with its effective roles and organisations, sorted by name. |
| `PATCH` | `/users/{user_id}/status` | UserStatusIn | 200 AdminUserOut | - | System Admin only: suspend or reactivate an account. Suspending also signs the user out everywhere. |

## volunteers

| Method | Path | Request body | Success | Query | Notes |
|---|---|---|---|---|---|
| `GET` | `/skills` | - | 200 list[SkillOut] | - | The shared pick-list. Skills a volunteer typed in themselves (is_custom) are not listed. |
| `POST` | `/skills` | SkillIn | 201 SkillOut | - | System Admin only: add a skill to the pick-list. |
| `GET` | `/me/profile` | - | 200 ProfileOut | - | Get Profile |
| `PUT` | `/me/profile` | ProfileIn | 200 ProfileOut | - | Fields left out are unchanged; a list that is sent (even empty) replaces the stored list. |
| `PATCH` | `/me/profile` | ProfileIn | 200 ProfileOut | - | Fields left out are unchanged; a list that is sent (even empty) replaces the stored list. |
| `GET` | `/me/profile/photo` | - | 200 | - | The image itself. The access token travels in a header, so the page fetches it and shows a blob URL. |
| `PUT` | `/me/profile/photo` | - | 200 ProfileOut | - | Send the raw image as the body (PNG, JPEG or WebP, at most 1 MB). Replaces the current photo. |
| `DELETE` | `/me/profile/photo` | - | 200 ProfileOut | - | Delete Photo |
| `GET` | `/me/contributions` | - | 200 list[ContributionOut] | - | My Contributions |
| `GET` | `/me/stats` | - | 200 VolunteerStatsOut | - | My Stats |
| `GET` | `/me/hours` | - | 200 list[MonthlyHoursOut] | by?, months? | Hours per calendar month for the last `months` months (oldest first, zero months included). |
| `GET` | `/me/certificates` | - | 200 list[CertificateOut] | - | My Certificates |
| `GET` | `/me/activities` | - | 200 list[ActivityOut] | past? | Upcoming (default) or past events the volunteer is registered for. Upcoming includes the waitlist. |
