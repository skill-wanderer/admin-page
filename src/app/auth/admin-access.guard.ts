import { inject } from '@angular/core';
import { CanActivateChildFn, CanMatchFn, Router, UrlTree } from '@angular/router';
import { Observable, map, of, switchMap } from 'rxjs';
import { AuthService } from './auth.service';

export function resolveAdminAccess(
  auth: AuthService,
  router: Router,
): Observable<boolean | UrlTree> {
  return auth.ensureInitialized$().pipe(
    switchMap(() => {
      if (!auth.isAuthenticated()) {
        return of(router.parseUrl('/'));
      }
      if (!auth.hasAdminRole()) {
        localStorage.setItem('no-admin-role', 'true');
        return auth.logout$().pipe(map(() => router.parseUrl('/')));
      }

      localStorage.removeItem('no-admin-role');
      return of(true);
    }),
  );
}

export const adminAccessGuard: CanActivateChildFn = () =>
  resolveAdminAccess(inject(AuthService), inject(Router));

export const adminMatchGuard: CanMatchFn = () =>
  resolveAdminAccess(inject(AuthService), inject(Router));
