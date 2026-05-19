import { inject } from '@angular/core';
import { CanActivateChildFn, CanMatchFn } from '@angular/router';
import { Observable, map, of, switchMap } from 'rxjs';
import { AuthService } from './auth.service';

export function resolveAdminAccess(
  auth: AuthService,
): Observable<boolean> {
  return auth.ensureInitialized$().pipe(
    switchMap(() => {
      if (!auth.isAuthenticated()) {
        return auth.login$().pipe(map(() => false));
      }
      if (!auth.hasAdminRole()) {
        return auth.logout$().pipe(map(() => false));
      }

      localStorage.removeItem('no-admin-role');
      return of(true);
    }),
  );
}

export const adminAccessGuard: CanActivateChildFn = () => resolveAdminAccess(inject(AuthService));

export const adminMatchGuard: CanMatchFn = () => resolveAdminAccess(inject(AuthService));