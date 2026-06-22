import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { RUNTIME_ENV } from '../../config/runtime-env';
import {
  CreateTenantRequest,
  Tenant,
  TenantListQuery,
  TenantListResult,
  UpdateTenantRequest,
} from './tenant.models';

@Injectable({ providedIn: 'root' })
export class TenantService {
  private readonly http = inject(HttpClient);
  private readonly runtimeEnv = inject(RUNTIME_ENV);
  private readonly baseUrl = `${this.runtimeEnv.apiBaseUrlCrm.replace(/\/+$/, '')}/api/admin/tenants`;

  list(query: TenantListQuery): Observable<TenantListResult> {
    let params = new HttpParams()
      .set('page', Math.max(1, Math.floor(query.page)))
      .set('pageSize', Math.min(100, Math.max(1, Math.floor(query.pageSize))));

    if (query.status) {
      params = params.set('status', query.status);
    }

    const search = query.q?.trim();
    if (search) {
      params = params.set('q', search);
    }

    return this.http.get<TenantListResult>(this.baseUrl, { params });
  }

  get(id: string): Observable<Tenant> {
    return this.http.get<Tenant>(`${this.baseUrl}/${encodeURIComponent(id)}`);
  }

  create(body: CreateTenantRequest): Observable<Tenant> {
    return this.http.post<Tenant>(this.baseUrl, body);
  }

  update(id: string, body: UpdateTenantRequest): Observable<Tenant> {
    return this.http.put<Tenant>(`${this.baseUrl}/${encodeURIComponent(id)}`, body);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${encodeURIComponent(id)}`);
  }
}
