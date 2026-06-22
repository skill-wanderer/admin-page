import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription, Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AuthService } from '../../auth/auth.service';
import { ApiErrorEnvelope, Tenant, TenantStatus } from './tenant.models';
import { TenantService } from './tenant.service';

@Component({
  selector: 'app-tenant-list',
  standalone: true,
  imports: [DatePipe, RouterLink],
  templateUrl: './tenant-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TenantListComponent implements OnInit {
  private readonly tenantService = inject(TenantService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly searchChanges = new Subject<string>();
  private listSubscription: Subscription | null = null;

  readonly tenants = signal<readonly Tenant[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly search = signal('');
  readonly status = signal<TenantStatus | undefined>(undefined);
  readonly loading = signal(false);
  readonly deletingId = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly accessDenied = signal(false);
  readonly totalPages = computed(() => Math.ceil(this.total() / this.pageSize()));
  readonly pageStart = computed(() =>
    this.total() === 0 ? 0 : (this.page() - 1) * this.pageSize() + 1,
  );
  readonly pageEnd = computed(() => Math.min(this.page() * this.pageSize(), this.total()));

  ngOnInit(): void {
    this.searchChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((query) => {
        this.search.set(query);
        this.page.set(1);
        this.loadTenants();
      });

    this.loadTenants();
  }

  onSearch(event: Event): void {
    this.searchChanges.next((event.target as HTMLInputElement).value);
  }

  onStatusChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.status.set(value === 'active' || value === 'suspended' ? value : undefined);
    this.page.set(1);
    this.loadTenants();
  }

  onPageSizeChange(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    this.pageSize.set(Math.min(100, Math.max(1, Number.isInteger(value) ? value : 20)));
    this.page.set(1);
    this.loadTenants();
  }

  previousPage(): void {
    if (this.page() <= 1 || this.loading()) {
      return;
    }
    this.page.update((page) => page - 1);
    this.loadTenants();
  }

  nextPage(): void {
    if (this.page() >= this.totalPages() || this.loading()) {
      return;
    }
    this.page.update((page) => page + 1);
    this.loadTenants();
  }

  retry(): void {
    this.loadTenants();
  }

  deleteTenant(tenant: Tenant): void {
    if (!window.confirm(`Delete “${tenant.name}”? This tenant will be soft-deleted.`)) {
      return;
    }

    this.deletingId.set(tenant.id);
    this.error.set(null);
    this.tenantService
      .remove(tenant.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deletingId.set(null);
          this.loadTenants();
        },
        error: (error: HttpErrorResponse) => {
          this.deletingId.set(null);
          if (error.status === 404) {
            this.loadTenants();
            return;
          }
          this.handleHttpError(error, 'Unable to delete the tenant.');
        },
      });
  }

  private loadTenants(): void {
    this.listSubscription?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.accessDenied.set(false);

    this.listSubscription = this.tenantService
      .list({
        page: this.page(),
        pageSize: this.pageSize(),
        status: this.status(),
        q: this.search(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.tenants.set(result.data);
          this.total.set(result.total);
          this.page.set(result.page);
          this.pageSize.set(Math.min(100, result.pageSize));
          this.loading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.loading.set(false);
          this.tenants.set([]);
          this.total.set(0);
          this.handleHttpError(error, 'Unable to load tenants.');
        },
      });
  }

  private handleHttpError(error: HttpErrorResponse, fallback: string): void {
    if (error.status === 401) {
      this.authService
        .login$({ forcePrompt: true, redirectUri: window.location.href })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({ error: () => this.error.set('Your session expired. Please sign in again.') });
      return;
    }

    if (error.status === 403) {
      this.accessDenied.set(true);
      this.tenants.set([]);
      this.total.set(0);
      return;
    }

    this.error.set(this.apiMessage(error) ?? fallback);
  }

  private apiMessage(error: HttpErrorResponse): string | null {
    const body = error.error as Partial<ApiErrorEnvelope> | null;
    return typeof body?.error?.message === 'string' ? body.error.message : null;
  }
}
