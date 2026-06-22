import { inject } from '@angular/core';
import { CanMatchFn } from '@angular/router';
import { map } from 'rxjs';

import { RUNTIME_ENV } from '../config/runtime-env';
import { AuthService } from './auth.service';

export const tenantAdminMatchGuard: CanMatchFn = () => {
  const auth = inject(AuthService);
  const env = inject(RUNTIME_ENV);

  return auth.ensureInitialized$().pipe(map(() => auth.hasRole(env.tenantAdminRoleCrm)));
};
