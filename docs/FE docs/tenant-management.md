# Tenant Management (Frontend)

The Tenant Management screen lets authorized administrators create and maintain
tenant organizations from the admin portal. It uses the CRM admin API documented
in the [backend tenant-management guide](../BE%20docs/tenant-management.md).

## Access requirements

Sign in with an account from the configured Keycloak admin realm. To enter the
portal, the access token must contain at least one role from `ADMIN_REALM_ROLES`.
The value is a comma-separated list and defaults to `CRM`; role matching is
case-sensitive. A separate generic `Admin` realm role is not required.

The tenant-management screens additionally require the role configured by
`TENANT_ADMIN_ROLE_CRM`, which defaults to `CRM`. This separate feature check
allows a future admin type to enter the portal without receiving CRM access.

Accounts without the CRM tenant-management role do not see the **Tenants** menu
item and cannot open the tenant routes directly. Accounts are created and managed
in Keycloak; no external identity provider is used by this frontend.

## Routes

| Screen | Route |
| --- | --- |
| Tenant list | `/admin/tenants` |
| Create tenant | `/admin/tenants/new` |
| Edit tenant | `/admin/tenants/:id/edit` |

## View and find tenants

Open **Tenants** from the admin dashboard. The list displays each tenant's name,
slug, status, creation date, and available actions.

You can:

- Search by tenant name or slug. Search does not inspect descriptions.
- Filter by **All statuses**, **Active**, or **Suspended**.
- Display 20, 50, or 100 tenants per page.
- Move between pages with **Previous** and **Next**.
- Retry the request when the backend cannot be reached.

Search waits briefly after typing before loading results. Changing a search,
status filter, or page size returns the list to page 1.

## Create a tenant

1. Open the tenant list and select **Create tenant**.
2. Enter the tenant details.
3. Select **Create tenant** to save, or **Cancel** to return without saving.

Fields:

| Field | Rules |
| --- | --- |
| Name | Required; maximum 120 characters. |
| Slug | Optional; 2–63 characters when supplied. If blank, the backend derives it from the name. |
| Description | Optional; maximum 1000 characters. |

Choose the slug carefully. It becomes the tenant's stable identifier and cannot
be changed after creation. If another live tenant already uses it, the form shows
the backend conflict message on the slug field.

New tenants are created with the backend's default `active` status.

## Edit a tenant

Select **Edit** beside a tenant. You can change:

- Name.
- Description.
- Status: `active` or `suspended`.

The slug is visible but disabled because it is immutable. Select **Save changes**
to update the tenant. If the tenant was deleted by another administrator, the
screen shows a not-found state and provides a return link to the tenant list.

Suspending a tenant makes it unavailable to the backend's client tenant-scope
middleware. Reactivating it makes it eligible for client access again, subject to
the user's tenant membership.

## Delete a tenant

Select **Delete** beside a tenant and confirm the prompt. Deletion is soft: the
backend removes the tenant from normal results without immediately deleting its
database record. The current list page reloads after the operation.

## Session and error behavior

- An expired or invalid session starts the Keycloak sign-in flow again.
- A valid account without the required CRM role sees **Access denied**. The app
  does not repeatedly sign in because authentication would not grant the missing
  permission.
- Validation and conflict messages returned by the backend are displayed in the
  form.
- Failed list requests show a retry action.
- No tenant data is displayed after an access-denied response.

## Runtime configuration

Configure these values in the local `.env` file or deployment environment:

```env
KEYCLOAK_URL=https://keycloak.example.com
KEYCLOAK_REALM=admin-realm
KEYCLOAK_ADMIN_CLIENT_ID=admin-frontend
ADMIN_REALM_ROLES=CRM
API_BASE_URL_CRM=https://crm-api.example.com
TENANT_ADMIN_ROLE_CRM=CRM
```

- `API_BASE_URL_CRM` is the CRM backend origin. Tenant requests use
  `${API_BASE_URL_CRM}/api/admin/tenants`.
- `ADMIN_REALM_ROLES` lists the realm roles accepted at the portal boundary.
  Possessing any one listed role is sufficient. For example, a future setup can
  use `ADMIN_REALM_ROLES=CRM,CLIENT`.
- `TENANT_ADMIN_ROLE_CRM` must exactly match the backend's
  `KEYCLOAK_ADMIN_REQUIRED_ROLE`; role matching is case-sensitive.

The runtime-config writer creates `public/runtime-config.js` before start, build,
and test commands. Use [.env.example](../../.env.example) as the configuration
template. Do not commit `.env` or the generated runtime-config file.

The existing HTTP interceptor adds the Keycloak bearer token. Tenant-management
requests do not send `X-Tenant-ID`, because these are admin-realm operations
rather than tenant-scoped client operations.

## Scope

This feature manages tenant records only. It does not manage user-to-tenant
memberships and does not provide client-domain CRM screens. Those capabilities
require separate backend and frontend features.
