/**
 * Data Anonymization & Privacy Preservation Engine.
 * Implements:
 * 1. Laplace Mechanism Differential Privacy for numerical aggregations ($\epsilon$-differential privacy)
 * 2. K-Anonymity Generalization & Suppression for quasi-identifiers
 * 3. Deterministic Salted HMAC Pseudonymization
 */

import * as crypto from 'crypto';

export class DataAnonymizer {
  private hmacSecret: string;

  constructor(hmacSecret: string = 'taskflow-privacy-salt-secret') {
    this.hmacSecret = hmacSecret;
  }

  /**
   * Applies $\epsilon$-Differential Privacy by injecting zero-mean Laplace noise.
   * Noise scale $b = \Delta f / \epsilon$
   */
  public addLaplaceNoise(value: number, sensitivity: number, epsilon: number): number {
    if (epsilon <= 0) throw new Error('Epsilon must be positive');

    const scale = sensitivity / epsilon;
    const u = Math.random() - 0.5;
    const noise = -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));

    return value + noise;
  }

  /**
   * Deterministically pseudonymizes an identifier using HMAC-SHA256 with consistent prefix.
   */
  public pseudonymize(identifier: string, prefix: string = 'anon_'): string {
    const hash = crypto.createHmac('sha256', this.hmacSecret).update(identifier).digest('hex');
    return `${prefix}${hash.substring(0, 16)}`;
  }

  /**
   * Generalizes numerical values into range buckets (e.g. age 34 -> "30-39").
   */
  public generalizeNumber(val: number, bucketSize: number = 10): string {
    const lower = Math.floor(val / bucketSize) * bucketSize;
    const upper = lower + bucketSize - 1;
    return `${lower}-${upper}`;
  }

  /**
   * Masks email address preserving domain (e.g. "alice@example.com" -> "a***e@example.com").
   */
  public maskEmail(email: string): string {
    const parts = email.split('@');
    if (parts.length !== 2) return '***@masked.com';

    const user = parts[0];
    const domain = parts[1];

    if (user.length <= 2) {
      return `*@${domain}`;
    }

    const first = user[0];
    const last = user[user.length - 1];
    return `${first}${'*'.repeat(user.length - 2)}${last}@${domain}`;
  }
}
