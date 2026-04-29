# Agency OS API Contract

Base URL:

```txt
/api
```

Authentication:

```txt
Authorization: Bearer <token>
Accept: application/json
```

## Auth

- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/logout`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `GET /auth/google/redirect`
- `GET /auth/google/callback`

## Team

- `GET /team`
- `POST /team/invite`
- `DELETE /team/{user_id}`
- `PATCH /team/{user_id}/role`
- `PATCH /team/{user_id}/profile`
- `GET /team/salaries`

## Core Resources

- `/clients`
- `/plans`
- `/deliverables`
- `/attendance`
- `/notifications`
- `/portal`
- `/portal/deliverables`

## Assets

- `POST /assets/{bucket}/{folder}`
- `GET /assets/{bucket}/{asset}/signed-url`
- `DELETE /assets/{bucket}/{asset}`

Buckets:

- `client-assets`
- `deliverable-assets`

## Response Shape

Collection endpoints use:

```json
{ "data": [] }
```

Write actions use:

```json
{ "success": true }
```

Auth returns:

```json
{
  "token": "...",
  "user": { "id": "...", "email": "..." },
  "profile": {},
  "role": "admin"
}
```
