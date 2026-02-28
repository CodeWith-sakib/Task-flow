export class StepRetryStrategy {
  private maxAttempts: number;
  private retryableErrors: string[];

  constructor(maxAttempts: number = 3, retryableErrors: string[] = []) {
    this.maxAttempts = maxAttempts;
    this.retryableErrors = retryableErrors;
  }

  public shouldRetry(attempt: number, error: Error): boolean {
    if (attempt >= this.maxAttempts) return false;
    if (this.retryableErrors.length === 0) return true;
    return this.retryableErrors.some(errName => error.name === errName || error.message.includes(errName));
  }
}
