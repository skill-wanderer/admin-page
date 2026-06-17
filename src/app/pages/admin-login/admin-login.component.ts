import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { EMPTY, catchError, finalize } from 'rxjs';

import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-login.component.html',
  styleUrl: './admin-login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLoginComponent implements OnInit {
  private readonly router = inject(Router);
  readonly authService = inject(AuthService);
  readonly isSubmitting = signal(false);
  readonly hasNoAdminRole = signal(false);

  ngOnInit(): void {
    this.hasNoAdminRole.set(localStorage.getItem('no-admin-role') === 'true');

    this.authService.ensureInitialized$().subscribe({
      next: () => {
        if (!this.authService.isAuthenticated()) {
          return;
        }

        if (this.isAuthCallbackRequest() && this.authService.hasAdminRole()) {
          void this.router.navigateByUrl('/admin');
          return;
        }

        this.logoutFromLandingPage();
      },
    });
  }

  loginWithSso(): void {
    this.isSubmitting.set(true);
    this.authService
      .login$({ forcePrompt: true })
      .pipe(
        catchError(() => EMPTY),
        finalize(() => this.isSubmitting.set(false)),
      )
      .subscribe();
  }

  private logoutFromLandingPage(): void {
    this.authService
      .logout$()
      .pipe(catchError(() => EMPTY))
      .subscribe();
  }

  private isAuthCallbackRequest(): boolean {
    const callbackPayload = `${window.location.search}&${window.location.hash}`;
    return ['code=', 'state=', 'session_state=', 'iss='].some((fragment) =>
      callbackPayload.includes(fragment),
    );
  }
}
