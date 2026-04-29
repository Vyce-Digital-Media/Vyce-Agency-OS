# Self-Hosted Backend Migration Plan: Laravel + MySQL

Goal: run Agency OS as a fully self-hosted React + Laravel + MySQL project with the same features, roles, flows, tables, and user experience.

## Backend Choice

Use Laravel + MySQL because the available BigRock shared hosting stack is PHP/MySQL/cPanel oriented. This avoids relying on a managed external backend service or a persistent Node process.

## Migration Order

### 1. Backend Foundation

- Add `backend/` Laravel-compatible source scaffold.
- Add Composer package metadata for Laravel, Sanctum, Socialite, and UUID support.
- Add `.env.example` for BigRock deployment.
- Add API routes matching current application flows.

Status: done.

### 2. Database Schema

Recreate the application schema in MySQL:

- `users`
- `profiles`
- `user_roles`
- `clients`
- `monthly_plans`
- `deliverables`
- `client_assets`
- `deliverable_assets`
- `notifications`
- `time_entries`

Preserve role and status values:

- roles: `admin`, `manager`, `team_member`, `client`
- deliverable statuses: `not_started`, `in_progress`, `in_review`, `needs_approval`, `approved`, `delivered`
- deliverable types: `post`, `reel`, `story`, `ad`, `campaign`, `blog`, `newsletter`, `other`

Status: migration file added.

### 3. Auth And Roles

Replace hosted auth with Laravel:

- Email/password login.
- Password reset.
- Current user/profile/role endpoint.
- Logout.
- Google OAuth via Laravel Socialite.
- Role helpers equivalent to the old role checks.

Status: backend pass done, frontend auth migrated.

### 4. Admin Service Endpoints

Replace previous privileged serverless functions:

- Invite member -> `POST /api/team/invite`
- Remove member -> `DELETE /api/team/{user}`
- Team salaries -> `GET /api/team/salaries`

Status: backend pass done, Team page migrated.

### 5. Core Feature APIs

Replace direct hosted SDK table calls with Laravel APIs:

- Dashboard: `GET /api/dashboard`
- Clients: `/api/clients`
- Plans: `/api/plans`
- Deliverables: `/api/deliverables`
- Team: `/api/team`
- Attendance: `/api/attendance`
- Notifications: `/api/notifications`
- Client portal: `/api/portal`

Status:

- Auth: migrated.
- Team: migrated.
- Clients: in progress.

### 6. Storage Replacement

Replace managed object storage:

- Store files privately under Laravel storage.
- Keep DB `file_url` as a private path.
- Generate temporary signed download URLs.
- Enforce file size and upload validation.

Status: backend pass added.

### 7. Frontend Migration

Do not rewrite pages all at once.

Recommended order:

1. Add React API adapter. Done.
2. Add token storage and Laravel auth context. Done.
3. Move Auth page. Done.
4. Move Team page. Done.
5. Move Clients page. In progress.
6. Move Plans page.
7. Move Deliverables page.
8. Move Assets.
9. Move Attendance.
10. Move Notifications.
11. Move Client Portal.
12. Remove old hosted backend integration files after all pages are migrated.

### 8. Data Migration

After the Laravel backend is running:

1. Export existing production tables.
2. Import into MySQL in dependency order:
   - users
   - profiles
   - user_roles
   - clients
   - monthly_plans
   - deliverables
   - assets
   - notifications
   - time_entries
3. Download existing bucket files.
4. Upload into Laravel private storage.
5. Rewrite asset paths if necessary.

### 9. Verification

Test every role:

- Admin
- Manager
- Team member
- Client

Test every critical flow:

- Login/logout.
- Forgot/reset password.
- Invite member.
- Remove member.
- Role changes.
- Client creation/edit/delete.
- Plan creation/edit/delete.
- Deliverable create/update/approve/delete.
- Asset upload/download/delete.
- Attendance clock in/out/breaks.
- Notifications read/read all.
- Client portal isolation.
