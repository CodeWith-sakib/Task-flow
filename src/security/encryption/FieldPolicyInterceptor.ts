/**
 * Transparent Field-Level Encryption & Redaction Policy Interceptor.
 * Inspects incoming and outgoing payloads, applying AES-GCM encryption
 * to designated sensitive paths (PII, credentials, payment info) and role-based masking.
 */

import { FieldLevelEncryptor } from './FieldLevelEncryptor';

export interface FieldSecurityPolicy {
  tenantId: string;
  encryptedFields: string[]; // Dot-notated paths, e.g. "user.ssn", "payment.cardNumber"
  maskedFields: Record<string, (val: any) => string>; // Dot-notated path -> mask transform
}

export class FieldPolicyInterceptor {
  private encryptors = new Map<string, FieldLevelEncryptor>();
  private policies = new Map<string, FieldSecurityPolicy>();
  private defaultSecret: string;

  constructor(defaultSecret: string = 'taskflow-master-secret-key-32b!') {
    this.defaultSecret = defaultSecret;
  }

  public registerPolicy(policy: FieldSecurityPolicy, secret?: string): void {
    this.policies.set(policy.tenantId, policy);
    this.encryptors.set(policy.tenantId, new FieldLevelEncryptor(secret || `${this.defaultSecret}:${policy.tenantId}`));
  }

  /**
   * Encrypts sensitive fields before persistence.
   */
  public interceptInbound(tenantId: string, payload: Record<string, any>): Record<string, any> {
    const policy = this.policies.get(tenantId);
    if (!policy) return payload;

    const encryptor = this.getOrCreateEncryptor(tenantId);
    const cloned = JSON.parse(JSON.stringify(payload));

    for (const fieldPath of policy.encryptedFields) {
      this.mutateField(cloned, fieldPath, (val) => {
        if (val === null || val === undefined) return val;
        return encryptor.encryptField(String(val));
      });
    }

    return cloned;
  }

  /**
   * Decrypts sensitive fields for authorized execution contexts.
   */
  public interceptOutbound(tenantId: string, payload: Record<string, any>, userRoles: string[] = []): Record<string, any> {
    const policy = this.policies.get(tenantId);
    if (!policy) return payload;

    const encryptor = this.getOrCreateEncryptor(tenantId);
    const cloned = JSON.parse(JSON.stringify(payload));

    // Decrypt encrypted fields
    for (const fieldPath of policy.encryptedFields) {
      this.mutateField(cloned, fieldPath, (val) => {
        if (typeof val === 'string' && (val.startsWith('det:') || val.startsWith('rnd:'))) {
          return encryptor.decryptField(val);
        }
        return val;
      });
    }

    // Apply masking if user is not ADMIN / PRIVILEGED
    const isPrivileged = userRoles.includes('ADMIN') || userRoles.includes('SECURITY_OFFICER');
    if (!isPrivileged && policy.maskedFields) {
      for (const [fieldPath, maskFn] of Object.entries(policy.maskedFields)) {
        this.mutateField(cloned, fieldPath, maskFn);
      }
    }

    return cloned;
  }

  private getOrCreateEncryptor(tenantId: string): FieldLevelEncryptor {
    let enc = this.encryptors.get(tenantId);
    if (!enc) {
      enc = new FieldLevelEncryptor(`${this.defaultSecret}:${tenantId}`);
      this.encryptors.set(tenantId, enc);
    }
    return enc;
  }

  private mutateField(obj: any, path: string, transform: (val: any) => any): void {
    const parts = path.split('.');
    let curr = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      if (!curr || typeof curr !== 'object') return;
      curr = curr[parts[i]];
    }

    const lastKey = parts[parts.length - 1];
    if (curr && typeof curr === 'object' && lastKey in curr) {
      curr[lastKey] = transform(curr[lastKey]);
    }
  }
}
