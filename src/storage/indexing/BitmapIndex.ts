/**
 * Compressed Bitmap Index for high-performance multi-attribute filtering.
 * Uses 32-bit chunked sparse/dense bitset representations to execute
 * fast bitwise AND, OR, NOT, and XOR operations on task IDs and workflow tags.
 */

export class CompressedBitset {
  private chunks = new Map<number, Uint32Array>();

  public set(index: number): void {
    const chunkId = Math.floor(index / 1024);
    const bitPos = index % 1024;
    const arrayIdx = Math.floor(bitPos / 32);
    const bitOffset = bitPos % 32;

    let chunk = this.chunks.get(chunkId);
    if (!chunk) {
      chunk = new Uint32Array(32); // 32 * 32 = 1024 bits per chunk
      this.chunks.set(chunkId, chunk);
    }

    chunk[arrayIdx] |= 1 << bitOffset;
  }

  public get(index: number): boolean {
    const chunkId = Math.floor(index / 1024);
    const bitPos = index % 1024;
    const arrayIdx = Math.floor(bitPos / 32);
    const bitOffset = bitPos % 32;

    const chunk = this.chunks.get(chunkId);
    if (!chunk) return false;

    return (chunk[arrayIdx] & (1 << bitOffset)) !== 0;
  }

  public clear(index: number): void {
    const chunkId = Math.floor(index / 1024);
    const bitPos = index % 1024;
    const arrayIdx = Math.floor(bitPos / 32);
    const bitOffset = bitPos % 32;

    const chunk = this.chunks.get(chunkId);
    if (!chunk) return;

    chunk[arrayIdx] &= ~(1 << bitOffset);
  }

  public cardinality(): number {
    let count = 0;
    for (const chunk of this.chunks.values()) {
      for (let i = 0; i < 32; i++) {
        count += this.popcount(chunk[i]);
      }
    }
    return count;
  }

  public toArray(): number[] {
    const results: number[] = [];
    for (const [chunkId, chunk] of this.chunks.entries()) {
      for (let i = 0; i < 32; i++) {
        let val = chunk[i];
        if (val === 0) continue;
        for (let b = 0; b < 32; b++) {
          if ((val & (1 << b)) !== 0) {
            results.push(chunkId * 1024 + i * 32 + b);
          }
        }
      }
    }
    return results.sort((a, b) => a - b);
  }

  public and(other: CompressedBitset): CompressedBitset {
    const res = new CompressedBitset();
    for (const [chunkId, chunk] of this.chunks.entries()) {
      const otherChunk = other.chunks.get(chunkId);
      if (otherChunk) {
        const newChunk = new Uint32Array(32);
        let hasNonZero = false;
        for (let i = 0; i < 32; i++) {
          newChunk[i] = chunk[i] & otherChunk[i];
          if (newChunk[i] !== 0) hasNonZero = true;
        }
        if (hasNonZero) {
          res.chunks.set(chunkId, newChunk);
        }
      }
    }
    return res;
  }

  public or(other: CompressedBitset): CompressedBitset {
    const res = new CompressedBitset();
    const allChunks = new Set([...this.chunks.keys(), ...other.chunks.keys()]);

    for (const chunkId of allChunks) {
      const c1 = this.chunks.get(chunkId);
      const c2 = other.chunks.get(chunkId);
      const newChunk = new Uint32Array(32);
      let hasNonZero = false;

      for (let i = 0; i < 32; i++) {
        const v1 = c1 ? c1[i] : 0;
        const v2 = c2 ? c2[i] : 0;
        newChunk[i] = v1 | v2;
        if (newChunk[i] !== 0) hasNonZero = true;
      }

      if (hasNonZero) {
        res.chunks.set(chunkId, newChunk);
      }
    }
    return res;
  }

  public not(maxIndex: number): CompressedBitset {
    const res = new CompressedBitset();
    const totalChunks = Math.ceil((maxIndex + 1) / 1024);

    for (let chunkId = 0; chunkId < totalChunks; chunkId++) {
      const current = this.chunks.get(chunkId);
      const newChunk = new Uint32Array(32);
      let hasNonZero = false;

      for (let i = 0; i < 32; i++) {
        const v = current ? current[i] : 0;
        newChunk[i] = ~v >>> 0;
        if (newChunk[i] !== 0) hasNonZero = true;
      }

      if (hasNonZero) {
        res.chunks.set(chunkId, newChunk);
      }
    }
    return res;
  }

  private popcount(n: number): number {
    let x = n - ((n >> 1) & 0x55555555);
    x = (x & 0x33333333) + ((x >> 2) & 0x33333333);
    return (((x + (x >> 4)) & 0x0f0f0f0f) * 0x01010101) >> 24;
  }
}

export class BitmapIndex {
  private index = new Map<string, Map<string, CompressedBitset>>();
  private entityIdMap = new Map<string, number>();
  private reverseIdMap = new Map<number, string>();
  private nextId = 0;

  public indexEntity(id: string, attributes: Record<string, string | string[]>): void {
    let intId = this.entityIdMap.get(id);
    if (intId === undefined) {
      intId = this.nextId++;
      this.entityIdMap.set(id, intId);
      this.reverseIdMap.set(intId, id);
    }

    for (const [attr, val] of Object.entries(attributes)) {
      let attrMap = this.index.get(attr);
      if (!attrMap) {
        attrMap = new Map<string, CompressedBitset>();
        this.index.set(attr, attrMap);
      }

      const values = Array.isArray(val) ? val : [val];
      for (const v of values) {
        let bitset = attrMap.get(v);
        if (!bitset) {
          bitset = new CompressedBitset();
          attrMap.set(v, bitset);
        }
        bitset.set(intId);
      }
    }
  }

  public queryEquals(attribute: string, value: string): string[] {
    const attrMap = this.index.get(attribute);
    if (!attrMap) return [];
    const bitset = attrMap.get(value);
    if (!bitset) return [];

    return bitset.toArray().map((id) => this.reverseIdMap.get(id)!);
  }

  public queryAnd(queries: { attribute: string; value: string }[]): string[] {
    if (queries.length === 0) return [];

    let combined: CompressedBitset | null = null;

    for (const q of queries) {
      const attrMap = this.index.get(q.attribute);
      if (!attrMap) return [];
      const bitset = attrMap.get(q.value);
      if (!bitset) return [];

      if (!combined) {
        combined = bitset;
      } else {
        combined = combined.and(bitset);
      }
    }

    return combined ? combined.toArray().map((id) => this.reverseIdMap.get(id)!) : [];
  }

  public queryOr(queries: { attribute: string; value: string }[]): string[] {
    if (queries.length === 0) return [];

    let combined = new CompressedBitset();

    for (const q of queries) {
      const attrMap = this.index.get(q.attribute);
      if (!attrMap) continue;
      const bitset = attrMap.get(q.value);
      if (!bitset) continue;

      combined = combined.or(bitset);
    }

    return combined.toArray().map((id) => this.reverseIdMap.get(id)!);
  }
}
