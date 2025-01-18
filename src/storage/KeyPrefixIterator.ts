export class KeyPrefixIterator<T = unknown> {
  private data: Map<string, T>;

  constructor(data: Map<string, T>) {
    this.data = data;
  }

  public iteratePrefix(prefix: string): Array<{ key: string; value: T }> {
    const matches: Array<{ key: string; value: T }> = [];
    for (const [key, value] of this.data.entries()) {
      if (key.startsWith(prefix)) {
        matches.push({ key, value });
      }
    }
    return matches.sort((a, b) => a.key.localeCompare(b.key));
  }

  public countPrefix(prefix: string): number {
    let count = 0;
    for (const key of this.data.keys()) {
      if (key.startsWith(prefix)) {
        count++;
      }
    }
    return count;
  }

  public deletePrefix(prefix: string): number {
    let deleted = 0;
    for (const key of Array.from(this.data.keys())) {
      if (key.startsWith(prefix)) {
        this.data.delete(key);
        deleted++;
      }
    }
    return deleted;
  }
}
