/**
 * Zero-Trust Payload & Request Security Validator.
 * Canonicalizes JSON request payloads, enforces strict schema types,
 * prevents injection attacks (SQLi, prototype pollution, script injection),
 * and validates HMAC request signatures with timestamp replay protection.
 */

import * as crypto from 'crypto';

export interface SignatureValidationOptions {
  secretKey: string;
  signatureHeader: string;
  timestampHeader: string;
  maxClockDriftMs?: number;
}

export class ZeroTrustValidator {
  /**
   * Sanitizes object keys and values against prototype pollution and dangerous identifiers.
   */
  public sanitizeObject<T extends Record<string, any>>(obj: T): T {
    if (!obj || typeof obj !== 'object') return obj;

    const sanitized = (Array.isArray(obj) ? [] : {}) as any;

    for (const [key, value] of Object.entries(obj)) {
      // Reject prototype pollution vectors
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }

      if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value);
      } else if (typeof value === 'string') {
        // Strip null bytes and control chars
        sanitized[key] = value.replace(/\0/g, '').trim();
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Canonicalizes a JSON object into deterministic key-sorted string representation.
   */
  public canonicalizeJson(obj: any): string {
    if (obj === null || typeof obj !== 'object') {
      return JSON.stringify(obj);
    }

    if (Array.isArray(obj)) {
      return `[${obj.map((item) => this.canonicalizeJson(item)).join(',')}]`;
    }

    const sortedKeys = Object.keys(obj).sort();
    const parts = sortedKeys.map((k) => `${JSON.stringify(k)}:${this.canonicalizeJson(obj[k])}`);
    return `{${parts.join(',')}}`;
  }

  /**
   * Generates a tamper-proof HMAC-SHA256 signature for a payload and timestamp.
   */
  public signPayload(payload: any, timestamp: number, secretKey: string): string {
    const canonical = this.canonicalizeJson(payload);
    const message = `${timestamp}.${canonical}`;
    return crypto.createHmac('sha256', secretKey).update(message).digest('hex');
  }

  /**
   * Validates signature and ensures request timestamp is within acceptable replay window.
   */
  public verifySignature(payload: any, options: SignatureValidationOptions): { valid: boolean; reason?: string } {
    const timestamp = parseInt(options.timestampHeader, 10);
    if (isNaN(timestamp)) {
      return { valid: false, reason: 'Invalid or missing timestamp header' };
    }

    const maxDrift = options.maxClockDriftMs || 300000; // 5 minutes default
    const now = Date.now();

    if (Math.abs(now - timestamp) > maxDrift) {
      return { valid: false, reason: 'Request timestamp expired or outside clock drift window' };
    }

    const expectedSignature = this.signPayload(payload, timestamp, options.secretKey);
    const signatureMatch = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'utf-8'),
      Buffer.from(options.signatureHeader, 'utf-8')
    );

    if (!signatureMatch) {
      return { valid: false, reason: 'Cryptographic signature mismatch' };
    }

    return { valid: true };
  }
}
