interface JwtPayload {
  exp?: number;
}

function decodeBase64Url(value: string): string {
  const paddedValue = value + '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = paddedValue.replace(/-/g, '+').replace(/_/g, '/');
  return atob(base64);
}

export function readJwtExpiryEpochSeconds(token: string | null): number | null {
  if (!token) {
    return null;
  }

  const tokenParts = token.split('.');
  if (tokenParts.length < 2) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(tokenParts[1])) as JwtPayload;
    if (typeof payload.exp !== 'number' || Number.isNaN(payload.exp)) {
      return null;
    }
    return payload.exp;
  } catch {
    return null;
  }
}

export function shouldRefreshTokenByExp(token: string | null, refreshWindowSeconds: number): boolean {
  const tokenExp = readJwtExpiryEpochSeconds(token);
  if (!tokenExp) {
    return true;
  }

  const nowEpochSeconds = Math.floor(Date.now() / 1000);
  return tokenExp - nowEpochSeconds <= refreshWindowSeconds;
}