export class BitSet {
  private words: Uint32Array;

  constructor(size: number) {
    this.words = new Uint32Array(Math.ceil(size / 32));
  }

  public set(index: number): void {
    const wordIdx = index >>> 5;
    const bitIdx = index & 31;
    this.words[wordIdx] |= (1 << bitIdx);
  }

  public clear(index: number): void {
    const wordIdx = index >>> 5;
    const bitIdx = index & 31;
    this.words[wordIdx] &= ~(1 << bitIdx);
  }

  public get(index: number): boolean {
    const wordIdx = index >>> 5;
    const bitIdx = index & 31;
    return (this.words[wordIdx] & (1 << bitIdx)) !== 0;
  }
}
