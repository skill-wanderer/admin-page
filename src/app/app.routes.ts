import { Routes } from '@angular/router';

import { adminAccessGuard, adminMatchGuard } from './auth/admin-access.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Skill Wanderer Admin Login',
    loadComponent: () =>
      import('./pages/admin-login/admin-login.component').then(
        (module) => module.AdminLoginComponent,
      ),
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
          import('./pages/admin-home/admin-home.component').then(
            (module) => module.AdminHomeComponent,
          ),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
