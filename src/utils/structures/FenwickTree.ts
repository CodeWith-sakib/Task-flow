/**
 * FenwickTree (Binary Indexed Tree) maintains prefix sums over dynamic arrays with O(log N) updates and queries.
 */
export class FenwickTree {
  private tree: Float64Array;
  private size: number;

  constructor(size: number) {
    this.size = size;
    this.tree = new Float64Array(size + 1);
  }

  public update(index: number, delta: number): void {
    if (index < 0 || index >= this.size) {
      throw new Error(`Index out of bounds: ${index} (size: ${this.size})`);
    }

    // 1-based indexing for BIT operations
    let i = index + 1;
    while (i <= this.size) {
      this.tree[i] += delta;
      i += i & (-i); // Add lowest set bit
    }
  }

  public query(index: number): number {
    if (index < 0) return 0;
    let i = Math.min(index + 1, this.size);
    let sum = 0;

    while (i > 0) {
      sum += this.tree[i];
      i -= i & (-i); // Subtract lowest set bit
    }

    return sum;
  }

  public queryRange(left: number, right: number): number {
    if (left > right) return 0;
    return this.query(right) - this.query(left - 1);
  }

  public clear(): void {
    this.tree.fill(0);
  }
}
