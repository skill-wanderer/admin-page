import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import Keycloak, { type KeycloakInitOptions } from 'keycloak-js';

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
  idpHint?: string;
}


const STORAGE_KEY = 'skill-wanderer.admin.keycloak-session';

// Xóa session mỗi lần load lại trang để luôn bắt login lại
sessionStorage.removeItem(STORAGE_KEY);

@Injectable({ providedIn: 'root' })
export class AuthService {
  private static readonly REFRESH_CHECK_INTERVAL_MS = 60_000;

  private readonly runtimeEnv = inject(RUNTIME_ENV);
  private readonly router = inject(Router);

  private keycloak: Keycloak | null = null;
  private initPromise: Promise<void> | null = null;
  private refreshIntervalId: number | null = null;

  private readonly readyState = signal(false);
  private readonly authenticatedState = signal(false);
  private readonly adminRoleState = signal(false);
  private readonly displayNameState = signal<string | null>(null);

  readonly isReady = this.readyState.asReadonly();
  readonly isLoggedIn = this.authenticatedState.asReadonly();
  readonly displayName = this.displayNameState.asReadonly();
  readonly canAccessAdmin = computed(() => this.isLoggedIn() && this.adminRoleState());

  isAuthenticated(): boolean {
    return this.authenticatedState();
  }

  hasAdminRole(): boolean {
    return this.adminRoleState();
  }

  hasGoogleLogin(): boolean {
    return Boolean(this.runtimeEnv.keycloakGoogleIdpHint);
  }

  async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.initialize();
    return this.initPromise;
  }

  async login(options: LoginOptions = {}): Promise<void> {
    await this.ensureInitialized();
    await this.keycloak?.login({
      redirectUri: options.redirectUri ?? `${window.location.origin}/admin`,
      prompt: options.forcePrompt ? 'login' : undefined,
      idpHint: options.idpHint,
    });
  }

  async loginWithGoogle(forcePrompt = false): Promise<void> {
    if (!this.runtimeEnv.keycloakGoogleIdpHint) {
      throw new Error('Google identity provider is not configured.');
    }

    await this.login({
      forcePrompt,
      idpHint: this.runtimeEnv.keycloakGoogleIdpHint,
    });
  }

  async logout(): Promise<void> {
    await this.ensureInitialized();
    this.stopRefreshTimer();
    this.clearStoredSession();
    this.syncAuthState(false);
    await this.keycloak?.logout({ redirectUri: window.location.origin });
  }

  async getAccessToken(minValiditySeconds = 300): Promise<string | null> {
    await this.ensureInitialized();

    if (!this.keycloak?.authenticated) {
      return null;
    }

    try {
      await this.refreshAccessToken(minValiditySeconds);
    } catch {
      return null;
    }

    if (!this.keycloak?.authenticated || !this.keycloak.token) {
      return null;
    }

    if (this.keycloak.isTokenExpired(0)) {
      return null;
    }

    return this.keycloak.token;
  }

  private async initialize(): Promise<void> {
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

    try {
      const authenticated = await this.keycloak.init({
        ...baseOptions,
        ...storedSession,
      });
      this.syncAuthState(authenticated);

      if (authenticated) {
        await this.refreshAccessToken(300);
      }
    } catch (error) {
      if (!storedSession) {
        this.syncAuthState(false);
        this.readyState.set(true);
        throw error;
      }

      this.clearStoredSession();
      const authenticated = await this.keycloak.init(baseOptions);
      this.syncAuthState(authenticated);

      if (authenticated) {
        await this.refreshAccessToken(300);
      }
    } finally {
      this.readyState.set(true);
    }
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
      void this.refreshAccessToken(300).catch(() => {
        this.clearStoredSession();
        this.syncAuthState(false);
        this.keycloak?.clearToken();
        void this.router.navigateByUrl('/admin');
      });
    };
  }

  private async refreshAccessToken(minValiditySeconds: number): Promise<void> {
    if (!this.keycloak?.authenticated) {
      return;
    }

    try {
      await this.keycloak.updateToken(minValiditySeconds);
      this.persistStoredSession();
      this.syncAuthState(true);
    } catch (error) {
      this.clearStoredSession();
      this.syncAuthState(false);
      this.keycloak.clearToken();
      throw error;
    }
  }

  private syncAuthState(authenticated: boolean): void {
    if (!authenticated || !this.keycloak) {
      this.stopRefreshTimer();
      this.authenticatedState.set(false);
      this.adminRoleState.set(false);
      this.displayNameState.set(null);
      return;
    }

    const roleNames = this.keycloak.realmAccess?.roles ?? [];
    const tokenClaims = (this.keycloak.tokenParsed ?? {}) as TokenClaims;

    this.authenticatedState.set(true);
    this.adminRoleState.set(roleNames.includes('Admin'));
    this.displayNameState.set(tokenClaims.name ?? tokenClaims.preferred_username ?? null);
    this.startRefreshTimer();
    this.persistStoredSession();
  }

  private startRefreshTimer(): void {
    if (this.refreshIntervalId !== null) {
      return;
    }

    // Chủ động refresh token khi còn 60s sẽ hết hạn
    this.refreshIntervalId = window.setInterval(() => {
      if (!this.keycloak?.authenticated) {
        return;
      }

      // 60s trước khi hết hạn sẽ refresh
      void this.refreshAccessToken(60).catch(() => {
        this.clearStoredSession();
        this.syncAuthState(false);
        this.keycloak?.clearToken();
        void this.router.navigateByUrl('/admin');
      });
    }, AuthService.REFRESH_CHECK_INTERVAL_MS);
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
}