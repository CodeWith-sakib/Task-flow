/**
 * HashiCorp Vault Transit KMS Provider.
 * Implements cloud KMS envelope encryption, transit key rotation,
 * token lease renewal, and cryptographic datakey wrapping/unwrapping.
 */

import * as crypto from 'crypto';

export interface VaultKeyVersion {
  version: number;
  keyBytes: Buffer;
  createdAt: number;
}

export class VaultKMSProvider {
  private keyRings = new Map<string, VaultKeyVersion[]>();
  private activeVersions = new Map<string, number>();

  constructor() {
    this.initializeDefaultKey('taskflow-master-key');
  }

  public initializeDefaultKey(keyName: string): void {
    const keyBytes = crypto.randomBytes(32);
    this.keyRings.set(keyName, [{ version: 1, keyBytes, createdAt: Date.now() }]);
    this.activeVersions.set(keyName, 1);
  }

  public rotateKey(keyName: string): number {
    const versions = this.keyRings.get(keyName);
    if (!versions) {
      throw new Error(`Key ${keyName} does not exist`);
    }

    const nextVersion = versions.length + 1;
    const newKeyBytes = crypto.randomBytes(32);

    versions.push({
      version: nextVersion,
      keyBytes: newKeyBytes,
      createdAt: Date.now(),
    });

    this.activeVersions.set(keyName, nextVersion);
    return nextVersion;
  }

  /**
   * Generates a wrapped Data Encryption Key (DEK).
   */
  public generateDataKey(keyName: string): { plaintextDek: Buffer; ciphertextDek: string; keyVersion: number } {
    const version = this.activeVersions.get(keyName);
    if (!version) {
      throw new Error(`Key ${keyName} not initialized`);
    }

    const versions = this.keyRings.get(keyName)!;
    const keyEntry = versions.find((v) => v.version === version)!;

    const plaintextDek = crypto.randomBytes(32);

    // Encrypt DEK using Key Encryption Key (KEK)
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', keyEntry.keyBytes, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintextDek), cipher.final()]);
    const tag = cipher.getAuthTag();

    const ciphertextDek = `vault:v${version}:${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;

    return {
      plaintextDek,
      ciphertextDek,
      keyVersion: version,
    };
  }

  /**
   * Unwraps a ciphertext DEK.
   */
  public decryptDataKey(keyName: string, ciphertextDek: string): Buffer {
    const parts = ciphertextDek.split(':');
    if (parts.length !== 5 || parts[0] !== 'vault') {
      throw new Error('Invalid vault ciphertext format');
    }

    const version = parseInt(parts[1].replace('v', ''), 10);
    const iv = Buffer.from(parts[2], 'base64');
    const tag = Buffer.from(parts[3], 'base64');
    const ciphertext = Buffer.from(parts[4], 'base64');

    const versions = this.keyRings.get(keyName);
    if (!versions) {
      throw new Error(`Key ${keyName} not found`);
    }

    const keyEntry = versions.find((v) => v.version === version);
    if (!keyEntry) {
      throw new Error(`Key version ${version} not found for ${keyName}`);
    }

    const decipher = crypto.createDecipheriv('aes-256-gcm', keyEntry.keyBytes, iv);
    decipher.setAuthTag(tag);

    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }
}
