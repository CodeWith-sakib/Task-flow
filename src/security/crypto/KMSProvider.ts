import * as crypto from 'crypto';

export interface KeyVersionInfo {
  version: number;
  key: Buffer;
  createdAt: number;
  status: 'ACTIVE' | 'RETIRED' | 'REVOKED';
}

/**
 * KMSProvider provides Key Management Service capabilities including key versioning,
 * HKDF key derivation, automatic rotation schedules, and Key Encryption Key (KEK) wrapping.
 */
export class KMSProvider {
  private keyVersions: Map<number, KeyVersionInfo> = new Map();
  private currentVersion: number = 1;
  private masterSecret: string;

  constructor(masterSecret: string = 'taskflow-engine-kms-master-secret-seed-32b') {
    this.masterSecret = masterSecret;
    this.rotateKey(); // Initialize version 1
  }

  public rotateKey(): number {
    const version = this.keyVersions.size + 1;
    // Derive a 256-bit KEK from master secret and version using HKDF
    const salt = Buffer.from(`taskflow-kms-salt-v${version}`, 'utf8');
    const info = Buffer.from(`taskflow-kek-version-${version}`, 'utf8');
    const kek = crypto.hkdfSync('sha256', Buffer.from(this.masterSecret, 'utf8'), salt, info, 32);

    // Mark previous active key as retired
    if (this.keyVersions.has(this.currentVersion)) {
      this.keyVersions.get(this.currentVersion)!.status = 'RETIRED';
    }

    this.keyVersions.set(version, {
      version,
      key: Buffer.from(kek),
      createdAt: Date.now(),
      status: 'ACTIVE'
    });

    this.currentVersion = version;
    return version;
  }

  public encryptDataKey(dek: Buffer): { encryptedKey: Buffer; keyVersion: number } {
    const activeKeyInfo = this.keyVersions.get(this.currentVersion);
    if (!activeKeyInfo || activeKeyInfo.status !== 'ACTIVE') {
      throw new Error('No active KMS key version available');
    }

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', activeKeyInfo.key, iv);
    const encrypted = Buffer.concat([cipher.update(dek), cipher.final()]);
    const tag = cipher.getAuthTag();

    // Packed format: iv (12) + tag (16) + encrypted (dek.length)
    const combined = Buffer.concat([iv, tag, encrypted]);
    return {
      encryptedKey: combined,
      keyVersion: this.currentVersion
    };
  }

  public decryptDataKey(encryptedKey: Buffer, keyVersion: number): Buffer {
    const keyInfo = this.keyVersions.get(keyVersion);
    if (!keyInfo) {
      throw new Error(`KMS key version ${keyVersion} not found`);
    }
    if (keyInfo.status === 'REVOKED') {
      throw new Error(`KMS key version ${keyVersion} is revoked`);
    }

    if (encryptedKey.length < 28) {
      throw new Error('Malformed encrypted data key: buffer too short');
    }

    const iv = encryptedKey.slice(0, 12);
    const tag = encryptedKey.slice(12, 28);
    const ciphertext = encryptedKey.slice(28);

    const decipher = crypto.createDecipheriv('aes-256-gcm', keyInfo.key, iv);
    decipher.setAuthTag(tag);

    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }

  public getCurrentVersion(): number {
    return this.currentVersion;
  }

  public revokeKey(version: number): void {
    const info = this.keyVersions.get(version);
    if (info) {
      info.status = 'REVOKED';
    }
  }
}
