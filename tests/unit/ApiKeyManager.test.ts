import { ApiKeyManager } from '../../src/security/auth/ApiKeyManager';

describe('ApiKeyManager (Security & Auth)', () => {
  let manager: ApiKeyManager;

  beforeEach(() => {
    manager = new ApiKeyManager();
  });

  it('should generate an API key and authenticate successfully', () => {
    const { apiKey, record } = manager.createApiKey('Test Client', 'tenant_123', ['producer']);

    expect(apiKey).toMatch(/^tfk_live_[0-9a-f]{48}$/);
    expect(record.tenantId).toBe('tenant_123');

    const auth = manager.authenticate(apiKey);
    expect(auth.authenticated).toBe(true);
    expect(auth.tenantId).toBe('tenant_123');
    expect(auth.roles).toContain('producer');
  });

  it('should reject invalid or unrecognized API keys', () => {
    expect(manager.authenticate('invalid_key').authenticated).toBe(false);
    expect(manager.authenticate('tfk_live_000000000000000000000000000000000000000000000000').authenticated).toBe(false);
  });

  it('should reject revoked API keys', () => {
    const { apiKey, record } = manager.createApiKey('Revokable', 'tenant_abc');

    const revoked = manager.revokeKey(record.id);
    expect(revoked).toBe(true);

    const auth = manager.authenticate(apiKey);
    expect(auth.authenticated).toBe(false);
    expect(auth.error).toContain('revoked');
  });

  it('should check role hierarchies and permissions correctly', () => {
    expect(ApiKeyManager.hasRole(['admin'], 'producer')).toBe(true);
    expect(ApiKeyManager.hasRole(['admin'], 'consumer')).toBe(true);
    expect(ApiKeyManager.hasRole(['producer'], 'producer')).toBe(true);
    expect(ApiKeyManager.hasRole(['producer'], 'admin')).toBe(false);
  });
});
