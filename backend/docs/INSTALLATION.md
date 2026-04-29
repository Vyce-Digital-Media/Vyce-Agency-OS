# Installation Into A Full Laravel App

The current workspace does not have PHP or Composer installed, so the backend here is a source scaffold rather than a Composer-generated Laravel project.

On a development machine or server with PHP 8.2+ and Composer, use one of these approaches.

## Option A: Create A Fresh Laravel App, Then Copy This Source

```sh
composer create-project laravel/laravel backend
cd backend
composer require laravel/sanctum laravel/socialite ramsey/uuid
php artisan install:api
```

Then copy these scaffolded folders/files into the generated Laravel app:

```txt
app/
database/migrations/
routes/api.php
.env.example
```

## Option B: Use This Folder As The Project Source

Add the standard Laravel runtime files that Composer normally creates:

```txt
artisan
bootstrap/
config/
public/
storage/framework/
```

Option A is safer and is recommended.

## Required Environment Variables

```sh
APP_URL=https://your-domain.com
FRONTEND_URL=https://your-domain.com
DB_CONNECTION=mysql
DB_DATABASE=agency_os
DB_USERNAME=agency_os
DB_PASSWORD=change-me
SANCTUM_STATEFUL_DOMAINS=your-domain.com,www.your-domain.com
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://your-domain.com/api/auth/google/callback
```

## First Admin

After migrating, create the first admin user from `php artisan tinker` or a temporary seeder:

```php
$user = App\Models\User::create(['email' => 'admin@example.com', 'password' => Hash::make('change-this-password')]);
App\Models\Profile::create(['user_id' => $user->id, 'full_name' => 'Admin']);
App\Models\UserRole::create(['user_id' => $user->id, 'role' => 'admin']);
```
