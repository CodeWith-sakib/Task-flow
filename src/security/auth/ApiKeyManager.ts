import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { ApiKeyRecord, AuthContext, Role } from '../types';

export class ApiKeyManager {
  private keys: Map<string, ApiKeyRecord> = new Map(); // keyHash -> record
  private idToHash: Map<string, string> = new Map();

  private hashKey(key: string): string {
    return crypto.createHash('sha256').update(key, 'utf8').digest('hex');
  }

  createApiKey(
    name: string,
    tenantId: string,
    roles: Role[] = ['producer', 'consumer'],
    rateLimitPerMin: number = 600
  ): { apiKey: string; record: ApiKeyRecord } {
    const rawSecret = crypto.randomBytes(24).toString('hex');
    const apiKey = `tfk_live_${rawSecret}`;
    const keyHash = this.hashKey(apiKey);
    const prefix = apiKey.substring(0, 12);
    const id = `key_${uuidv4()}`;

    const record: ApiKeyRecord = {
      id,
      name,
      keyHash,
      prefix,
      roles,
      tenantId,
      rateLimitPerMin,
      createdAt: new Date(),
    };

    this.keys.set(keyHash, record);
    this.idToHash.set(id, keyHash);

    return { apiKey, record };
  }

  authenticate(apiKey: string): AuthContext {
    if (!apiKey || !apiKey.startsWith('tfk_live_')) {
      return { authenticated: false, error: 'Invalid API key format' };
    }

    const keyHash = this.hashKey(apiKey);
    const record = this.keys.get(keyHash);

    if (!record) {
      return { authenticated: false, error: 'API key not found' };
    }

    if (record.revokedAt) {
      return { authenticated: false, error: 'API key has been revoked' };
    }

    return {
      authenticated: true,
      tenantId: record.tenantId,
      roles: record.roles,
      keyId: record.id,
    };
  }

  revokeKey(id: string): boolean {
    const hash = this.idToHash.get(id);
    if (!hash) return false;

    const record = this.keys.get(hash);
    if (!record) return false;

    record.revokedAt = new Date();
    return true;
  }

  static hasRole(roles: Role[] = [], required: Role): boolean {
    if (roles.includes('admin')) return true; // Admin has all permissions
    return roles.includes(required);
  }
}
