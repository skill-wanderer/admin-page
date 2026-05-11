import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Location } from '@angular/common';
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
  showNoAdminRole = false;


  constructor() {
    const location = inject(Location);
    const url = new URL(window.location.href);
    const oauthParams = ['code', 'state', 'session_state', 'iss'];
    if (oauthParams.some(p => url.searchParams.has(p))) {
      oauthParams.forEach(p => url.searchParams.delete(p));
      location.replaceState(url.pathname + url.search);
    }
  }

  ngOnInit(): void {
    this.websiteUrl = this.runtimeEnv.appWebsiteUrl;
    // Kiểm tra cờ thiếu quyền
    if (localStorage.getItem('no-admin-role')) {
      this.showNoAdminRole = true;
      localStorage.removeItem('no-admin-role');
      setTimeout(() => { this.showNoAdminRole = false; }, 5000);
    }
  }

  async logout(): Promise<void> {
    await this.authService.logout();
  }
}