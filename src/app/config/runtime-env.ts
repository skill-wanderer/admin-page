import { InjectionToken } from '@angular/core';

type RuntimeKey =
  | 'KEYCLOAK_URL'
  | 'KEYCLOAK_REALM'
  | 'KEYCLOAK_ADMIN_CLIENT_ID'
  | 'KEYCLOAK_GOOGLE_IDP_HINT'
  | 'APP_WEBSITE_URL'
  | 'KEYCLOAK_REFRESH_WINDOW_SECONDS'
  | 'KEYCLOAK_PROACTIVE_REFRESH_MIN_VALIDITY_SECONDS'
  | 'KEYCLOAK_REFRESH_CHECK_INTERVAL_MS';

declare global {
  interface Window {
    __env?: Partial<Record<RuntimeKey, string>>;
  }
}

export interface RuntimeEnv {
  keycloakUrl: string;
  keycloakRealm: string;
  keycloakAdminClientId: string;
  keycloakGoogleIdpHint: string | null;
  appWebsiteUrl: string;
  keycloakRefreshWindowSeconds: number;
  keycloakProactiveRefreshMinValiditySeconds: number;
  keycloakRefreshCheckIntervalMs: number;
}

const fallbackEnv: RuntimeEnv = {
  keycloakUrl: '',
  keycloakRealm: '',
  keycloakAdminClientId: '',
  keycloakGoogleIdpHint: null,
  appWebsiteUrl: '',
  keycloakRefreshWindowSeconds: 300,
  keycloakProactiveRefreshMinValiditySeconds: 60,
  keycloakRefreshCheckIntervalMs: 60_000,
};

function readRuntimeValue(key: RuntimeKey, fallbackValue: string): string {
  const runtimeValue = window.__env?.[key]?.trim();
  return runtimeValue && runtimeValue.length > 0 ? runtimeValue : fallbackValue;
}

function readRequiredRuntimeValue(key: RuntimeKey, fallbackValue = ''): string {
  const resolvedValue = readRuntimeValue(key, fallbackValue);
  if (!resolvedValue || resolvedValue.trim().length === 0) {
    throw new Error(`Missing required runtime config: ${key}`);
  }

  return resolvedValue;
}

function readOptionalRuntimeValue(key: RuntimeKey, fallbackValue: string | null): string | null {
  const runtimeValue = window.__env?.[key]?.trim();
  if (runtimeValue && runtimeValue.length > 0) {
    return runtimeValue;
  }

  return fallbackValue && fallbackValue.length > 0 ? fallbackValue : null;
}

function readOptionalRuntimeNumber(key: RuntimeKey, fallbackValue: number): number {
  const runtimeValue = window.__env?.[key]?.trim();
  if (!runtimeValue) {
    return fallbackValue;
  }

  const parsedValue = Number(runtimeValue);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallbackValue;
  }

  return Math.floor(parsedValue);
}

export function loadRuntimeEnv(): RuntimeEnv {
  return {
    keycloakUrl: readRequiredRuntimeValue('KEYCLOAK_URL', fallbackEnv.keycloakUrl),
    keycloakRealm: readRequiredRuntimeValue('KEYCLOAK_REALM', fallbackEnv.keycloakRealm),
    keycloakAdminClientId: readRequiredRuntimeValue(
      'KEYCLOAK_ADMIN_CLIENT_ID',
      fallbackEnv.keycloakAdminClientId,
    ),
    keycloakGoogleIdpHint: readOptionalRuntimeValue(
      'KEYCLOAK_GOOGLE_IDP_HINT',
      fallbackEnv.keycloakGoogleIdpHint,
    ),
    appWebsiteUrl: readRequiredRuntimeValue('APP_WEBSITE_URL', fallbackEnv.appWebsiteUrl),
    keycloakRefreshWindowSeconds: readOptionalRuntimeNumber(
      'KEYCLOAK_REFRESH_WINDOW_SECONDS',
      fallbackEnv.keycloakRefreshWindowSeconds,
    ),
    keycloakProactiveRefreshMinValiditySeconds: readOptionalRuntimeNumber(
      'KEYCLOAK_PROACTIVE_REFRESH_MIN_VALIDITY_SECONDS',
      fallbackEnv.keycloakProactiveRefreshMinValiditySeconds,
    ),
    keycloakRefreshCheckIntervalMs: readOptionalRuntimeNumber(
      'KEYCLOAK_REFRESH_CHECK_INTERVAL_MS',
      fallbackEnv.keycloakRefreshCheckIntervalMs,
    ),
  };
}

export const RUNTIME_ENV = new InjectionToken<RuntimeEnv>('RUNTIME_ENV', {
  factory: loadRuntimeEnv,
});