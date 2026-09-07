/**
 * DisjointSetUnion (Union-Find) with path compression and union by rank
 * for cycle detection, dynamic connectivity, and cluster partition analysis in near O(1) amortized time.
 */
export class DisjointSetUnion<T = string | number> {
  private parent: Map<T, T> = new Map();
  private rank: Map<T, number> = new Map();
  private setSizes: Map<T, number> = new Map();
  private count: number = 0;

  public makeSet(element: T): void {
    if (!this.parent.has(element)) {
      this.parent.set(element, element);
      this.rank.set(element, 0);
      this.setSizes.set(element, 1);
      this.count++;
    }
  }

  public find(element: T): T {
    this.makeSet(element);
    let root = element;

    while (root !== this.parent.get(root)) {
      root = this.parent.get(root)!;
    }

    // Path compression
    let curr = element;
    while (curr !== root) {
      const next = this.parent.get(curr)!;
      this.parent.set(curr, root);
      curr = next;
    }

    return root;
  }

  public union(a: T, b: T): boolean {
    const rootA = this.find(a);
    const rootB = this.find(b);

    if (rootA === rootB) {
      return false; // Already in same set (cycle detected)
    }

    const rankA = this.rank.get(rootA)!;
    const rankB = this.rank.get(rootB)!;
    const sizeA = this.setSizes.get(rootA)!;
    const sizeB = this.setSizes.get(rootB)!;

    if (rankA < rankB) {
      this.parent.set(rootA, rootB);
      this.setSizes.set(rootB, sizeA + sizeB);
    } else if (rankA > rankB) {
      this.parent.set(rootB, rootA);
      this.setSizes.set(rootA, sizeA + sizeB);
    } else {
      this.parent.set(rootB, rootA);
      this.rank.set(rootA, rankA + 1);
      this.setSizes.set(rootA, sizeA + sizeB);
    }

    this.count--;
    return true;
  }

  public connected(a: T, b: T): boolean {
    return this.find(a) === this.find(b);
  }

  public getSetSize(element: T): number {
    const root = this.find(element);
    return this.setSizes.get(root) ?? 1;
  }

  public getDisjointSetCount(): number {
    return this.count;
  }
}
