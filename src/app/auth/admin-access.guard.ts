import { inject } from '@angular/core';
import { CanActivateChildFn, CanMatchFn, Router, UrlTree } from '@angular/router';

import { AuthService } from './auth.service';

export interface AdminAccessAuth {
  ensureInitialized(): Promise<void>;
  isAuthenticated(): boolean;
  hasAdminRole(): boolean;
  login(options?: { forcePrompt?: boolean }): Promise<void>;
}

export async function resolveAdminAccess(
  auth: AdminAccessAuth,
  router: Pick<Router, 'parseUrl'>,
): Promise<boolean | UrlTree> {
  await auth.ensureInitialized();

  if (!auth.isAuthenticated()) {
    await auth.login();
    return false;
  }

  if (!auth.hasAdminRole()) {
    await auth.login({ forcePrompt: true });
    return false;
  }

  return true;
}

export const adminAccessGuard: CanActivateChildFn = async () =>
  resolveAdminAccess(inject(AuthService), inject(Router));

export const adminMatchGuard: CanMatchFn = async () =>
  resolveAdminAccess(inject(AuthService), inject(Router));