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
        if (this.authService.isAuthenticated() && this.authService.hasAdminRole()) {
          void this.router.navigateByUrl('/admin');
        }
      },
    });
  }

  loginWithSso(): void {
    this.isSubmitting.set(true);
    this.authService
      .login$()
      .pipe(
        catchError(() => EMPTY),
        finalize(() => this.isSubmitting.set(false)),
      )
      .subscribe();
  }

  loginWithGoogle(): void {
    this.isSubmitting.set(true);
    this.authService
      .loginWithGoogle$()
      .pipe(
        catchError(() => EMPTY),
        finalize(() => this.isSubmitting.set(false)),
      )
      .subscribe();
  }
}
