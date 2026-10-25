# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

- Frontend: Next.js + React, confirmed by the product owner.
- Backend integration: ASP.NET Core modular monolith API v1 in `D:\Project\QuanLyDayThem\backend`.
- Frontend language, Next.js version, rendering strategy, deployment target, and hosting platform remain open decisions.

## Users

### Platform administrator

`PlatformAdmin` operates the service across centers. They create and review center records, approve or reject centers, suspend or reinstate access, invite the first center owner, and review requested changes to legal/contact information.

### Center owner

`CenterOwner` is responsible for an approved tutoring center. They can access the center, manage its teaching operation, view its profile, and submit full-profile change requests for platform review. Owner-only actions are distinct from general center-management actions.

### Center administrator

`CenterAdmin` shares center-management permissions for current teaching operations: subjects, rooms, classes, people, enrollment, registration review, sessions, recurring schedules, and attendance.

### Center members

`Teacher` and `Staff` are active center members. Current authorization allows them to view center-scoped operational data, but management mutations—including attendance—currently require `CenterOwner` or `CenterAdmin`. The frontend must reflect the implemented policy rather than infer permissions from a job title.

### Student

`Student` signs in with Google, or links Google to an existing password account, then browses classes that a center has opened for registration, applies to one or more classes, follows each decision, and views current classes and upcoming sessions.

One user may belong to multiple centers. Center role and access are resolved from the active membership for each requested `centerId`; they are not global properties of the user.

## Product Purpose

Tutor Management System is a multi-center operating system for controlled onboarding and day-to-day tutoring-center administration. It makes it possible to:

- govern which centers may operate on the platform;
- establish a verified owner through invitation-only onboarding;
- isolate every center's data and permissions;
- maintain academic catalogs and people records;
- manage classes, enrollment, teaching schedules, student registration, and attendance;
- preserve review history and prevent stale or conflicting changes.

Success means each role can complete its authorized workflow with a clear center context, understand the current state and next action, recover from conflicts safely, and never see or mutate another center's data.

## Positioning

The implemented product is an operations platform for tutoring centers, not an independent-tutor organizer, public marketplace, learning-management system, or finance suite.

Its current mechanism is a combination of server-verified multi-center membership, controlled center onboarding, explicit review states, auditable state transitions, soft archival, idempotent submissions, and optimistic concurrency. A client must make these mechanisms legible rather than flatten them into generic CRUD screens.

No external marketing claim, customer promise, pricing model, or competitive claim has been confirmed.

## Operating Context

### Center selection and tenant context

After authentication, the client loads `GET /api/v1/me/centers`. A user may see several memberships and chooses a center in the UI. The selected `centerId` belongs in the route and every center-scoped API URL. The server does not persist a global current center in the session or JWT.

Each center item exposes its role, center status, and `canAccess`. Suspended centers remain visible with `canAccess: false` so the UI can explain the interruption. An inactive membership disappears from the user's center list. `PlatformAdmin` is not automatically a member of every center.

### Authentication and session lifecycle

- Public password registration does not exist.
- Password accounts enter through invitation or existing seeded/legacy accounts.
- Students enter through Google sign-in; an existing password account with the same email must explicitly link Google rather than being merged automatically.
- Successful login returns a short-lived access token in JSON and sets the refresh token in the `tm.refresh` HttpOnly cookie.
- The frontend must send credentialed requests for refresh/logout and must not depend on reading the refresh token.
- Refresh rotates the token. Reuse of an already rotated token revokes its token family.
- Logout revokes the current session; logout-all revokes every refresh session for the user.
- Changing a password preserves the current session, rotates its tokens, and revokes other sessions.
- Password reset uses an eight-digit, single-use OTP with expiration and attempt/rate limits, revokes all sessions, and does not automatically sign the user in.
- Email verification endpoints remain for legacy unverified accounts; invited center owners are created with verified login email.

The client should keep the access token in short-lived application memory rather than `localStorage`, attempt a cookie-based refresh when appropriate, and return to authentication when the session is no longer active.

### Platform center onboarding

1. A `PlatformAdmin` creates the full center record: legal name, display name, tax code, optional business-registration number, address, contact email, and contact phone.
2. The center starts as `PendingApproval`.
3. The platform administrator approves it or rejects it with a reason. Valid lifecycle states are `PendingApproval`, `Approved`, `Rejected`, and `Suspended`.
4. An approved center can receive an owner invitation. The invitation is emailed, expires after 48 hours, and does not expose its token in the API response.
5. The recipient accepts the token with a username, strong password, and Vietnamese phone number. Acceptance creates the user and active `CenterOwner` membership.
6. A suspended center immediately becomes inaccessible to center members, while remaining visible in their center switcher. A platform administrator can reinstate it with a reason.

Important transition rules:

- approval is idempotent for an already approved center;
- rejection applies only to a pending center;
- suspension applies only to an approved center;
- reinstatement applies only to a suspended center;
- invitation requires an approved center, an unused email, and no duplicate active invitation for that center/email.

### Center profile changes

Center members may read the profile, but only `CenterOwner` may request a change. The owner submits a complete proposed snapshot of all seven legal/contact fields, plus a reason and evidence reference. The current record does not change while the request is `Pending`.

Only one pending request is allowed per center. A `PlatformAdmin` compares original and proposed values, then approves or rejects with a review note. Approval applies every proposed field atomically; rejection preserves the current center. A request cannot be reviewed twice, and approval fails if the original center record changed while the request was pending.

The `evidenceReference` is text only. There is no file upload, digital signature, government-system lookup, or automatic legal verification. The center contact email is separate from the owner's verified login email.

### Subjects and rooms

Subjects and rooms are center-scoped catalogs. Active center members can list and inspect them; owners/admins can create, update, archive, and reactivate them.

- Codes are normalized to uppercase and remain unique within a center.
- Names are normalized and compared case-insensitively within a center.
- Archive is soft deletion and does not release the code or name for reuse.
- Archived records remain available when explicitly requested and can be reactivated.
- Every mutation uses `expectedVersion` to prevent a stale client from overwriting a newer change.
- A subject with active classes cannot be archived.
- A room has a free-form location note but no capacity; class capacity belongs to the class.

### Classes, people, and enrollment

Owners/admins manage classes, offline student profiles, and teacher profiles. Center members may view them.

- A class belongs to one active subject, has a center-unique code, a name, `maxStudents`, current enrolled count, registration-open state, active/archive state, and version.
- Capacity is 1–500 and cannot be reduced below current enrollment.
- An active class with enrollment cannot be archived. Dependent future sessions must also be resolved before archiving affected resources.
- Student and teacher records are soft archived and versioned.
- A student linked to an online account is distinguished by `hasAccount`; the API does not expose its identity user ID.
- Staff can directly enroll only offline student profiles. An account-linked student must use the class-application review workflow.
- Withdrawal preserves enrollment history and decrements the active class count.
- Archiving a student requires all active enrollments to be withdrawn first.
- Offline and online student profiles are never automatically merged by matching name or phone number.

### Teaching sessions and recurring schedules

A teaching session binds one class, teacher, room, UTC start, and UTC end. Owners/admins create, reschedule, or cancel future sessions; center members can view sessions by time range.

- Class, teacher, and room must be active and belong to the same center.
- Sessions must be 15 minutes to 8 hours long and start in the future when created or rescheduled.
- The class, teacher, and room may not overlap another active session.
- A started session cannot be rescheduled or cancelled.
- A session with attendance cannot be rescheduled or cancelled.
- Mutations require the current version.

Recurring scheduling stores an IANA/Windows time-zone ID, local start time, date range, weekdays, duration, exclusions, and generated occurrences. The workflow is:

1. Preview all occurrences and per-occurrence conflicts without writing data.
2. Create a series and its sessions using a client-generated `requestId` for idempotency.
3. Optionally stop all future occurrences from a valid future date.
4. Optionally replace the future portion with a new series while preserving past history.

A series spans at most 180 calendar days; generated sessions must be future and end within one year. Missing or ambiguous local times around time-zone transitions are rejected. Stopping or replacing cannot alter started sessions or sessions with attendance.

### Student class registration

Classes are closed to registration by default. Owners/admins explicitly open or close each class.

1. A Google-authenticated `Student` views open classes in an approved center.
2. One submission may select 1–10 distinct classes and provides the student's full name.
3. The client supplies a UUID `Idempotency-Key`. Repeating the same key and same payload returns the original result; reusing it for different content is a conflict.
4. Each selected class creates a separate `Pending` application under one shared `submissionId`.
5. Owners/admins review each class independently.
6. Approval atomically creates or reuses the student's center profile, creates enrollment, and increases the class count. Rejection requires a reason.

Pending or approved applications block another active application for the same class. A rejected class can be applied to again with a new key if registration remains open. Closing registration blocks new submissions but does not erase pending applications. A full or archived class cannot be approved; a full-class failure leaves the application pending so management can increase capacity or reject it.

Students can view their own applications, active classes, and sessions over a range of at most 93 days. They cannot access center-management review actions.

### Attendance

Attendance is center-management-only in the current API.

1. The roster is derived from students who were enrolled when the session began.
2. Attendance can be saved only after the session starts and not for a cancelled session.
3. A draft records an actual teacher, optional overall note, a default mark, and per-student overrides.
4. Submission requires a complete draft, an actual teacher, and a non-`Unknown` mark for every roster student.
5. Submitted attendance is immutable through the draft endpoint.
6. Corrections require the current version, an actual teacher, a meaningful reason, and an actual change.
7. Every correction records before/after snapshots, actor, version, reason, and timestamp in history.

Attendance marks are `Unknown`, `Present`, `ExcusedAbsent`, `UnexcusedAbsent`, and `Late`. Sheet states presented by the API include `NotStarted`, `Cancelled`, `Draft`, and `Submitted`.

## Capabilities and Constraints

### Current API surface

The reviewed backend exposes 84 versioned controller actions plus liveness/readiness health checks. Product UI capabilities are grouped as:

- Authentication and recovery: login, Google login/linking, email verification, refresh, logout, logout-all, change/forgot/reset password, invitation acceptance.
- User center context: list memberships and load one authorized center context.
- Platform administration: create/list/review centers, invite an owner, and review center-profile changes.
- Center administration: read profile and submit/list profile-change requests.
- Catalogs: subjects and rooms.
- Teaching operation: classes, students, teachers, enrollment, individual sessions, recurring schedule series, class registration, and attendance.

Modules named Compliance, DocumentsExams, Finance, HumanResources, LearningOperations, Notifications, and Reporting currently contain no implementation. The frontend must not present tuition collection, payroll, exams, learning content, dashboards/analytics, document management, or general notification features as available product capabilities.

### Authorization model

- Platform scope uses the global `PlatformAdmin` role.
- Center scope is checked from the active membership on every request using the route's `centerId`.
- `CenterMember`: CenterOwner, CenterAdmin, Teacher, or Staff; read current center data.
- `CenterManagement`: CenterOwner or CenterAdmin; mutate current operational data.
- `CenterOwner`: CenterOwner only; submit legal/contact profile changes.
- `Student`: global role used for self-service registration endpoints.
- A valid JWT alone is insufficient if its server-side session has been revoked.

The frontend should derive available actions from center context and known policy, while still treating 401/403 responses as authoritative.

### API contract

- Base convention: `/api/v1/...`; the version segment is required.
- JSON and XML are supported. The web frontend should request JSON.
- Successful and failed JSON responses use `success`, `message`, optional `data`, optional `errors`, and `traceId`.
- Each error has a stable `code`, user-facing `message`, and optional `field`.
- `204 No Content` has no body. Forgot-password returns a generic `202` response to avoid account enumeration.
- Paginated responses use `page`, `pageSize`, `totalCount`, and `items`; page size is 1–100.
- Null optional properties may be omitted. Meaningful `false`, `0`, empty strings, and empty arrays are preserved.
- The UI should retain `traceId` in error details/support affordances without making it the primary message.
- `expectedVersion` conflicts require reloading and reconciling current data, not silently retrying stale changes.
- Rate-limited requests return 429 and may include `Retry-After`.

### Data and workflow constraints

- Center data is isolated by both center ID and entity ID; cross-center resource lookup behaves as not found or forbidden.
- Soft archive is preferred to destructive deletion for current catalogs and people.
- Important decisions preserve status, reviewer/actor, reason, and timestamps.
- Teaching times are transported in UTC; recurring schedules are authored in a named local time zone.
- Conflict prevention applies to class, teacher, and room occupancy.
- Center tax code, normalized catalog codes/names, memberships, active applications, and active enrollments have database-level uniqueness/consistency protection.
- Email delivery is asynchronous through an outbox and Worker. Local delivery may be file based; SMTP is supported. Production delivery observability and multi-worker hardening are not yet a product guarantee.

### Open product decisions

- Confirm the primary commercial buyer and whether the first release prioritizes platform operations, center operations, or student self-service.
- Confirm the user-facing product name; `Tutor Management System` is currently a technical/backend name.
- Confirm the primary interface language and localization requirements.
- Confirm whether Teacher should eventually mark attendance directly; current backend policy does not allow it unless the user also has a management role.
- Confirm deployment target and production authentication origin/CORS configuration.
- Confirm whether the empty backend modules are roadmap commitments or placeholders only.

## Evidence on Hand

- Backend source of truth: `D:\Project\QuanLyDayThem\backend\src`.
- API host and cross-cutting behavior: `D:\Project\QuanLyDayThem\backend\src\Hosts\TutorManagement.Api\Program.cs`.
- Identity, sessions, invitations, and membership: `D:\Project\QuanLyDayThem\backend\src\Modules\IdentityAccess`.
- Center lifecycle, profile review, and rooms: `D:\Project\QuanLyDayThem\backend\src\Modules\Organizations`.
- Subjects, people, classes, enrollment, registration, scheduling, and attendance: `D:\Project\QuanLyDayThem\backend\src\Modules\Academics`.
- End-to-end workflow documentation and manual test scenarios: `D:\Project\QuanLyDayThem\backend\docs`.
- Automated domain/API coverage: `D:\Project\QuanLyDayThem\backend\tests`.

No production screenshots, existing frontend, brand assets, customer proof, pricing, legal copy, analytics, or real customer content are present in the frontend repository. Future work must not fabricate them.

## Product Principles

1. **Center context is always explicit.** Show the active center and its access state wherever a cross-center mistake could occur.
2. **State precedes action.** Make lifecycle status, prerequisites, capacity, conflicts, and the next valid transition visible before users commit a change.
3. **Preserve operational history.** Prefer archive, withdrawal, review history, and reasoned correction over destructive or ambiguous actions.
4. **Permissions must be explainable.** Distinguish platform role, center membership role, student role, suspended-center state, and inactive membership instead of collapsing them into generic access denied states.
5. **Concurrency is a user experience.** On stale versions or idempotency conflicts, help users reload, compare, and safely continue without duplicate work or silent data loss.

## Accessibility & Inclusion

No product-specific accessibility standard or audience accommodation has been confirmed. This remains an explicit product decision; implementation should not infer that the absence of a requirement permits inaccessible interaction.
