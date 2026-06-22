import { inject } from '@angular/core';
import { CanActivateChildFn, CanMatchFn, Router, UrlTree } from '@angular/router';
import { Observable, map, of, switchMap } from 'rxjs';
import { AuthService } from './auth.service';

export interface AdminAccessAuth {
  ensureInitialized$(): Observable<void>;
  isAuthenticated(): boolean;
  hasAdminRole(): boolean;
  login$(): Observable<void>;
}

export function resolveAdminAccess(
  auth: AdminAccessAuth,
  router: Pick<Router, 'parseUrl'>,
): Observable<boolean | UrlTree> {
  return auth.ensureInitialized$().pipe(
    switchMap(() => {
      if (!auth.isAuthenticated()) {
        return auth.login$().pipe(map(() => false));
      }
      if (!auth.hasAdminRole()) {
        return of(router.parseUrl('/access-denied'));
      }

      return of(true);
    }),
  );
}

export const adminAccessGuard: CanActivateChildFn = () =>
  resolveAdminAccess(inject(AuthService), inject(Router));

export const adminMatchGuard: CanMatchFn = () =>
  resolveAdminAccess(inject(AuthService), inject(Router));
