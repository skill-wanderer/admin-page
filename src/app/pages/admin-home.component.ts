import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EMPTY, catchError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { RUNTIME_ENV } from '../config/runtime-env';

@Component({
  selector: 'app-admin-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-home.component.html',
  styleUrls: ['./admin-home.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminHomeComponent implements OnInit {
  readonly authService = inject(AuthService);
  readonly runtimeEnv = inject(RUNTIME_ENV);
  websiteUrl = '';

  ngOnInit(): void {
    this.websiteUrl = this.runtimeEnv.appWebsiteUrl;
  }

  logout(): void {
    this.authService
      .logout$()
      .pipe(catchError(() => EMPTY))
      .subscribe();
  }
}