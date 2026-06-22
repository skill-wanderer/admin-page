import { UrlTree } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';

import { AdminAccessAuth, resolveAdminAccess } from './admin-access.guard';

function createAuth(overrides: Partial<AdminAccessAuth> = {}): AdminAccessAuth {
  return {
    ensureInitialized$: vi.fn(() => of(void 0)),
    isAuthenticated: vi.fn(() => true),
    hasAdminRole: vi.fn(() => true),
    login$: vi.fn(() => of(void 0)),
    ...overrides,
  };
}

describe('resolveAdminAccess', () => {
  it('starts login when the user is not authenticated', async () => {
    const auth = createAuth({ isAuthenticated: vi.fn(() => false) });
    const router = { parseUrl: vi.fn() };

    const result = await firstValueFrom(resolveAdminAccess(auth, router));

    expect(result).toBe(false);
    expect(auth.login$).toHaveBeenCalledOnce();
  });

  it('redirects a signed-in user without a configured admin role instead of looping', async () => {
    const deniedUrl = {} as UrlTree;
    const auth = createAuth({ hasAdminRole: vi.fn(() => false) });
    const router = { parseUrl: vi.fn(() => deniedUrl) };

    const result = await firstValueFrom(resolveAdminAccess(auth, router));

    expect(result).toBe(deniedUrl);
    expect(router.parseUrl).toHaveBeenCalledWith('/access-denied');
    expect(auth.login$).not.toHaveBeenCalled();
  });

  it('allows a signed-in user with a configured admin role', async () => {
    const auth = createAuth();
    const router = { parseUrl: vi.fn() };

    await expect(firstValueFrom(resolveAdminAccess(auth, router))).resolves.toBe(true);
  });
});
