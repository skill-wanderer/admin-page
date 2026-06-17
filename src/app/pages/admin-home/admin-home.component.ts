import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EMPTY, catchError } from 'rxjs';
import { AuthService } from '../../auth/auth.service';
import { RUNTIME_ENV } from '../../config/runtime-env';

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
  readonly primaryNav = [
    { label: 'Overview', meta: 'Dashboard home', active: true },
    { label: 'Access control', meta: 'Roles and session' },
    { label: 'Content review', meta: 'Public surface' },
    { label: 'System health', meta: 'Runtime posture' },
  ];
  readonly supportNav = [
    { label: 'Audit trail', meta: 'Recent activity' },
    { label: 'Operator notes', meta: 'Admin guidance' },
  ];
  readonly currentShiftLabel = this.formatCurrentShift();
  readonly todayLabel = new Intl.DateTimeFormat('en', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());
  readonly quickActions = [
    {
      title: 'Review access state',
      detail: 'Verify SSO, admin role, and current operator identity before high-impact changes.',
    },
    {
      title: 'Open live website',
      detail: 'Jump to the public surface to validate content, links, and production-facing changes.',
    },
    {
      title: 'End privileged session',
      detail: 'Sign out immediately when admin work is complete or handed off to another operator.',
    },
  ];
  operationalChecks = [
    {
      title: 'Authentication gateway',
      state: 'Attention',
      note: 'Keycloak session is the gatekeeper for every protected admin route.',
    },
    {
      title: 'Authorization policy',
      state: 'Missing role',
      note: 'Only operators with the Admin realm role should remain inside this dashboard.',
    },
    {
      title: 'Runtime configuration',
      state: 'Pending',
      note: 'Runtime values should be present before using external links or environment-aware actions.',
    },
  ];
  readonly activityFeed = [
    {
      time: 'Just now',
      title: 'Privileged workspace verified',
      note: 'The current session passed authentication and role checks.',
    },
    {
      time: 'Today',
      title: 'Admin route monitoring active',
      note: 'Protected routes continue to validate access before rendering internal screens.',
    },
    {
      time: 'This session',
      title: 'Token refresh loop armed',
      note: 'Background refresh keeps the operator session available during active work.',
    },
  ];

  ngOnInit(): void {
    this.websiteUrl = this.runtimeEnv.appWebsiteUrl;
    this.operationalChecks = [
      {
        title: 'Authentication gateway',
        state: this.authService.isAuthenticated() ? 'Healthy' : 'Attention',
        note: 'Keycloak session is the gatekeeper for every protected admin route.',
      },
      {
        title: 'Authorization policy',
        state: this.authService.hasAdminRole() ? 'Enforced' : 'Missing role',
        note: 'Only operators with the Admin realm role should remain inside this dashboard.',
      },
      {
        title: 'Runtime configuration',
        state: this.websiteUrl ? 'Loaded' : 'Pending',
        note: 'Runtime values should be present before using external links or environment-aware actions.',
      },
    ];
  }

  logout(): void {
    this.authService
      .logout$()
      .pipe(catchError(() => EMPTY))
      .subscribe();
  }

  private formatCurrentShift(): string {
    const hour = new Date().getHours();
    if (hour < 12) {
      return 'Morning shift';
    }
    if (hour < 18) {
      return 'Day shift';
    }
    return 'Evening shift';
  }
}
