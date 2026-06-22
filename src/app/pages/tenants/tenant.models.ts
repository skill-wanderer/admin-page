export type TenantStatus = 'active' | 'suspended';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  description: string;
  status: TenantStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TenantListQuery {
  page: number;
  pageSize: number;
  status?: TenantStatus;
  q?: string;
}

export interface TenantListResult {
  data: Tenant[];
  page: number;
  pageSize: number;
  total: number;
}

export interface CreateTenantRequest {
  name: string;
  slug?: string;
  description?: string;
}

export interface UpdateTenantRequest {
  name?: string;
  description?: string;
  status?: TenantStatus;
}

export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
  };
}
