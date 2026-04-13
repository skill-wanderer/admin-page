import { resolveAdminAccess, type AdminAccessAuth } from './admin-access.guard';

describe('resolveAdminAccess', () => {
  class AuthHarness implements AdminAccessAuth {
    ensureInitializedCalls = 0;
    loginCalls: Array<{ forcePrompt?: boolean } | undefined> = [];

    constructor(
      private readonly authenticated: boolean,
      private readonly adminRole: boolean,
    ) {}

    async ensureInitialized(): Promise<void> {
      this.ensureInitializedCalls += 1;
    }

    isAuthenticated(): boolean {
      return this.authenticated;
    }

    hasAdminRole(): boolean {
      return this.adminRole;
    }

    async login(options?: { forcePrompt?: boolean }): Promise<void> {
      this.loginCalls.push(options);
    }
  }

  it('allows authenticated admin users', async () => {
    const auth = new AuthHarness(true, true);
    let parseUrlCalls = 0;
    const router = {
      parseUrl: () => {
        parseUrlCalls += 1;
        return '/unused';
      },
    };

    await expect(resolveAdminAccess(auth, router as never)).resolves.toBe(true);
    expect(auth.ensureInitializedCalls).toBe(1);
    expect(auth.loginCalls).toHaveLength(0);
    expect(parseUrlCalls).toBe(0);
  });

  it('forces account switch for authenticated non-admin users', async () => {
    const auth = new AuthHarness(true, false);
    let parseUrlCalls = 0;
    const router = {
      parseUrl: () => {
        parseUrlCalls += 1;
        return '/unused';
      },
    };

    const result = await resolveAdminAccess(auth, router as never);

    expect(result).toBe(false);
    expect(parseUrlCalls).toBe(0);
    expect(auth.loginCalls).toHaveLength(1);
    expect(auth.loginCalls[0]).toEqual({ forcePrompt: true });
  });

  it('starts keycloak login for unauthenticated users', async () => {
    const auth = new AuthHarness(false, false);
    let parseUrlCalls = 0;
    const router = {
      parseUrl: () => {
        parseUrlCalls += 1;
        return '/unused';
      },
    };

    const result = await resolveAdminAccess(auth, router as never);

    expect(result).toBe(false);
    expect(parseUrlCalls).toBe(0);
    expect(auth.loginCalls).toHaveLength(1);
    expect(auth.loginCalls[0]).toBeUndefined();
  });
});