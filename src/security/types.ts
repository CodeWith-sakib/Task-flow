export type Role = 'admin' | 'producer' | 'consumer' | 'auditor';

export interface ApiKeyRecord {
  id: string;
  name: string;
  keyHash: string;
  prefix: string;
  roles: Role[];
  tenantId: string;
  rateLimitPerMin: number;
  createdAt: Date;
  revokedAt?: Date;
}

export interface TenantQuota {
  tenantId: string;
  maxConcurrentTasks: number;
  maxDailyTasks: number;
  maxPayloadBytes: number;
}

export interface AuthContext {
  authenticated: boolean;
  tenantId?: string;
  roles?: Role[];
  keyId?: string;
  error?: string;
}
