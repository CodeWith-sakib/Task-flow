export class ConsistentHashRing {
  private ring: Map<number, string> = new Map();
  private sortedKeys: number[] = [];
  private vnodes: number;

  constructor(vnodes: number = 3) {
    this.vnodes = vnodes;
  }

  private hash(str: string): number {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  }

  public addNode(node: string): void {
    this.removeNode(node); // Avoid duplicate entries
    for (let i = 0; i < this.vnodes; i++) {
      const vKey = this.hash(`${node}#${i}`);
      this.ring.set(vKey, node);
      this.sortedKeys.push(vKey);
    }
    this.sortedKeys.sort((a, b) => a - b);
  }

  public removeNode(node: string): void {
    const keysToRemove: number[] = [];
    for (const [key, n] of this.ring.entries()) {
      if (n === node) {
        keysToRemove.push(key);
      }
    }
    for (const k of keysToRemove) {
      this.ring.delete(k);
    }
    this.sortedKeys = Array.from(this.ring.keys()).sort((a, b) => a - b);
  }

  public getNode(key: string): string | undefined {
    if (this.sortedKeys.length === 0) return undefined;
    const h = this.hash(key);

    for (const vKey of this.sortedKeys) {
      if (vKey >= h) {
        return this.ring.get(vKey);
      }
    }
    return this.ring.get(this.sortedKeys[0]);
  }

  public getNodes(): string[] {
    return Array.from(new Set(this.ring.values()));
  }

  public clear(): void {
    this.ring.clear();
    this.sortedKeys = [];
  }
}
