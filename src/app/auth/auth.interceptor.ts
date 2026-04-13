import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';

import { RUNTIME_ENV } from '../config/runtime-env';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);
  const runtimeEnv = inject(RUNTIME_ENV);

  if (request.url.startsWith(runtimeEnv.keycloakUrl)) {
    return next(request);
  }

  return from(authService.getAccessToken(300)).pipe(
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