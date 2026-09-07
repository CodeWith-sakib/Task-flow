import * as crypto from 'crypto';
import { KMSProvider } from './KMSProvider';

export interface EncryptedEnvelope {
  encryptedDek: string; // Base64 encoded encrypted DEK
  iv: string;           // Base64 encoded 12-byte IV for payload
  authTag: string;      // Base64 encoded 16-byte GCM tag
  ciphertext: string;   // Base64 encoded payload ciphertext
  keyVersion: number;
  algorithm: 'AES-256-GCM';
}

/**
 * EnvelopeEncryption implements two-tier envelope encryption.
 * Generates an ephemeral 256-bit Data Encryption Key (DEK) for each payload, encrypts the payload
 * with AES-256-GCM, and encrypts the DEK using the Key Management Service's Key Encryption Key (KEK).
 */
export class EnvelopeEncryption {
  private kms: KMSProvider;

  constructor(kms: KMSProvider) {
    this.kms = kms;
  }

  public encrypt(plaintext: string | Buffer): EncryptedEnvelope {
    const rawBuffer = typeof plaintext === 'string' ? Buffer.from(plaintext, 'utf8') : plaintext;

    // 1. Generate ephemeral DEK (32 bytes = 256 bits)
    const dek = crypto.randomBytes(32);

    // 2. Encrypt payload with DEK using AES-256-GCM
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);
    const ciphertext = Buffer.concat([cipher.update(rawBuffer), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // 3. Encrypt DEK with KMS KEK
    const { encryptedKey, keyVersion } = this.kms.encryptDataKey(dek);

    return {
      encryptedDek: encryptedKey.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      ciphertext: ciphertext.toString('base64'),
      keyVersion,
      algorithm: 'AES-256-GCM'
    };
  }

  public decrypt(envelope: EncryptedEnvelope): Buffer {
    if (envelope.algorithm !== 'AES-256-GCM') {
      throw new Error(`Unsupported encryption algorithm: ${envelope.algorithm}`);
    }

    // 1. Decrypt DEK using KMS KEK
    const encryptedDekBuf = Buffer.from(envelope.encryptedDek, 'base64');
    const dek = this.kms.decryptDataKey(encryptedDekBuf, envelope.keyVersion);

    // 2. Decrypt payload with DEK
    const iv = Buffer.from(envelope.iv, 'base64');
    const authTag = Buffer.from(envelope.authTag, 'base64');
    const ciphertext = Buffer.from(envelope.ciphertext, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', dek, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }

  public decryptString(envelope: EncryptedEnvelope): string {
    return this.decrypt(envelope).toString('utf8');
  }
}
