# Spec 0001 (FE) — Frontend Tenant Management (Admin)

**Status:** Ready for implementation
**Implements (frontend of):** BE Spec 0001 — Tenant Management (backend:
[../BE docs/tenant-management.md](../BE%20docs/tenant-management.md))
**Type:** Build spec. This describes **what to build**. End-user usage docs live
in `docs/FE docs/` and are written **after** the UI is implemented.

---

## 1. Summary

Build an Angular admin UI to manage tenants via the backend
`/api/admin/tenants` CRUD API. The feature is **role-gated**: it is visible and
reachable only for users whose access token carries the required realm role, and
is fully hidden for everyone else. No `X-Tenant-ID` header is involved — these
are admin-realm endpoints.

### In scope
- Tenant list with search, status filter, and pagination.
- Create, edit, and soft-delete tenants.
- Role-based gating of navigation, route, and data.
- A `TenantService` (HTTP) + typed models.
- An `AuthService` capability to check the required role.

### Out of scope
- Client-domain / `/api/client` screens (no backend business endpoints yet).
- `user_tenants` membership management UI.
- End-user usage documentation (separate, post-implementation task).

---

## 2. Prerequisites to build first

These must exist before the feature code compiles/runs. Build them as the first
tasks.

### 2.1 Runtime environment config (blocking)

Both new config values are **environment-driven** via the existing runtime-env
mechanism ([runtime-env.ts](../../src/app/config/runtime-env.ts) → `window.__env`,
written from `.env` by `scripts/write-runtime-env.mjs`). Nothing is hardcoded.

Add three keys:

| Runtime key | `RuntimeEnv` field | Required? | Default | Purpose |
| --- | --- | --- | --- | --- |
| `ADMIN_REALM_ROLES` | `adminRealmRoles: readonly string[]` | optional | `CRM` | Comma-separated realm roles accepted by the admin shell. A user needs any one listed role. Future capability roles can be added without changing auth code. |
| `API_BASE_URL_CRM` | `apiBaseUrlCrm: string` | **required** | — | CRM backend origin; requests go to `${apiBaseUrlCrm}/api/admin/tenants`. Capability-specific naming leaves room for `API_BASE_URL_CLIENT`. |
| `TENANT_ADMIN_ROLE_CRM` | `tenantAdminRoleCrm: string` | optional | `CRM` | CRM realm role that gates the feature; must equal the backend's `KEYCLOAK_ADMIN_REQUIRED_ROLE`. Capability-specific naming leaves room for roles such as `TENANT_ADMIN_ROLE_CLIENT`. |

**Build:**
- Add `'ADMIN_REALM_ROLES'`, `'API_BASE_URL_CRM'`, and `'TENANT_ADMIN_ROLE_CRM'`
  to the `RuntimeKey` union and the corresponding fields to `RuntimeEnv` /
  `fallbackEnv` (default the role values to `'CRM'`).
- Parse `ADMIN_REALM_ROLES` as a trimmed, de-duplicated comma-separated list.
- In `loadRuntimeEnv()`: `apiBaseUrlCrm` via `readRequiredRuntimeValue('API_BASE_URL_CRM', …)`;
  `tenantAdminRoleCrm` via `readRequiredRuntimeValue('TENANT_ADMIN_ROLE_CRM', 'CRM')` (a
  blank env value falls back to `CRM`).
- Add all three keys to `.env.example` and to the runtime-env writer
  (`scripts/write-runtime-env.mjs`).

Making the role an env value lets each deployment match its own
`KEYCLOAK_ADMIN_REQUIRED_ROLE` without a code change.

### 2.2 Keycloak — no changes needed

The existing Keycloak setup already targets the admin side correctly — admin
realm (`KEYCLOAK_REALM`), admin client (`KEYCLOAK_ADMIN_CLIENT_ID`), init,
refresh, and token parsing all stay as-is. This feature only adds role checks on
the already-parsed token; it does not touch the Keycloak config, init flow, or
realm/client wiring. The admin-shell gate accepts any role in
`runtimeEnv.adminRealmRoles`, while the tenant gate specifically reads
`runtimeEnv.tenantAdminRoleCrm` from `realm_access.roles`. A future Client Admin
role can be added to `ADMIN_REALM_ROLES` without restoring a generic `Admin`
role or changing auth code.

### 2.3 AuthService role capability

**Build:** add to [auth.service.ts](../../src/app/auth/auth.service.ts) (it already
injects `RUNTIME_ENV`):

```ts
private readonly rolesState = signal<readonly string[]>([]);
hasRole(role: string): boolean { return this.rolesState().includes(role); }
readonly canManageTenants = computed(
  () => this.isLoggedIn() && this.rolesState().includes(this.runtimeEnv.tenantAdminRoleCrm),
);
```

Populate `rolesState` inside `syncAuthState()` from
`this.keycloak.realmAccess?.roles ?? []` (the array is already read there for the
existing admin check — reuse it). Reset to `[]` on the unauthenticated branch.

---

## 3. What to build

### 3.1 Files

```text
src/app/
├── config/
│   └── runtime-env.ts                 # + apiBaseUrlCrm, tenantAdminRoleCrm (§2.1)
├── auth/
│   ├── auth.service.ts                # + hasRole / canManageTenants (§2.3)
│   └── tenant-admin.guard.ts          # canMatch guard (§3.4)
└── pages/tenants/
    ├── tenant.models.ts               # §3.2
    ├── tenant.service.ts              # §3.3
    ├── tenant-list.component.ts/.html
    └── tenant-form.component.ts/.html  # create + edit
```

Conventions to follow (match existing code): standalone components,
`ChangeDetectionStrategy.OnPush`, signals for component state, RxJS for HTTP,
`inject()` for DI, Tailwind for styling, lazy `loadComponent` routes.

### 3.2 Models — `tenant.models.ts`

```ts
export type TenantStatus = 'active' | 'suspended';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  description: string; // always present; empty string "" when blank, never null/omitted
  status: TenantStatus;
  createdAt: string; // RFC 3339 / ISO 8601, always present
  updatedAt: string; // RFC 3339 / ISO 8601, always present
}

export interface TenantListQuery {
  page: number;      // 1-based, min 1
  pageSize: number;  // min 1, max 100
  status?: TenantStatus;
  q?: string;
}

// Backend list envelope (flat). NOTE: the array field is `data`, not `items`.
// There is no totalPages/hasNext — derive them from total / pageSize on the FE.
export interface TenantListResult {
  data: Tenant[];
  page: number;
  pageSize: number;
  total: number; // int64; total matching records across all pages
}

export interface CreateTenantRequest {
  name: string;          // required, ≤120
  slug?: string;         // optional; derived from name if omitted; immutable after create
  description?: string;  // optional, ≤1000
}

export interface UpdateTenantRequest {
  name?: string;
  description?: string;
  status?: TenantStatus; // 'active' | 'suspended'
}

export interface ApiErrorEnvelope {
  error: { code: string; message: string };
}
```

**List envelope (confirmed against BE).** `GET /api/admin/tenants` returns a flat
envelope with all four fields always present:

```json
{ "data": [ /* Tenant[] */ ], "page": 1, "pageSize": 20, "total": 134 }
```

- Wrapper field is **`data`** (not `items`).
- `page` 1-based (default 1, min 1); `pageSize` default 20, min 1, **max 100**;
  `total` is an int64 count across all pages.
- **No `totalPages` / `hasNext`** — the FE computes `Math.ceil(total / pageSize)`
  and next/prev availability itself.
- Query params are camelCase: `?page=&pageSize=&status=&q=`.
- The **full Tenant object** is returned on every response — list item, get,
  create, and update. No field is conditionally omitted; `description` is always
  present (empty string when blank), and `createdAt`/`updatedAt` are present on
  every response including create/update.

> Open: this envelope is confirmed for **tenants only**. Other list endpoints
> (templates/leads/fields) currently return bare arrays and are placeholder code
> slated for rebuild — treat the `data/page/pageSize/total` shape as the tenant
> contract; do not assume it generalizes until the backend confirms it as the
> standard for all list endpoints (open question §6).

### 3.3 Service — `tenant.service.ts`

`@Injectable({ providedIn: 'root' })`. Inject `HttpClient` and `RUNTIME_ENV`.
Base = `${apiBaseUrlCrm}/api/admin/tenants`.

| Method | Call & response |
| --- | --- |
| `list(query): Observable<TenantListResult>` | `GET ?page&pageSize&status&q` (camelCase params; omit empty ones). Reads `result.data` for items. |
| `get(id): Observable<Tenant>` | `GET /:id` → full Tenant. |
| `create(body: CreateTenantRequest): Observable<Tenant>` | `POST` → **`201`** with the full Tenant. |
| `update(id, body: UpdateTenantRequest): Observable<Tenant>` | `PUT /:id` → **`200`** with the full updated Tenant (use it directly; **no refetch needed**). |
| `remove(id): Observable<void>` | `DELETE /:id` → **`204`** empty body (soft delete). |

Query-param behavior (BE-confirmed, so the FE doesn't need to guard these):
- `page` < 1 clamps to 1; `pageSize` < 1 clamps to 20, > 100 clamps to 100.
- A page **past the end returns `200` with empty `data`** and the real `total` —
  not a `404`/error. Render the empty state, keep paging controls from `total`.
- Non-numeric `page`/`pageSize` → `400`. Send integers only.
- `status` accepts only `active`/`suspended`; **omit it entirely for "all"**
  (sending an invalid value → `400`).
- `q` is a case-insensitive substring match on **`name` and `slug` only** (not
  `description`) — set search-box placeholder/help accordingly.

**Do not** add an `Authorization` header or any `X-Tenant-ID` header — the bearer
token is injected by [authInterceptor](../../src/app/auth/auth.interceptor.ts);
the tenant header is for the client-domain chain only and must never be sent here.

Map errors from the `ApiErrorEnvelope` per §4.

### 3.4 Guard — `tenant-admin.guard.ts`

Mirror [admin-access.guard.ts](../../src/app/auth/admin-access.guard.ts):

```ts
export const tenantAdminMatchGuard: CanMatchFn = () => {
  const auth = inject(AuthService);
  const env = inject(RUNTIME_ENV);
  return auth.ensureInitialized$().pipe(
    map(() => auth.hasRole(env.tenantAdminRoleCrm)),
  );
};
```

Returning `false` from `canMatch` means the route does not match → not navigable,
lazy chunk not loaded, even via direct URL.

### 3.5 Routes

Add under the existing `admin` shell in
[app.routes.ts](../../src/app/app.routes.ts) (already wrapped by
`adminMatchGuard` / `adminAccessGuard`):

```ts
{
  path: 'tenants',
  canMatch: [tenantAdminMatchGuard],
  children: [
    { path: '', loadComponent: () => import('./pages/tenants/tenant-list.component').then(m => m.TenantListComponent) },
    { path: 'new', loadComponent: () => import('./pages/tenants/tenant-form.component').then(m => m.TenantFormComponent) },
    { path: ':id/edit', loadComponent: () => import('./pages/tenants/tenant-form.component').then(m => m.TenantFormComponent) },
  ],
}
```

### 3.6 Navigation entry

In [admin-home.component.html](../../src/app/pages/admin-home.component.html)
sidebar, render the "Tenants" item only when permitted, and route to it:

```html
@if (authService.canManageTenants()) {
  <a class="nav-item" routerLink="/admin/tenants">
    <i class="ti ti-building"></i> Tenants
  </a>
}
```

(Expose `authService` if not already, and import `RouterLink`.)

### 3.7 List component — `/admin/tenants`

- Table columns: **name, slug, status badge, created date, actions** (edit,
  delete).
- Controls: search input bound to `q` (debounce ~300ms before fetching); status
  filter (`all` / `active` / `suspended`); pagination from `page` / `pageSize` /
  `total` — compute `totalPages = Math.ceil(total / pageSize)` and enable
  next/prev accordingly (backend sends no `totalPages`/`hasNext`). Cap `pageSize`
  at 100.
- State via signals: `tenants` (from `result.data`), `total`, `page`, `pageSize`,
  `loading`, `error`.
- States to render: loading, empty ("No tenants"), error (with retry).
- Row **delete** → confirmation, then `remove(id)` (`204`), then refetch current
  page.
- An unexpected `403` here (e.g. role revoked mid-session) → show access-denied,
  do not re-login (§4).

### 3.8 Form component — create & edit

Single component handling both, keyed off the presence of an `:id` route param.

**Create mode:**
- Fields: `name` (required, ≤120), `slug` (optional, **2–63 chars** when provided;
  helper: "auto-derived from name if blank; cannot be changed later"),
  `description` (≤1000).
- Submit → `create()` (`201`, returns the full tenant). On success, navigate to
  the list. On `409`, show the slug-conflict message on the `slug` field (§4).

**Edit mode:**
- Load via `get(id)`; prefill.
- Editable: `name`, `description`, `status` (`active` / `suspended`).
- `slug` is rendered **disabled / read-only** (immutable).
- Submit → `update(id, …)`. On `404`, show "tenant no longer exists" and return
  to list.

Client-side validation mirrors backend limits for UX, but the **backend is
authoritative** — always surface server validation errors (§4).

---

## 4. Error handling (consume backend envelope)

Backend errors: `{ "error": { "code", "message" } }`. `message` is a **single
human-readable string** that names the offending field in prose (e.g.
`"name is required"`, `"slug must be 2 to 63 characters"`). There is **no
per-field `errors` array** — so surface `message` as a form-level alert/toast;
optional best-effort field mapping by keyword only.

| Status | Code | Required FE behavior |
| --- | --- | --- |
| `401` | `UNAUTHENTICATED` | Token missing/invalid/expired **or a client-realm token** → trigger **re-login** via `AuthService`. |
| `403` | `FORBIDDEN` | Valid admin token but **lacks the role** → show **access denied; do NOT re-login** (re-login won't help). Don't show tenant data. |
| `400` | `VALIDATION_ERROR` | Show `error.message` (form-level), per above. |
| `404` | `NOT_FOUND` | Tenant gone → "not found" state, return to list. |
| `409` | `CONFLICT` | Always code `CONFLICT` (only source is a duplicate live slug) → show as a `slug` field error using `message`. |

---

## 5. Acceptance criteria

- [ ] `ADMIN_REALM_ROLES`, `API_BASE_URL_CRM`, and `TENANT_ADMIN_ROLE_CRM` added
      to runtime-env (`runtime-env.ts`, writer, `.env.example`).
- [ ] `AuthService.hasRole` / `canManageTenants` implemented from
      `realm_access.roles`, gating on `runtimeEnv.tenantAdminRoleCrm`.
- [ ] Any one role in `ADMIN_REALM_ROLES` grants entry to the admin shell; a
      separate generic `Admin` realm role is not required.
- [ ] A user **with** the role sees the "Tenants" menu, can reach
      `/admin/tenants`, and can list/search/paginate/create/edit/delete.
- [ ] A user **without** the role: no menu item, route does not match (direct URL
      included), never sees tenant data.
- [ ] No request carries `X-Tenant-ID`; all carry the bearer via the existing
      interceptor (no manual header code).
- [ ] List reads the `data` array; pagination derives `totalPages` from
      `total`/`pageSize`; `pageSize` capped at 100.
- [ ] `slug` editable on create, disabled/immutable on edit.
- [ ] List supports `q`, `status`, and camelCase `page`/`pageSize` params.
- [ ] Errors `400/401/403/404/409` produce the behaviors in §4.
- [ ] `TENANT_ADMIN_ROLE_CRM` value confirmed against the deployment's
      `KEYCLOAK_ADMIN_REQUIRED_ROLE` (no other Keycloak change made).

---

## 6. Open items (deployment / ops — not fixed in code)

The BE doc resolved the contract questions; only these per-environment values
remain, and they are **config, not code**:

1. **Required role value** — set `TENANT_ADMIN_ROLE_CRM` in `.env` to match each
   environment's `KEYCLOAK_ADMIN_REQUIRED_ROLE` (default `CRM`, **case-sensitive**;
   a check against `Admin` will not pass the `CRM` default). Value-only; Keycloak
   config is unchanged.
2. **Backend origin** — set `API_BASE_URL_CRM` per environment. For non-local
   deployments the backend's `CORS_ALLOWED_ORIGINS` (default `*`) must be set to
   the SPA origin; CORS already allows `Authorization`/`Content-Type` and the
   needed methods (credentialed/cookie mode is off, which suits bearer-token auth).
3. **List envelope generalization** — the `data/page/pageSize/total` shape is
   confirmed for **tenants only**. Other list endpoints (templates/leads/fields)
   still return bare placeholder arrays. Confirm whether this envelope becomes the
   standard before reusing `TenantListResult` for them.
