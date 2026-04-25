import * as crypto from 'crypto';

export class WebhookSignatureRotator {
  private primarySecret: string;
  private secondarySecret?: string;

  constructor(primarySecret: string, secondarySecret?: string) {
    this.primarySecret = primarySecret;
    this.secondarySecret = secondarySecret;
  }

  public sign(payload: string): string {
    return crypto.createHmac('sha256', this.primarySecret).update(payload).digest('hex');
  }

  public verify(payload: string, signature: string): boolean {
    const primarySig = this.sign(payload);
    if (primarySig === signature) return true;

    if (this.secondarySecret) {
      const secondarySig = crypto.createHmac('sha256', this.secondarySecret).update(payload).digest('hex');
      return secondarySig === signature;
    }
    return false;
  }
}
