import * as crypto from 'crypto';

export type EncryptionMode = 'DETERMINISTIC' | 'RANDOMIZED';

/**
 * FieldLevelEncryptor provides column-level and document-level encryption
 * with deterministic hashing for equality searches and randomized AES-GCM for sensitive fields.
 */
export class FieldLevelEncryptor {
  private key: Buffer;

  constructor(secretKey: string | Buffer) {
    if (typeof secretKey === 'string') {
      this.key = crypto.createHash('sha256').update(secretKey).digest();
    } else {
      this.key = secretKey;
    }
  }

  public encryptField(plaintext: string, mode: EncryptionMode = 'RANDOMIZED'): string {
    if (mode === 'DETERMINISTIC') {
      // Deterministic: Fixed IV derived from HMAC of plaintext
      const iv = crypto.createHmac('sha256', this.key).update(plaintext).digest().slice(0, 12);
      const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
      const ciphertext = Buffer.concat([cipher.update(Buffer.from(plaintext, 'utf8')), cipher.final()]);
      const tag = cipher.getAuthTag();

      return `det:${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
    } else {
      // Randomized: Ephemeral random IV
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
      const ciphertext = Buffer.concat([cipher.update(Buffer.from(plaintext, 'utf8')), cipher.final()]);
      const tag = cipher.getAuthTag();

      return `rnd:${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
    }
  }

  public decryptField(encryptedStr: string): string {
    const parts = encryptedStr.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid encrypted field format');
    }

    const [, ivB64, tagB64, cipherB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const ciphertext = Buffer.from(cipherB64, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  }

  public encryptObject(obj: Record<string, any>, fieldsToEncrypt: string[]): Record<string, any> {
    const result = { ...obj };
    for (const field of fieldsToEncrypt) {
      if (result[field] !== undefined && result[field] !== null) {
        result[field] = this.encryptField(String(result[field]));
      }
    }
    return result;
  }

  public decryptObject(obj: Record<string, any>, encryptedFields: string[]): Record<string, any> {
    const result = { ...obj };
    for (const field of encryptedFields) {
      if (typeof result[field] === 'string' && (result[field].startsWith('det:') || result[field].startsWith('rnd:'))) {
        result[field] = this.decryptField(result[field]);
      }
    }
    return result;
  }
}
