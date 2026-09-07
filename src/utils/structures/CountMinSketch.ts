import { MurmurHash3 } from '../MurmurHash3';

/**
 * CountMinSketch provides sub-linear space frequency estimation for high-throughput streaming events.
 */
export class CountMinSketch {
  private width: number;
  private depth: number;
  private table: Int32Array[];
  private seeds: number[];
  private totalCount: number = 0;

  constructor(width: number = 2048, depth: number = 5) {
    this.width = width;
    this.depth = depth;
    this.table = Array.from({ length: depth }, () => new Int32Array(width));
    this.seeds = Array.from({ length: depth }, (_, i) => (i * 0x7feb352d + 0x85ebca6b) >>> 0);
  }

  public add(item: string, count: number = 1): void {
    this.totalCount += count;
    for (let i = 0; i < this.depth; i++) {
      const hash = MurmurHash3.hash32(item, this.seeds[i]);
      const bucket = hash % this.width;
      this.table[i][bucket] += count;
    }
  }

  public estimate(item: string): number {
    let minFreq = Number.MAX_SAFE_INTEGER;
    for (let i = 0; i < this.depth; i++) {
      const hash = MurmurHash3.hash32(item, this.seeds[i]);
      const bucket = hash % this.width;
      minFreq = Math.min(minFreq, this.table[i][bucket]);
    }
    return minFreq === Number.MAX_SAFE_INTEGER ? 0 : minFreq;
  }

  public getTotalCount(): number {
    return this.totalCount;
  }

  public clear(): void {
    for (let i = 0; i < this.depth; i++) {
      this.table[i].fill(0);
    }
    this.totalCount = 0;
  }
}
