export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

export function logInfo(message: string, data?: any): void {
  console.log(`[INFO] ${getCurrentTimestamp()} ${message}`, data ?? '');
}

export function logError(message: string, error?: any): void {
  console.error(`[ERROR] ${getCurrentTimestamp()} ${message}`, error ?? '');
}

export function logWarn(message: string, data?: any): void {
  console.warn(`[WARN] ${getCurrentTimestamp()} ${message}`, data ?? '');
}
