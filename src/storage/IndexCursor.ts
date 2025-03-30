export class IndexCursor<T> {
  private items: Array<{ key: string; value: T }>;
  private position: number = 0;

  constructor(items: Array<{ key: string; value: T }>) {
    this.items = [...items].sort((a, b) => a.key.localeCompare(b.key));
  }

  public hasNext(): boolean {
    return this.position < this.items.length;
  }

  public next(): { key: string; value: T } | null {
    if (!this.hasNext()) return null;
    return this.items[this.position++];
  }

  public hasPrev(): boolean {
    return this.position > 0;
  }

  public prev(): { key: string; value: T } | null {
    if (!this.hasPrev()) return null;
    return this.items[--this.position];
  }

  public reset(): void {
    this.position = 0;
  }

  public seek(key: string): void {
    const idx = this.items.findIndex(item => item.key >= key);
    this.position = idx !== -1 ? idx : this.items.length;
  }
}
