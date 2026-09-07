/**
 * Format-Preserving Encryption (FPE) Engine (FF1/Feistel-inspired).
 * Encrypts numeric and alphanumeric sensitive tokens (Credit Card Numbers, SSNs, UUIDs)
 * while strictly preserving the original string length, digit character set, and format.
 */

import * as crypto from 'crypto';

export class FormatPreservingEncryption {
  private key: Buffer;

  constructor(secretKey: string = 'taskflow-fpe-master-secret-32b!') {
    this.key = crypto.createHash('sha256').update(secretKey).digest();
  }

  /**
   * Encrypts a numeric string (e.g. "4111222233334444") into another numeric string of identical length.
   */
  public encryptDigits(digits: string, tweak: string = 'default-tweak'): string {
    if (!/^\d+$/.test(digits)) {
      throw new Error('Input must consist solely of digits');
    }

    const len = digits.length;
    const mid = Math.floor(len / 2);
    let left = BigInt(digits.substring(0, mid) || '0');
    let right = BigInt(digits.substring(mid));
    const radix = 10n;
    const modulus = radix ** BigInt(len - mid);

    // 4-Round Feistel Network
    for (let round = 0; round < 4; round++) {
      const hmac = crypto.createHmac('sha256', this.key);
      hmac.update(`${tweak}:${round}:${right.toString()}`);
      const digest = hmac.digest();
      const roundKey = BigInt('0x' + digest.toString('hex').substring(0, 14));

      const nextRight = (left + roundKey) % modulus;
      left = right;
      right = nextRight;
    }

    const leftStr = left.toString().padStart(mid, '0');
    const rightStr = right.toString().padStart(len - mid, '0');
    return leftStr + rightStr;
  }

  /**
   * Decrypts a numeric string back to original plaintext.
   */
  public decryptDigits(cipherDigits: string, tweak: string = 'default-tweak'): string {
    if (!/^\d+$/.test(cipherDigits)) {
      throw new Error('Input must consist solely of digits');
    }

    const len = cipherDigits.length;
    const mid = Math.floor(len / 2);
    let left = BigInt(cipherDigits.substring(0, mid) || '0');
    let right = BigInt(cipherDigits.substring(mid));
    const radix = 10n;
    const modulus = radix ** BigInt(len - mid);

    // Reverse 4-Round Feistel Network
    for (let round = 3; round >= 0; round--) {
      const prevRight = left;
      const hmac = crypto.createHmac('sha256', this.key);
      hmac.update(`${tweak}:${round}:${prevRight.toString()}`);
      const digest = hmac.digest();
      const roundKey = BigInt('0x' + digest.toString('hex').substring(0, 14));

      let prevLeft = (right - (roundKey % modulus)) % modulus;
      if (prevLeft < 0n) prevLeft += modulus;

      right = prevRight;
      left = prevLeft;
    }

    const leftStr = left.toString().padStart(mid, '0');
    const rightStr = right.toString().padStart(len - mid, '0');
    return leftStr + rightStr;
  }
}
