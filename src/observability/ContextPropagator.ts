export class ContextPropagator {
  private static store: Map<string, unknown> = new Map();

  public static set(key: string, value: unknown): void {
    this.store.set(key, value);
  }

  public static get<T>(key: string): T | undefined {
    return this.store.get(key) as T | undefined;
  }

  public static clear(): void {
    this.store.clear();
  }
}
