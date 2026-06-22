import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../auth/auth.service';
import {
  ApiErrorEnvelope,
  CreateTenantRequest,
  TenantStatus,
  UpdateTenantRequest,
} from './tenant.models';
import { TenantService } from './tenant.service';

@Component({
  selector: 'app-tenant-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './tenant-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TenantFormComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tenantService = inject(TenantService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly tenantId = this.route.snapshot.paramMap.get('id');
  readonly isEditMode = this.tenantId !== null;
  readonly loading = signal(this.isEditMode);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly accessDenied = signal(false);
  readonly notFound = signal(false);

  readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    slug: ['', [Validators.minLength(2), Validators.maxLength(63)]],
    description: ['', [Validators.maxLength(1000)]],
    status: ['active' as TenantStatus, [Validators.required]],
  });

  ngOnInit(): void {
    if (!this.tenantId) {
      return;
    }

    this.form.controls.slug.disable();
    this.tenantService
      .get(this.tenantId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tenant) => {
          this.form.reset({
            name: tenant.name,
            slug: tenant.slug,
            description: tenant.description,
            status: tenant.status,
          });
          this.form.controls.slug.disable();
          this.loading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.loading.set(false);
          this.handleHttpError(error, 'Unable to load the tenant.');
        },
      });
  }

  submit(): void {
    this.formError.set(null);
    this.clearSlugConflict();
    this.form.markAllAsTouched();

    if (!this.form.controls.name.value.trim()) {
      this.form.controls.name.setErrors({ ...this.form.controls.name.errors, required: true });
    }

    if (this.form.invalid || this.saving()) {
      return;
    }

    this.saving.set(true);
    const values = this.form.getRawValue();
    const request$ = this.isEditMode
      ? this.tenantService.update(this.tenantId!, this.toUpdateRequest(values))
      : this.tenantService.create(this.toCreateRequest(values));

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => void this.router.navigateByUrl('/admin/tenants'),
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        if (!this.isEditMode && error.status === 409) {
          const message = this.apiMessage(error) ?? 'This slug is already in use.';
          this.form.controls.slug.setErrors({
            ...this.form.controls.slug.errors,
            conflict: message,
          });
          this.formError.set(message);
          return;
        }
        this.handleHttpError(error, 'Unable to save the tenant.');
      },
    });
  }

  nameError(): string | null {
    const control = this.form.controls.name;
    if (!control.touched || !control.errors) {
      return null;
    }
    if (control.hasError('required')) {
      return 'Name is required.';
    }
    return control.hasError('maxlength') ? 'Name must be 120 characters or fewer.' : null;
  }

  slugError(): string | null {
    const control = this.form.controls.slug;
    if (!control.touched || !control.errors) {
      return null;
    }
    if (typeof control.getError('conflict') === 'string') {
      return control.getError('conflict') as string;
    }
    if (control.hasError('minlength') || control.hasError('maxlength')) {
      return 'Slug must be 2 to 63 characters when provided.';
    }
    return null;
  }

  descriptionError(): string | null {
    const control = this.form.controls.description;
    return control.touched && control.hasError('maxlength')
      ? 'Description must be 1000 characters or fewer.'
      : null;
  }

  private toCreateRequest(values: typeof this.form.value): CreateTenantRequest {
    const slug = values.slug?.trim();
    const description = values.description?.trim();
    return {
      name: values.name!.trim(),
      ...(slug ? { slug } : {}),
      ...(description ? { description } : {}),
    };
  }

  private toUpdateRequest(values: typeof this.form.value): UpdateTenantRequest {
    return {
      name: values.name!.trim(),
      description: values.description?.trim() ?? '',
      status: values.status,
    };
  }

  private handleHttpError(error: HttpErrorResponse, fallback: string): void {
    if (error.status === 401) {
      this.authService
        .login$({ forcePrompt: true, redirectUri: window.location.href })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          error: () => this.formError.set('Your session expired. Please sign in again.'),
        });
      return;
    }

    if (error.status === 403) {
      this.accessDenied.set(true);
      return;
    }

    if (error.status === 404) {
      this.notFound.set(true);
      this.formError.set('This tenant no longer exists.');
      return;
    }

    this.formError.set(this.apiMessage(error) ?? fallback);
  }

  private apiMessage(error: HttpErrorResponse): string | null {
    const body = error.error as Partial<ApiErrorEnvelope> | null;
    return typeof body?.error?.message === 'string' ? body.error.message : null;
  }

  private clearSlugConflict(): void {
    const control = this.form.controls.slug;
    if (!control.hasError('conflict')) {
      return;
    }
    const { conflict: _, ...remainingErrors } = control.errors ?? {};
    control.setErrors(Object.keys(remainingErrors).length > 0 ? remainingErrors : null);
  }
}
