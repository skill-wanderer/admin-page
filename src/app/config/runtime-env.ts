import { InjectionToken } from '@angular/core';

type RuntimeKey =
  | 'KEYCLOAK_URL'
  | 'KEYCLOAK_REALM'
  | 'KEYCLOAK_ADMIN_CLIENT_ID'
  | 'ADMIN_REALM_ROLES'
  | 'API_BASE_URL_CRM'
  | 'TENANT_ADMIN_ROLE_CRM'
  | 'KEYCLOAK_REFRESH_WINDOW_SECONDS'
  | 'KEYCLOAK_REFRESH_WINDOW_PERCENT'
  | 'KEYCLOAK_REFRESH_WINDOW_MIN_SECONDS'
  | 'KEYCLOAK_REFRESH_WINDOW_MAX_SECONDS'
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
  adminRealmRoles: readonly string[];
  apiBaseUrlCrm: string;
  tenantAdminRoleCrm: string;
  keycloakRefreshWindowSeconds: number;
  keycloakRefreshWindowPercent: number;
  keycloakRefreshWindowMinSeconds: number;
  keycloakRefreshWindowMaxSeconds: number;
  keycloakProactiveRefreshMinValiditySeconds: number;
  keycloakRefreshCheckIntervalMs: number;
}

const fallbackEnv: RuntimeEnv = {
  keycloakUrl: '',
  keycloakRealm: '',
  keycloakAdminClientId: '',
  adminRealmRoles: ['CRM'],
  apiBaseUrlCrm: '',
  tenantAdminRoleCrm: 'CRM',
  keycloakRefreshWindowSeconds: 60,
  keycloakRefreshWindowPercent: 20,
  keycloakRefreshWindowMinSeconds: 60,
  keycloakRefreshWindowMaxSeconds: 7_200,
  keycloakProactiveRefreshMinValiditySeconds: 30,
  keycloakRefreshCheckIntervalMs: 30_000,
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

function readRequiredRuntimeList(key: RuntimeKey, fallbackValues: readonly string[]): string[] {
  const rawValue = readRequiredRuntimeValue(key, fallbackValues.join(','));
  const values = [...new Set(rawValue.split(',').map((value) => value.trim()).filter(Boolean))];

  if (values.length === 0) {
    throw new Error(`Missing required runtime config: ${key}`);
  }

  return values;
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
    adminRealmRoles: readRequiredRuntimeList(
      'ADMIN_REALM_ROLES',
      fallbackEnv.adminRealmRoles,
    ),
    apiBaseUrlCrm: readRequiredRuntimeValue('API_BASE_URL_CRM', fallbackEnv.apiBaseUrlCrm),
    tenantAdminRoleCrm: readRequiredRuntimeValue(
      'TENANT_ADMIN_ROLE_CRM',
      fallbackEnv.tenantAdminRoleCrm,
    ),
    keycloakRefreshWindowSeconds: readOptionalRuntimeNumber(
      'KEYCLOAK_REFRESH_WINDOW_SECONDS',
      fallbackEnv.keycloakRefreshWindowSeconds,
    ),
    keycloakRefreshWindowPercent: readOptionalRuntimeNumber(
      'KEYCLOAK_REFRESH_WINDOW_PERCENT',
      fallbackEnv.keycloakRefreshWindowPercent,
    ),
    keycloakRefreshWindowMinSeconds: readOptionalRuntimeNumber(
      'KEYCLOAK_REFRESH_WINDOW_MIN_SECONDS',
      fallbackEnv.keycloakRefreshWindowMinSeconds,
    ),
    keycloakRefreshWindowMaxSeconds: readOptionalRuntimeNumber(
      'KEYCLOAK_REFRESH_WINDOW_MAX_SECONDS',
      fallbackEnv.keycloakRefreshWindowMaxSeconds,
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
