import * as crypto from 'crypto';

export class WebhookCrypto {
  static computeSignature(secret: string, payload: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex');
  }

  static verifySignature(secret: string, payload: string, expectedSignature: string): boolean {
    const computed = this.computeSignature(secret, payload);
    const computedBuffer = Buffer.from(computed, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (computedBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(computedBuffer, expectedBuffer);
  }
}
