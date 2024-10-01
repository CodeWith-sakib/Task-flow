export class BloomFilter {
  private size: number;
  private hashCount: number;
  private bitArray: Uint8Array;

  constructor(expectedItems: number = 10000, falsePositiveRate: number = 0.01) {
    this.size = Math.ceil(- (expectedItems * Math.log(falsePositiveRate)) / (Math.log(2) ** 2));
    this.hashCount = Math.ceil((this.size / expectedItems) * Math.log(2));
    this.bitArray = new Uint8Array(Math.ceil(this.size / 8));
  }

  private hash(item: string, seed: number): number {
    let hash = seed ^ item.length;
    for (let i = 0; i < item.length; i++) {
      hash = Math.imul(hash ^ item.charCodeAt(i), 0x5bd1e995);
      hash ^= hash >>> 15;
    }
    return Math.abs(hash) % this.size;
  }

  add(item: string): void {
    for (let i = 0; i < this.hashCount; i++) {
      const bitIndex = this.hash(item, i);
      const byteIndex = Math.floor(bitIndex / 8);
      const bitOffset = bitIndex % 8;
      this.bitArray[byteIndex] |= (1 << bitOffset);
    }
  }

  has(item: string): boolean {
    for (let i = 0; i < this.hashCount; i++) {
      const bitIndex = this.hash(item, i);
      const byteIndex = Math.floor(bitIndex / 8);
      const bitOffset = bitIndex % 8;
      if ((this.bitArray[byteIndex] & (1 << bitOffset)) === 0) {
        return false;
      }
    }
    return true;
  }

  clear(): void {
    this.bitArray.fill(0);
  }
}
