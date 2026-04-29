# Agency OS

Agency OS is a self-hosted React + Laravel application for managing agency clients, plans, deliverables, assets, team members, attendance, notifications, and client portal access.

## Stack

Frontend:

- Vite
- React
- TypeScript
- Tailwind CSS
- shadcn/ui

Backend:

- Laravel
- MySQL
- Laravel Sanctum
- Laravel Socialite
- Private Laravel file storage

## Local Frontend Setup

```sh
npm install
npm run dev
```

Frontend environment:

```sh
VITE_API_URL=http://localhost:8000/api
VITE_APP_URL=http://localhost:8080
```

## Backend Setup

The backend source lives in `backend/`.

On a machine with PHP 8.2+ and Composer, create a full Laravel app and copy the backend source into it. Detailed steps are in:

```txt
backend/docs/INSTALLATION.md
```

Backend environment:

```sh
APP_URL=https://your-domain.com
FRONTEND_URL=https://your-domain.com
DB_CONNECTION=mysql
DB_DATABASE=agency_os
DB_USERNAME=agency_os
DB_PASSWORD=change-me
SANCTUM_STATEFUL_DOMAINS=your-domain.com,www.your-domain.com
```

## Deployment

For shared hosting, point the API domain or subdomain document root to Laravel's `public` folder. Build the frontend with:

```sh
npm run build
```

Then upload the generated `dist/` files to the frontend web root.

## Migration Status

The backend scaffold and API contract are in place. The frontend is being migrated page-by-page from the old direct backend SDK calls to the local API adapter in `src/api/`.
