import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { Location } from '@angular/common';
import { AuthService } from '../auth/auth.service';
import { RUNTIME_ENV } from '../config/runtime-env';

@Component({
  selector: 'app-admin-home',
  standalone: true,
  imports: [],
  template: `
    <div class="admin-wrapper">
      <main class="admin-layout">
        <header class="admin-header">
          <div class="brand-block">
            <span class="logo-dot"></span>
            <h1>Admin Dashboard</h1>
          </div>

          <div class="header-actions">
            @if (websiteUrl) {
              <a
                [href]="websiteUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="btn-secondary"
              >View Site</a>
            } @else {
              <span class="btn-secondary disabled" aria-disabled="true" tabindex="-1">View Site</span>
            }
            <button type="button" (click)="logout()" class="btn-primary">Sign out</button>
          </div>
        </header>

        <div class="admin-body">
          <aside class="admin-sidebar">
            <p class="sidebar-label">Main Menu</p>
            <nav>
              <button class="nav-item active" type="button" tabindex="0" aria-current="page">
                <span class="icon">⊞</span> Dashboard
              </button>
            </nav>
          </aside>

          <section class="admin-content">
            <div class="hero-panel">
              <div class="hero-text">
                <p class="hero-kicker">Welcome back</p>
                <h2>{{ authService.displayName() ?? 'Administrator' }}</h2>
                <p class="intro">Live Keycloak session & role monitoring</p>
              </div>
            </div>

            <div class="stat-grid">
              <article class="stat-card">
                <p class="stat-label">Authentication</p>
                <div class="stat-value" [class.status-ok]="authService.isAuthenticated()">
                  {{ authService.isAuthenticated() ? 'Verified' : 'Inactive' }}
                </div>
              </article>
              
              <article class="stat-card">
                <p class="stat-label">Admin Role</p>
                <div class="stat-value" [class.status-ok]="authService.hasAdminRole()">
                  {{ authService.hasAdminRole() ? 'Granted' : 'Missing' }}
                </div>
              </article>

              <article class="stat-card">
                <p class="stat-label">Current Identity</p>
                <div class="stat-value identity">{{ authService.displayName() ?? 'Guest' }}</div>
              </article>
            </div>
          </section>
        </div>
      </main>
    </div>
  `,
  styles: [`
    :host { --accent: #0f766e; --accent-soft: #f0fdfa; --border: #e2e8f0; --bg-panel: #ffffff; }

    .admin-wrapper {
      min-height: 100vh;
      background-color: #f8fafc;
      padding: 1.5rem 1rem;
    }

    .admin-layout {
      max-width: 1100px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    /* Header Styling */
    .admin-header {
      background: var(--bg-panel);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 0.75rem 1.25rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }

    .brand-block { display: flex; align-items: center; gap: 0.75rem; }
    .logo-dot { width: 10px; height: 10px; background: var(--accent); border-radius: 50%; }
    h1 { font-size: 1rem; font-weight: 700; margin: 0; color: #1e293b; }

    .header-actions { display: flex; gap: 0.5rem; }
    .btn-primary, .btn-secondary {
      padding: 0.5rem 1rem;
      border-radius: 8px;
      font-size: 0.8rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      text-decoration: none;
    }
    .btn-primary { background: #1e293b; color: white; border: none; }
    .btn-primary:hover { background: #0f172a; }
    .btn-secondary { background: white; color: #475569; border: 1px solid var(--border); }
    .btn-secondary:hover { background: #f1f5f9; }

    /* Body Layout */
    .admin-body {
      display: grid;
      grid-template-columns: 240px 1fr;
      gap: 1rem;
      align-items: start;
    }

    /* Sidebar */
    .admin-sidebar {
      background: var(--bg-panel);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25rem;
    }
    .sidebar-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-bottom: 1rem; font-weight: 600; }
    
    .nav-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.65rem 0.85rem;
      border-radius: 8px;
      font-size: 0.9rem;
      color: #64748b;
      cursor: pointer;
      transition: 0.2s;
    }
    .nav-item:hover { background: #f8fafc; color: var(--accent); }
    .nav-item.active { background: var(--accent-soft); color: var(--accent); font-weight: 600; }
    .icon { font-size: 1.1rem; }

    /* Main Content */
    .admin-content { display: flex; flex-direction: column; gap: 1rem; }

    .hero-panel {
      background: linear-gradient(135deg, #0f766e 0%, #115e59 100%);
      color: white;
      border-radius: 12px;
      padding: 1.5rem;
      position: relative;
      overflow: hidden;
    }
    .hero-kicker { font-size: 0.75rem; opacity: 0.8; text-transform: uppercase; margin: 0; }
    h2 { font-size: 1.5rem; margin: 0.25rem 0; font-weight: 700; }
    .intro { font-size: 0.9rem; opacity: 0.9; margin: 0; }

    /* Stats Grid */
    .stat-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
    }
    .stat-card {
      background: white;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25rem;
    }
    .stat-label { font-size: 0.8rem; color: #64748b; margin: 0 0 0.5rem 0; }
    .stat-value { font-size: 1.1rem; font-weight: 700; color: #1e293b; }
    .status-ok { color: #059669; }
    .identity { font-size: 0.95rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    /* Floating Notification */
    .floating-notification {
      position: fixed;
      top: 32px;
      right: 32px;
      background: #fee2e2;
      color: #b91c1c;
      border: 1px solid #fca5a5;
      border-radius: 8px;
      padding: 1rem 1.5rem;
      font-size: 1rem;
      font-weight: 600;
      z-index: 9999;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      display: flex;
      align-items: center;
      gap: 0.75rem;
      animation: fadeIn 0.3s;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-16px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Responsive */
    @media (max-width: 850px) {
      .admin-body { grid-template-columns: 1fr; }
      .stat-grid { grid-template-columns: 1fr; }
    }
  `],
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