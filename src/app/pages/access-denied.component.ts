import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { EMPTY, catchError } from 'rxjs';

import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'app-access-denied',
  standalone: true,
  templateUrl: './access-denied.component.html',
  styleUrl: './access-denied.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessDeniedComponent {
  readonly authService = inject(AuthService);

  signOut(): void {
    this.authService
      .logout$()
      .pipe(catchError(() => EMPTY))
      .subscribe();
  }
}
