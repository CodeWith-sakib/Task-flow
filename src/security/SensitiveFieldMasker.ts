export class SensitiveFieldMasker {
  private sensitiveKeys: Set<string>;

  constructor(sensitiveKeys: string[] = ['password', 'token', 'secret', 'apiKey']) {
    this.sensitiveKeys = new Set(sensitiveKeys.map(k => k.toLowerCase()));
  }

  public mask(data: Record<string, unknown>): Record<string, unknown> {
    const masked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (this.sensitiveKeys.has(key.toLowerCase())) {
        masked[key] = '***REDACTED***';
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        masked[key] = this.mask(value as Record<string, unknown>);
      } else {
        masked[key] = value;
      }
    }
    return masked;
  }
}
