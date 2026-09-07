/**
 * Envelope Key Derivation & Key Ring Management.
 * Implements HKDF (HMAC-based Extract-and-Expand Key Derivation Function, RFC 5869)
 * and versioned rotating key rings for tenant data isolation.
 */

import * as crypto from 'crypto';

export interface KeyRingEntry {
  keyId: string;
  version: number;
  masterKey: Buffer;
  createdAt: number;
  expiresAt?: number;
  deprecated?: boolean;
}

export class EnvelopeKeyDerivation {
  private keyRing = new Map<string, KeyRingEntry[]>();
  private activeKeyVersions = new Map<string, number>();

  public registerMasterKey(tenantId: string, version: number, masterSecret: string | Buffer): void {
    const keyBuf = Buffer.isBuffer(masterSecret) ? masterSecret : Buffer.from(masterSecret, 'utf-8');
    const entry: KeyRingEntry = {
      keyId: `${tenantId}-v${version}`,
      version,
      masterKey: keyBuf,
      createdAt: Date.now(),
    };

    let entries = this.keyRing.get(tenantId);
    if (!entries) {
      entries = [];
      this.keyRing.set(tenantId, entries);
    }

    entries.push(entry);
    this.activeKeyVersions.set(tenantId, version);
  }

  /**
   * Derives a unique Data Encryption Key (DEK) using HKDF.
   */
  public deriveDataKey(tenantId: string, context: string, keyLength: number = 32): { dek: Buffer; keyVersion: number } {
    const version = this.activeKeyVersions.get(tenantId);
    if (version === undefined) {
      throw new Error(`No active master key registered for tenant ${tenantId}`);
    }

    const masterKeyEntry = this.getKeyByVersion(tenantId, version);
    if (!masterKeyEntry) {
      throw new Error(`Master key version ${version} not found for tenant ${tenantId}`);
    }

    const salt = crypto.randomBytes(16);
    const dek = this.hkdf(masterKeyEntry.masterKey, salt, Buffer.from(context, 'utf-8'), keyLength);

    return { dek, keyVersion: version };
  }

  /**
   * Derives the specific DEK for decryption using the historical key version.
   */
  public deriveHistoricalKey(
    tenantId: string,
    version: number,
    salt: Buffer,
    context: string,
    keyLength: number = 32
  ): Buffer {
    const masterKeyEntry = this.getKeyByVersion(tenantId, version);
    if (!masterKeyEntry) {
      throw new Error(`Master key version ${version} not found for tenant ${tenantId}`);
    }

    return this.hkdf(masterKeyEntry.masterKey, salt, Buffer.from(context, 'utf-8'), keyLength);
  }

  /**
   * RFC 5869 HKDF Implementation.
   */
  public hkdf(ikm: Buffer, salt: Buffer, info: Buffer, length: number): Buffer {
    // 1. Extract: PRK = HMAC-Hash(salt, IKM)
    const prk = crypto.createHmac('sha256', salt.length === 0 ? Buffer.alloc(32) : salt).update(ikm).digest();

    // 2. Expand: OKM = HMAC-Hash(PRK, info || 0x01) || ...
    const chunks: Buffer[] = [];
    let t: any = Buffer.alloc(0);
    let counter = 1;
    let totalLen = 0;

    while (totalLen < length) {
      const hmac = crypto.createHmac('sha256', prk);
      hmac.update(t);
      hmac.update(info);
      hmac.update(Buffer.from([counter]));
      t = hmac.digest();
      chunks.push(t);
      totalLen += t.length;
      counter++;
    }

    const full = Buffer.concat(chunks);
    return full.slice(0, length);
  }

  private getKeyByVersion(tenantId: string, version: number): KeyRingEntry | undefined {
    const entries = this.keyRing.get(tenantId);
    if (!entries) return undefined;
    return entries.find((e) => e.version === version);
  }
}
