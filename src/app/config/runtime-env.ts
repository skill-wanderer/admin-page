import { InjectionToken } from '@angular/core';

type RuntimeKey =
  | 'KEYCLOAK_URL'
  | 'KEYCLOAK_REALM'
  | 'KEYCLOAK_ADMIN_CLIENT_ID'
  | 'KEYCLOAK_GOOGLE_IDP_HINT'
  | 'APP_WEBSITE_URL';

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
}

const fallbackEnv: RuntimeEnv = {
  keycloakUrl: '',
  keycloakRealm: '',
  keycloakAdminClientId: '',
  keycloakGoogleIdpHint: null,
  appWebsiteUrl: '',
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
  };
}

export const RUNTIME_ENV = new InjectionToken<RuntimeEnv>('RUNTIME_ENV', {
  factory: loadRuntimeEnv,
});