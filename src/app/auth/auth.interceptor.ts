import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { switchMap } from 'rxjs';
import { RUNTIME_ENV } from '../config/runtime-env';
import { AuthService } from './auth.service';
import { shouldRefreshTokenByExp } from './jwt-exp.middleware';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);
  const runtimeEnv = inject(RUNTIME_ENV);
  const refreshWindowSeconds = runtimeEnv.keycloakRefreshWindowSeconds;

  if (request.url.startsWith(runtimeEnv.keycloakUrl)) {
    return next(request);
  }

  return authService.ensureInitialized$().pipe(
    switchMap(() => {
      const cachedToken = authService.getCachedAccessToken();
      const minValiditySeconds = shouldRefreshTokenByExp(cachedToken, refreshWindowSeconds)
        ? refreshWindowSeconds
        : 0;

      return authService.getAccessToken$(minValiditySeconds);
    }),
    switchMap((token) => {
      if (!token) {
        return next(request);
      }
      return next(
        request.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`,
          },
        }),
      );
    }),
  );
};