import { Routes } from '@angular/router';

import { adminAccessGuard, adminMatchGuard } from './auth/admin-access.guard';
import { tenantAdminMatchGuard } from './auth/tenant-admin.guard';

export const routes: Routes = [
  {
    path: 'access-denied',
    title: 'Access denied | Skill Wanderer Admin',
    loadComponent: () =>
      import('./pages/access-denied.component').then((module) => module.AccessDeniedComponent),
  },
  {
    path: 'admin',
    canMatch: [adminMatchGuard],
    canActivateChild: [adminAccessGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Skill Wanderer Admin',
        loadComponent: () =>
          import('./pages/admin-home.component').then((module) => module.AdminHomeComponent),
      },
      {
        path: 'tenants',
        canMatch: [tenantAdminMatchGuard],
        children: [
          {
            path: '',
            title: 'Tenants | Skill Wanderer Admin',
            loadComponent: () =>
              import('./pages/tenants/tenant-list.component').then(
                (module) => module.TenantListComponent,
              ),
          },
          {
            path: 'new',
            title: 'Create Tenant | Skill Wanderer Admin',
            loadComponent: () =>
              import('./pages/tenants/tenant-form.component').then(
                (module) => module.TenantFormComponent,
              ),
          },
          {
            path: ':id/edit',
            title: 'Edit Tenant | Skill Wanderer Admin',
            loadComponent: () =>
              import('./pages/tenants/tenant-form.component').then(
                (module) => module.TenantFormComponent,
              ),
          },
        ],
      },
    ],
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'admin',
  },
  {
    path: '**',
    redirectTo: 'admin',
  },
];
