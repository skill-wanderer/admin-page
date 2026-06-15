  interface JwtPayload {
    exp?: number;
    iat?: number;
  }

  function decodeBase64Url(value: string): string {
    const paddedValue = value + '='.repeat((4 - (value.length % 4)) % 4);
    const base64 = paddedValue.replace(/-/g, '+').replace(/_/g, '/');
    return atob(base64);
  }

  function readJwtPayload(token: string | null): JwtPayload | null {
    if (!token) {
      return null;
    }

    const tokenParts = token.split('.');
    if (tokenParts.length < 2) {
      return null;
    }

    try {
      return JSON.parse(decodeBase64Url(tokenParts[1])) as JwtPayload;
    } catch {
      return null;
    }
  }

  export function readJwtExpiryEpochSeconds(token: string | null): number | null {
    const payload = readJwtPayload(token);
    if (!payload || typeof payload.exp !== 'number' || Number.isNaN(payload.exp)) {
      return null;
    }

    return payload.exp;
  }

  export function resolveRefreshWindowByTokenLifetime(
    token: string | null,
    fallbackRefreshWindowSeconds: number,
    refreshWindowPercent: number,
    refreshWindowMinSeconds: number,
    refreshWindowMaxSeconds: number,
  ): number {
    const payload = readJwtPayload(token);
    if (!payload || typeof payload.exp !== 'number' || typeof payload.iat !== 'number') {
      return fallbackRefreshWindowSeconds;
    }

    const tokenLifetimeSeconds = payload.exp - payload.iat;
    if (!Number.isFinite(tokenLifetimeSeconds) || tokenLifetimeSeconds <= 0) {
      return fallbackRefreshWindowSeconds;
    }

    const calculatedWindowSeconds = Math.floor(tokenLifetimeSeconds * (refreshWindowPercent / 100));
    return Math.min(
      refreshWindowMaxSeconds,
      Math.max(refreshWindowMinSeconds, calculatedWindowSeconds),
    );
  }

  export function shouldRefreshTokenByExp(token: string | null, refreshWindowSeconds: number): boolean {
    const tokenExp = readJwtExpiryEpochSeconds(token);
    if (tokenExp === null) {
      return true;
    }

    const nowEpochSeconds = Math.floor(Date.now() / 1000);
    const remainingSeconds = tokenExp - nowEpochSeconds;
    return remainingSeconds <= refreshWindowSeconds;
  }