import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import Keycloak, { type KeycloakInitOptions } from 'keycloak-js';
import {
  Observable,
  catchError,
  defer,
  finalize,
  from,
  map,
  of,
  shareReplay,
  switchMap,
  tap,
  throwError,
} from 'rxjs';

import { RUNTIME_ENV } from '../config/runtime-env';

interface StoredKeycloakSession {
  token: string;
  refreshToken: string;
  idToken?: string;
  timeSkew?: number | null;
}

interface TokenClaims {
  name?: string;
  preferred_username?: string;
}

interface LoginOptions {
  forcePrompt?: boolean;
  redirectUri?: string;
}

const STORAGE_KEY = 'skill-wanderer.admin.keycloak-session';

export function hasAnyRole(
  assignedRoles: readonly string[],
  acceptedRoles: readonly string[],
): boolean {
  return acceptedRoles.some((role) => assignedRoles.includes(role));
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly runtimeEnv = inject(RUNTIME_ENV);
  private readonly router = inject(Router);
  private readonly portalAdminRoles = this.runtimeEnv.adminRealmRoles;
  private keycloak: Keycloak | null = null;
  private initStream$: Observable<void> | null = null;
  private refreshIntervalId: number | null = null;
  private readonly readyState = signal(false);
  private readonly authenticatedState = signal(false);
  private readonly adminRoleState = signal(false);
  private readonly rolesState = signal<readonly string[]>([]);
  private readonly displayNameState = signal<string | null>(null);
  readonly isReady = this.readyState.asReadonly();
  readonly isLoggedIn = this.authenticatedState.asReadonly();
  readonly displayName = this.displayNameState.asReadonly();
  readonly portalAdminRoleLabel = this.portalAdminRoles.join(' or ');
  readonly canAccessAdmin = computed(() => this.isLoggedIn() && this.adminRoleState());
  readonly canManageTenants = computed(
    () => this.isLoggedIn() && this.rolesState().includes(this.runtimeEnv.tenantAdminRoleCrm),
  );

  isAuthenticated(): boolean {
    return this.authenticatedState();
  }

  hasAdminRole(): boolean {
    return this.adminRoleState();
  }

  hasRole(role: string): boolean {
    return this.rolesState().includes(role);
  }

  ensureInitialized$(): Observable<void> {
    if (this.initStream$) {
      return this.initStream$;
    }

    this.initStream$ = this.initialize$().pipe(shareReplay({ bufferSize: 1, refCount: false }));
    return this.initStream$;
  }

  login$(options: LoginOptions = {}): Observable<void> {
    return this.ensureInitialized$().pipe(
      switchMap(() =>
        from(
          this.keycloak?.login({
            redirectUri: options.redirectUri ?? this.getLoginRedirectUri(),
            prompt: options.forcePrompt ? 'login' : undefined,
          }) ?? Promise.resolve(),
        ),
      ),
      map(() => void 0),
    );
  }

  logout$(): Observable<void> {
    return this.ensureInitialized$().pipe(
      tap(() => {
        this.stopRefreshTimer();
        this.clearStoredSession();
        this.syncAuthState(false);
      }),
      switchMap(() =>
        from(this.keycloak?.logout({ redirectUri: this.getLogoutRedirectUri() }) ?? Promise.resolve()),
      ),
      map(() => void 0),
    );
  }

  getAccessToken$(minValiditySeconds?: number): Observable<string | null> {
    const effectiveMinValiditySeconds =
      minValiditySeconds ?? this.runtimeEnv.keycloakRefreshWindowSeconds;

    return this.ensureInitialized$().pipe(
      switchMap(() => {
        if (!this.keycloak?.authenticated) {
          return of(null);
        }

        return this.refreshAccessToken$(effectiveMinValiditySeconds).pipe(
          map(() => {
            if (!this.keycloak?.authenticated || !this.keycloak.token) {
              return null;
            }
            if (this.keycloak.isTokenExpired(0)) {
              return null;
            }
            return this.keycloak.token;
          }),
          catchError(() => of(null)),
        );
      }),
    );
  }

  getCachedAccessToken(): string | null {
    if (!this.keycloak?.authenticated || !this.keycloak.token) {
      return null;
    }

    return this.keycloak.token;
  }

  private initialize$(): Observable<void> {
    return defer(() => {
      this.keycloak = new Keycloak({
        url: this.runtimeEnv.keycloakUrl,
        realm: this.runtimeEnv.keycloakRealm,
        clientId: this.runtimeEnv.keycloakAdminClientId,
      });
      this.attachKeycloakListeners(this.keycloak);

      const storedSession = this.readStoredSession();
      const baseOptions: KeycloakInitOptions = {
        pkceMethod: 'S256',
        checkLoginIframe: false,
      };

      const initWithStored$ = from(
        this.keycloak.init({
          ...baseOptions,
          ...storedSession,
        }),
      );

      return initWithStored$.pipe(
        catchError((error) => {
          if (!storedSession) {
            this.syncAuthState(false);
            return throwError(() => error);
          }

          this.clearStoredSession();
          return from(this.keycloak!.init(baseOptions));
        }),
        switchMap((authenticated) => {
          this.syncAuthState(authenticated);
          if (!authenticated) {
            return of(void 0);
          }

          return this.refreshAccessToken$(this.runtimeEnv.keycloakRefreshWindowSeconds);
        }),
        finalize(() => {
          this.readyState.set(true);
        }),
      );
    });
  }

  private attachKeycloakListeners(keycloak: Keycloak): void {
    keycloak.onAuthSuccess = () => {
      this.syncAuthState(true);
    };
    keycloak.onAuthRefreshSuccess = () => {
      this.persistStoredSession();
      this.syncAuthState(true);
    };
    keycloak.onAuthLogout = () => {
      this.stopRefreshTimer();
      this.clearStoredSession();
      this.syncAuthState(false);
    };
    keycloak.onAuthError = () => {
      this.stopRefreshTimer();
      this.clearStoredSession();
      this.syncAuthState(false);
    };
    keycloak.onTokenExpired = () => {
      this.refreshAccessToken$(this.runtimeEnv.keycloakRefreshWindowSeconds).subscribe({
        error: () => {
          this.clearStoredSession();
          this.syncAuthState(false);
          this.keycloak?.clearToken();
          void this.router.navigateByUrl('/admin');
        },
      });
    };
  }

  private refreshAccessToken$(minValiditySeconds: number): Observable<void> {
    if (!this.keycloak?.authenticated) {
      return of(void 0);
    }

    return from(this.keycloak.updateToken(minValiditySeconds)).pipe(
      tap(() => {
        this.persistStoredSession();
        this.syncAuthState(true);
      }),
      map(() => void 0),
      catchError((error) => {
        this.clearStoredSession();
        this.syncAuthState(false);
        this.keycloak!.clearToken();
        return throwError(() => error);
      }),
    );
  }

  private syncAuthState(authenticated: boolean): void {
    if (!authenticated || !this.keycloak) {
      this.stopRefreshTimer();
      this.authenticatedState.set(false);
      this.adminRoleState.set(false);
      this.rolesState.set([]);
      this.displayNameState.set(null);
      return;
    }

    const roleNames = this.keycloak.realmAccess?.roles ?? [];
    const tokenClaims = (this.keycloak.tokenParsed ?? {}) as TokenClaims;

    this.authenticatedState.set(true);
    this.rolesState.set(roleNames);
    this.adminRoleState.set(hasAnyRole(roleNames, this.portalAdminRoles));
    this.displayNameState.set(tokenClaims.name ?? tokenClaims.preferred_username ?? null);
    this.startRefreshTimer();
    this.persistStoredSession();
  }

  private startRefreshTimer(): void {
    if (this.refreshIntervalId !== null) {
      return;
    }

    this.refreshIntervalId = window.setInterval(() => {
      if (!this.keycloak?.authenticated) {
        return;
      }

      this.refreshAccessToken$(
        this.runtimeEnv.keycloakProactiveRefreshMinValiditySeconds,
      ).subscribe({
        error: () => {
          this.clearStoredSession();
          this.syncAuthState(false);
          this.keycloak?.clearToken();
          void this.router.navigateByUrl('/admin');
        },
      });
    }, this.runtimeEnv.keycloakRefreshCheckIntervalMs);
  }

  private stopRefreshTimer(): void {
    if (this.refreshIntervalId === null) {
      return;
    }

    window.clearInterval(this.refreshIntervalId);
    this.refreshIntervalId = null;
  }

  private readStoredSession(): Partial<KeycloakInitOptions> | null {
    const rawValue = sessionStorage.getItem(STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    try {
      const storedSession = JSON.parse(rawValue) as StoredKeycloakSession;
      if (!storedSession.token || !storedSession.refreshToken) {
        this.clearStoredSession();
        return null;
      }

      return {
        token: storedSession.token,
        refreshToken: storedSession.refreshToken,
        idToken: storedSession.idToken,
        timeSkew: storedSession.timeSkew ?? undefined,
      };
    } catch {
      this.clearStoredSession();
      return null;
    }
  }

  private persistStoredSession(): void {
    if (!this.keycloak?.token || !this.keycloak.refreshToken) {
      return;
    }

    const storedSession: StoredKeycloakSession = {
      token: this.keycloak.token,
      refreshToken: this.keycloak.refreshToken,
      idToken: this.keycloak.idToken,
      timeSkew: this.keycloak.timeSkew,
    };

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(storedSession));
  }

  private clearStoredSession(): void {
    sessionStorage.removeItem(STORAGE_KEY);
  }

  private getLoginRedirectUri(): string {
    return this.normalizeRedirectUri(window.location.origin);
  }

  private getLogoutRedirectUri(): string {
    return this.normalizeRedirectUri(window.location.origin);
  }

  private normalizeRedirectUri(uri: string): string {
    return uri.replace(/\/+$/, '');
  }
}
