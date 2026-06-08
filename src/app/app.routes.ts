import { Routes } from '@angular/router';

import { adminAccessGuard, adminMatchGuard } from './auth/admin-access.guard';

export const routes: Routes = [
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
