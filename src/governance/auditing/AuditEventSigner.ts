/**
 * Cryptographic Audit Event Signer.
 * Generates ECDSA P-256 (prime256v1) digital signatures and verifies authenticity
 * of immutable audit trail entries to satisfy SOC2 Type II non-repudiation requirements.
 */

import * as crypto from 'crypto';

export interface SignedAuditEvent {
  eventId: string;
  timestamp: number;
  actor: string;
  tenantId: string;
  action: string;
  resourceId: string;
  payloadDigest: string;
  signature: string;
  keyId: string;
}

export class AuditEventSigner {
  private keyPairs = new Map<string, { privateKey: string; publicKey: string }>();
  private activeKeyId: string;

  constructor(defaultKeyId: string = 'audit-key-v1') {
    this.activeKeyId = defaultKeyId;
    this.generateKeyPair(defaultKeyId);
  }

  public generateKeyPair(keyId: string): { keyId: string; publicKeyPem: string } {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    this.keyPairs.set(keyId, { privateKey, publicKey });
    return { keyId, publicKeyPem: publicKey };
  }

  public signEvent(event: Omit<SignedAuditEvent, 'signature' | 'keyId' | 'payloadDigest'>, rawPayload: any): SignedAuditEvent {
    const keyPair = this.keyPairs.get(this.activeKeyId);
    if (!keyPair) {
      throw new Error(`Active signing key ${this.activeKeyId} not found`);
    }

    const payloadDigest = crypto
      .createHash('sha256')
      .update(typeof rawPayload === 'string' ? rawPayload : JSON.stringify(rawPayload))
      .digest('hex');

    const canonicalData = `${event.eventId}:${event.timestamp}:${event.actor}:${event.tenantId}:${event.action}:${event.resourceId}:${payloadDigest}`;

    const signer = crypto.createSign('SHA256');
    signer.update(canonicalData);
    const signature = signer.sign(keyPair.privateKey, 'base64');

    return {
      ...event,
      payloadDigest,
      signature,
      keyId: this.activeKeyId,
    };
  }

  public verifyEvent(signedEvent: SignedAuditEvent, rawPayload?: any): boolean {
    const keyPair = this.keyPairs.get(signedEvent.keyId);
    if (!keyPair) return false;

    if (rawPayload !== undefined) {
      const computedDigest = crypto
        .createHash('sha256')
        .update(typeof rawPayload === 'string' ? rawPayload : JSON.stringify(rawPayload))
        .digest('hex');

      if (computedDigest !== signedEvent.payloadDigest) {
        return false;
      }
    }

    const canonicalData = `${signedEvent.eventId}:${signedEvent.timestamp}:${signedEvent.actor}:${signedEvent.tenantId}:${signedEvent.action}:${signedEvent.resourceId}:${signedEvent.payloadDigest}`;

    const verifier = crypto.createVerify('SHA256');
    verifier.update(canonicalData);
    return verifier.verify(keyPair.publicKey, signedEvent.signature, 'base64');
  }
}
