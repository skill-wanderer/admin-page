# Tenant Management and Multi-Tenancy Foundation

This document describes the implementation of
[Spec 0001](specs/0001-tenant-management.md).

## What Is Implemented

- Shared-schema multi-tenancy foundation using a global `tenants` table and a
  `user_tenants` membership table.
- Keycloak/OIDC bearer-token validation for two realms:
  - admin realm for back-office APIs.
  - client realm for future tenant-facing APIs.
- Admin Tenant CRUD at `/api/admin/tenants`.
- Realm-role authorization for tenant administration using
  `realm_access.roles` and the configured `KEYCLOAK_ADMIN_REQUIRED_ROLE`
  value, defaulting to `CRM`.
- JIT client-user sync from client-realm tokens into the `users` table.
- Client tenant scoping middleware that reads the configured tenant header
  (`X-Tenant-ID` by default), checks tenant status, verifies membership, and
  stores the tenant ID in request context.

Client-domain business endpoints and membership-management endpoints are still
future work, as defined by Spec 0001.

## Package Layout

```text
internal/
├── admin/
│   ├── handlers/        # Tenant HTTP handlers
│   ├── repositories/    # Tenant persistence
│   ├── services/        # Tenant validation and business rules
│   └── routes.go        # /api/admin/tenants route registration
├── auth/                # OIDC claims and realm verifier
├── client/              # Client-domain middleware chain registration
├── config/              # Typed environment config
├── middleware/          # Auth, RBAC, user sync, tenant scope, CORS
├── models/              # Tenant, User, UserTenant, existing placeholders
└── tenancy/             # Tenant context helpers
```

## Configuration

Configuration is loaded once at startup from environment variables. In local
development, `.env` is loaded automatically when present.

Required values:

- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `KEYCLOAK_BASE_URL`
- `KEYCLOAK_ADMIN_REALM`
- `KEYCLOAK_CLIENT_REALM`

Common optional values:

- `KEYCLOAK_ADMIN_REQUIRED_ROLE` defaults to `CRM`.
- `KEYCLOAK_ADMIN_AUDIENCE` and `KEYCLOAK_CLIENT_AUDIENCE` are blank by
  default, which skips `aud`/`azp` checks.
- `KEYCLOAK_ADMIN_ISSUER` and `KEYCLOAK_CLIENT_ISSUER` default to
  `{KEYCLOAK_BASE_URL}/realms/{REALM}`.
- `TENANT_HEADER` defaults to `X-Tenant-ID`.
- `DB_AUTO_MIGRATE` defaults to `true`.

See [../.env.example](../.env.example) for the full list.

## Database

Startup migration uses GORM AutoMigrate and ensures the PostgreSQL `pgcrypto`
extension exists for `gen_random_uuid()`.

New tables:

- `tenants`
  - UUID primary key.
  - soft delete via `deleted_at`.
  - live-row unique slug index.
  - status values: `active`, `suspended`.
- `users`
  - UUID primary key.
  - unique `keycloak_sub`.
  - synced `email`, `name`, and `last_login_at`.
- `user_tenants`
  - composite primary key `(user_id, tenant_id)`.
  - reverse lookup index on `tenant_id`.

Existing lead/template models remain placeholders until the client-domain CRM
spec rebuilds them with tenant ownership.

## Admin Tenant API

All routes require:

```http
Authorization: Bearer <admin-realm-token-with-CRM-role>
```

Base path:

```text
/api/admin/tenants
```

Routes:

```text
POST   /api/admin/tenants
GET    /api/admin/tenants?page=1&pageSize=20&status=active&q=acme
GET    /api/admin/tenants/:id
PUT    /api/admin/tenants/:id
DELETE /api/admin/tenants/:id
```

Create body:

```json
{
  "name": "Acme Corp",
  "slug": "acme",
  "description": "Pilot customer"
}
```

Update body:

```json
{
  "name": "Acme Corporation",
  "description": "Upgraded account",
  "status": "suspended"
}
```

Rules:

- `name` is required and limited to 120 characters.
- `slug` is optional on create; when omitted, it is derived from `name`.
- `slug` is immutable after create.
- `description` is optional and limited to 1000 characters.
- `status` must be `active` or `suspended`.
- Unknown JSON fields are rejected.
- Delete is a soft delete.

Errors use this envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "name is required"
  }
}
```

Important status mappings:

- `401 UNAUTHENTICATED`: missing/invalid/wrong-realm token.
- `403 FORBIDDEN`: valid admin token missing the CRM role.
- `400 VALIDATION_ERROR`: invalid JSON/body/query/path input.
- `404 NOT_FOUND`: tenant does not exist.
- `409 CONFLICT`: duplicate live slug.

## Frontend Contract Reference

This section answers integration questions for frontend clients. All behavior
below is enforced in code today for the tenant endpoints.

### Tenant object shape

Every successful tenant response (list item, get, create, update) serializes the
full object. No field is conditionally omitted:

```json
{
  "id": "0b1d...uuid",
  "name": "Acme Corp",
  "slug": "acme",
  "description": "",
  "status": "active",
  "createdAt": "2026-06-22T10:30:00Z",
  "updatedAt": "2026-06-22T10:30:00Z"
}
```

- `description` is **always present**, including in list items. When empty it is
  an empty string `""`, never `null` and never omitted.
- `createdAt`/`updatedAt` are always present on every response, including
  create and update. They are RFC 3339 / ISO 8601 strings (`date-time`).
- Field names are camelCase (`createdAt`, not `created_at`).

### List envelope

`GET /api/admin/tenants` returns a flat envelope. All four fields are always
present:

```json
{
  "data": [ /* array of tenant objects */ ],
  "page": 1,
  "pageSize": 20,
  "total": 134
}
```

- `data` is the page of items (the key is `data`, not `items`).
- `total` is the total count of matching rows across all pages (`int64`); the
  client computes total pages from `total` / `pageSize`.
- This envelope is currently implemented for tenants only. The
  template/lead/field endpoints are placeholders and do not yet use it.

### Response bodies by method

- `POST /api/admin/tenants` -> `201 Created` with the full tenant object.
- `PUT /api/admin/tenants/:id` -> `200 OK` with the full updated tenant object
  (no refetch needed).
- `DELETE /api/admin/tenants/:id` -> `204 No Content` with an empty body.

### Query parameters

- `page` defaults to `1`; values `< 1` are clamped to `1`.
- `pageSize` defaults to `20`; values `< 1` are clamped to `20`, and values
  `> 100` are clamped to `100`.
- A page past the end returns `200` with an empty `data` array and the real
  `total` (not an error).
- Non-numeric `page`/`pageSize` return `400 VALIDATION_ERROR`.
- `status` accepts only `active` or `suspended`. Omit the parameter (or send it
  empty) to return all statuses. Any other value returns `400 VALIDATION_ERROR`.
- `q` matches `name` and `slug` only (not `description`). It is a
  case-insensitive substring match.

### Error envelope granularity

Errors always use the `{ "error": { "code", "message" } }` envelope. There is
no per-field `errors` array; `message` is a single human-readable string that
names the offending field in prose (e.g. `"name is required"`,
`"slug must be 2 to 63 characters"`).

`409 CONFLICT` always uses the code `CONFLICT` (no specific `SLUG_TAKEN` code);
duplicate live slug is the only conflict source. Branch on the `409` status and
message if needed.

### Auth branching (401 vs 403)

Admin endpoints are validated against the admin realm only.

- A client-realm token (or any missing/invalid/expired token) returns
  `401 UNAUTHENTICATED`. Frontend should treat this as re-login.
- `403 FORBIDDEN` only occurs when the token is valid for the admin realm but
  lacks the required role. Frontend should treat this as not-permitted (show
  access denied, do not re-login).

### CORS and base path

- All routes are under `/api`; admin tenant routes are under
  `/api/admin/tenants`. There is no additional global prefix.
- CORS allows the `Authorization` and `Content-Type` headers (plus the tenant
  header) and the `GET, POST, PUT, PATCH, DELETE, OPTIONS` methods. Bearer
  tokens in the `Authorization` header are supported. Credentialed/cookie mode
  is not enabled.
- Allowed origins come from `CORS_ALLOWED_ORIGINS` (default `*`). Set explicit
  origins per environment for non-local deployments.

### Deployment-specific items (not fixed in code)

These depend on per-environment configuration and must be confirmed with ops:

- The exact required role value per environment. Code default is `CRM`; the
  frontend role check must match `KEYCLOAK_ADMIN_REQUIRED_ROLE` exactly
  (case-sensitive). A check against `Admin` will not pass against the `CRM`
  default.
- The backend origin/host per environment.
- Whether the list envelope above becomes the standard for the
  template/lead/field endpoints once they are rebuilt.

## Client Tenant Scope Foundation

The client-domain middleware chain is registered for `/api/client`:

```text
Auth(client realm) -> UserSync -> TenantScope
```

`UserSync` creates or updates a row in `users` from token claims:

- `sub` -> `keycloak_sub`
- `email` -> `email`
- `name` or `preferred_username` -> `name`
- current time -> `last_login_at`

`TenantScope` requires:

```http
Authorization: Bearer <client-realm-token>
X-Tenant-ID: <tenant-uuid>
```

It rejects missing or malformed tenant headers with `400`, unavailable or
suspended tenants with `403`, and non-members with `403`.

No client business endpoints are implemented yet.

## Local Checks

Run:

```bash
go test ./...
```

The middleware tests cover:

- admin realm-role enforcement.
- JIT user create/update behavior.
- tenant header and membership checks.
