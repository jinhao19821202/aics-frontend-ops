import { http } from './http';

export interface OpsUser {
  id: number;
  username: string;
  displayName: string;
  role: string;
}

export interface LoginResp {
  accessToken: string;
  refreshToken: string;
  user: OpsUser;
}

export interface TenantView {
  id: number;
  code: string;
  name: string;
  status: string;
  plan: string;
  quotaKbDocs: number;
  quotaMonthlyTokens: number;
  contactName?: string;
  contactPhone?: string;
  milvusCollection?: string;
  embeddingDim?: number;
  reindexStatus?: string;
  reindexLastError?: string;
}

export interface TenantPatch {
  plan?: string;
  status?: string;
  quotaKbDocs?: number;
  quotaMonthlyTokens?: number;
  contactName?: string;
  contactPhone?: string;
}

export interface TenantCreateAdmin {
  username: string;
  displayName?: string;
  password?: string;
  mustChangePassword?: boolean;
}

export interface TenantCreateLlmEntry {
  provider?: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
  embeddingDim?: number;
}

export interface TenantCreateLlm {
  mode: 'self' | 'managed';
  chat?: TenantCreateLlmEntry;
  embedding?: TenantCreateLlmEntry;
}

export interface TenantCreateRequest {
  code: string;
  name: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  plan: string;
  status?: 'active' | 'trial';
  quotaKbDocs?: number;
  quotaMonthlyTokens?: number;
  admin: TenantCreateAdmin;
  llm?: TenantCreateLlm;
}

export interface TenantCreateAdminInfo {
  id: number;
  username: string;
  displayName?: string;
  generatedPassword?: string;
}

export interface TenantCreateLlmInfo {
  id: number;
  provider: string;
  purpose: string;
  model: string;
  apiKeyTail?: string;
  embeddingDim?: number;
}

export interface TenantCreateResponse {
  tenant: TenantView;
  admin: TenantCreateAdminInfo;
  llm: TenantCreateLlmInfo[];
  milvusProvisioned: boolean;
  loginUrl: string;
}

export interface ModelBreakdown {
  model: string;
  callCount: number;
  tokens: number;
}

export interface TenantUsage {
  tenantId: number;
  tenantCode: string;
  tenantName: string;
  status: string;
  plan: string;
  quotaMonthlyTokens: number;
  callCount: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  handoffCount: number;
  avgLatencyMs: number;
  quotaUtilization: number;
  byModel: ModelBreakdown[];
}

export interface BillingPeriod {
  id: number;
  tenantId: number;
  periodYear: number;
  periodMonth: number;
  totalCalls: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  amount: number | string;
  currency: string;
  modelBreakdown?: Array<{ model: string; calls: number; tokens: number; pricePer1k: number; amount: number | string }>;
  generatedAt: string;
  note?: string;
}

export interface AuditLog {
  id: number;
  actorId?: number;
  actorUsername?: string;
  action: string;
  targetType: string;
  targetKey?: string;
  beforeVal?: Record<string, unknown>;
  afterVal?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  createdAt: string;
}

export const authApi = {
  login: (username: string, password: string) =>
    http.post<LoginResp, LoginResp>('/ops/auth/login', { username, password }),
  refresh: (refreshToken: string) =>
    http.post<{ accessToken: string }, { accessToken: string }>('/ops/auth/refresh', { refreshToken }),
  me: () => http.get<OpsUser, OpsUser>('/ops/auth/me'),
};

export const tenantApi = {
  list: () => http.get<TenantView[], TenantView[]>('/ops/tenants'),
  detail: (id: number) => http.get<TenantView, TenantView>(`/ops/tenants/${id}`),
  update: (id: number, body: TenantPatch) => http.patch<TenantView, TenantView>(`/ops/tenants/${id}`, body),
  create: (body: TenantCreateRequest) =>
    http.post<TenantCreateResponse, TenantCreateResponse>('/ops/tenants', body),
  resetAdminPassword: (tenantId: number, userId: number) =>
    http.post<{ password: string }, { password: string }>(
      `/ops/tenants/${tenantId}/admin/${userId}/reset-password`,
      null,
    ),
};

export const billingApi = {
  usage: (from?: string, to?: string, tenantId?: number) =>
    http.get<TenantUsage[], TenantUsage[]>('/ops/billing/usage', { params: { from, to, tenantId } }),
  exportUrl: (from?: string, to?: string, tenantId?: number) => {
    const sp = new URLSearchParams();
    if (from) sp.set('from', from);
    if (to) sp.set('to', to);
    if (tenantId) sp.set('tenantId', String(tenantId));
    return `/api/ops/billing/usage/export.csv?${sp.toString()}`;
  },
  settle: (year: number, month: number) =>
    http.post<BillingPeriod[], BillingPeriod[]>('/ops/billing/settle', null, { params: { year, month } }),
  periods: (params: { year?: number; month?: number; tenantId?: number }) =>
    http.get<BillingPeriod[], BillingPeriod[]>('/ops/billing/periods', { params }),
};

export const auditApi = {
  list: (params: { action?: string; actorId?: number; from?: string; to?: string; page?: number; size?: number }) =>
    http.get<{ total: number; items: AuditLog[] }, { total: number; items: AuditLog[] }>('/ops/audit', { params }),
};
