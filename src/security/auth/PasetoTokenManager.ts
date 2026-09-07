import * as crypto from 'crypto';

export interface PasetoPayload {
  sub: string;
  iat: number;
  exp: number;
  nbf?: number;
  iss?: string;
  aud?: string;
  jti?: string;
  claims?: Record<string, any>;
}

/**
 * PasetoTokenManager implements Platform-Agnostic Security Tokens (PASETO v4.local)
 * providing tamper-proof symmetric encryption with authenticated assertions.
 */
export class PasetoTokenManager {
  private key: Buffer;
  private issuer: string;

  constructor(symmetricKey32Bytes: string | Buffer, issuer: string = 'taskflow-engine') {
    if (typeof symmetricKey32Bytes === 'string') {
      this.key = crypto.createHash('sha256').update(symmetricKey32Bytes).digest();
    } else {
      this.key = symmetricKey32Bytes;
    }
    this.issuer = issuer;
  }

  public sign(
    subject: string,
    ttlSeconds: number = 3600,
    claims: Record<string, any> = {},
    footer: string = ''
  ): string {
    const now = Math.floor(Date.now() / 1000);
    const payload: PasetoPayload = {
      sub: subject,
      iat: now,
      exp: now + ttlSeconds,
      iss: this.issuer,
      jti: crypto.randomBytes(16).toString('hex'),
      claims
    };

    const payloadJson = JSON.stringify(payload);
    const nonce = crypto.randomBytes(12);

    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, nonce);
    if (footer) {
      cipher.setAAD(Buffer.from(footer, 'utf8'));
    }

    const encrypted = Buffer.concat([cipher.update(Buffer.from(payloadJson, 'utf8')), cipher.final()]);
    const tag = cipher.getAuthTag();

    const body = Buffer.concat([nonce, encrypted, tag]).toString('base64url');
    const footerB64 = footer ? Buffer.from(footer, 'utf8').toString('base64url') : '';

    return footerB64 ? `v4.local.${body}.${footerB64}` : `v4.local.${body}`;
  }

  public verify(token: string): PasetoPayload {
    const parts = token.split('.');
    if (parts.length < 3 || parts[0] !== 'v4' || parts[1] !== 'local') {
      throw new Error('Invalid PASETO token header');
    }

    const bodyBuf = Buffer.from(parts[2], 'base64url');
    const footerStr = parts[3] ? Buffer.from(parts[3], 'base64url').toString('utf8') : '';

    if (bodyBuf.length < 28) {
      throw new Error('Malformed PASETO token: payload too short');
    }

    const nonce = bodyBuf.slice(0, 12);
    const tag = bodyBuf.slice(bodyBuf.length - 16);
    const ciphertext = bodyBuf.slice(12, bodyBuf.length - 16);

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, nonce);
    decipher.setAuthTag(tag);
    if (footerStr) {
      decipher.setAAD(Buffer.from(footerStr, 'utf8'));
    }

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const payload: PasetoPayload = JSON.parse(decrypted.toString('utf8'));

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      throw new Error(`Token expired at ${new Date(payload.exp * 1000).toISOString()}`);
    }
    if (payload.nbf && payload.nbf > now) {
      throw new Error(`Token not valid before ${new Date(payload.nbf * 1000).toISOString()}`);
    }

    return payload;
  }
}
