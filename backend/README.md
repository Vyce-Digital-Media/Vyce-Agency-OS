# Agency OS Laravel Backend

This backend is the self-hosted Laravel API for the React Agency OS app.

It provides the application backend responsibilities:

- Auth and password reset
- Google OAuth
- Roles and permissions
- Client, plan, deliverable, asset, team, attendance, and notification APIs
- Private file storage with signed download URLs
- Admin service endpoints:
  - `invite-member`
  - `remove-member`
  - `get-team-salaries`

## Local Setup

This folder is source-first because PHP/Composer are not installed in the current workspace.

On a machine with PHP 8.2+ and Composer:

```sh
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan storage:link
php artisan serve
```

Recommended `.env` values:

```sh
APP_URL=https://your-domain.com
FRONTEND_URL=https://your-domain.com
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=agency_os
DB_USERNAME=agency_os
DB_PASSWORD=change-me
FILESYSTEM_DISK=local
SESSION_DOMAIN=your-domain.com
SANCTUM_STATEFUL_DOMAINS=your-domain.com,www.your-domain.com
```

## Deployment Note

For BigRock shared hosting, deploy the Laravel backend outside the public web root and point the domain/subdomain document root to `backend/public`. The React build can be served from the main domain, while the API can live on `/api` or a subdomain such as `api.your-domain.com`.
