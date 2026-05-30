import * as crypto from 'crypto';

export class PayloadHasher {
  public static computeHash(obj: unknown): string {
    const str = JSON.stringify(obj, Object.keys(obj as any || {}).sort());
    return crypto.createHash('sha256').update(str).digest('hex');
  }
}
