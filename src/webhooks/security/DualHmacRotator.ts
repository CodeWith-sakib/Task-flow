import * as crypto from 'crypto';

/**
 * DualHmacRotator implements zero-downtime secret rotation for outbound webhook signatures.
 * Signs payloads using the primary secret and validates against both primary and retiring secondary secrets.
 */
export class DualHmacRotator {
  private primarySecret: string;
  private secondarySecret: string | null = null;
  private primaryCreatedAt: number;

  constructor(initialPrimarySecret: string) {
    this.primarySecret = initialPrimarySecret;
    this.primaryCreatedAt = Date.now();
  }

  public sign(payload: string): string {
    return this.computeSignature(payload, this.primarySecret);
  }

  public verify(payload: string, receivedSignature: string): boolean {
    // 1. Verify against primary secret
    const primarySig = this.computeSignature(payload, this.primarySecret);
    if (this.timingSafeEqual(primarySig, receivedSignature)) {
      return true;
    }

    // 2. Verify against retiring secondary secret if available
    if (this.secondarySecret) {
      const secondarySig = this.computeSignature(payload, this.secondarySecret);
      if (this.timingSafeEqual(secondarySig, receivedSignature)) {
        return true;
      }
    }

    return false;
  }

  public rotateSecret(newPrimarySecret: string): void {
    this.secondarySecret = this.primarySecret;
    this.primarySecret = newPrimarySecret;
    this.primaryCreatedAt = Date.now();
  }

  public retireSecondarySecret(): void {
    this.secondarySecret = null;
  }

  public hasSecondarySecret(): boolean {
    return this.secondarySecret !== null;
  }

  private computeSignature(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
  }

  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    return crypto.timingSafeEqual(bufA, bufB);
  }
}
