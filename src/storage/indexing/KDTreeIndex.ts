/**
 * Multi-dimensional K-D Tree Index.
 * Enables fast k-nearest neighbors (k-NN) and hyper-rectangular range queries
 * on numeric vector spaces, resource profiles, and latency embeddings.
 */

export interface KDPoint<T> {
  coords: number[];
  data: T;
}

export interface KDNode<T> {
  point: KDPoint<T>;
  left?: KDNode<T>;
  right?: KDNode<T>;
  axis: number;
}

export class KDTreeIndex<T> {
  private root?: KDNode<T>;
  private dimensions: number;
  private count = 0;

  constructor(dimensions: number) {
    if (dimensions < 1) {
      throw new Error('Dimensions must be at least 1');
    }
    this.dimensions = dimensions;
  }

  public insert(coords: number[], data: T): void {
    if (coords.length !== this.dimensions) {
      throw new Error(`Expected point of dimension ${this.dimensions}, got ${coords.length}`);
    }

    const point: KDPoint<T> = { coords: [...coords], data };
    this.root = this.insertNode(this.root, point, 0);
    this.count++;
  }

  public size(): number {
    return this.count;
  }

  public nearestNeighbor(target: number[]): { point: KDPoint<T>; distance: number } | null {
    if (!this.root) return null;

    let best: { point: KDPoint<T>; distance: number } = {
      point: this.root.point,
      distance: this.euclideanDistance(target, this.root.point.coords),
    };

    this.searchNearest(this.root, target, 0, best);
    return best;
  }

  public rangeSearch(minCoords: number[], maxCoords: number[]): KDPoint<T>[] {
    const results: KDPoint<T>[] = [];
    this.searchRange(this.root, minCoords, maxCoords, results);
    return results;
  }

  private insertNode(node: KDNode<T> | undefined, point: KDPoint<T>, depth: number): KDNode<T> {
    if (!node) {
      return { point, axis: depth % this.dimensions };
    }

    const axis = node.axis;
    if (point.coords[axis] < node.point.coords[axis]) {
      node.left = this.insertNode(node.left, point, depth + 1);
    } else {
      node.right = this.insertNode(node.right, point, depth + 1);
    }

    return node;
  }

  private searchNearest(
    node: KDNode<T> | undefined,
    target: number[],
    depth: number,
    best: { point: KDPoint<T>; distance: number }
  ): void {
    if (!node) return;

    const dist = this.euclideanDistance(target, node.point.coords);
    if (dist < best.distance) {
      best.distance = dist;
      best.point = node.point;
    }

    const axis = depth % this.dimensions;
    const diff = target[axis] - node.point.coords[axis];

    const nearChild = diff < 0 ? node.left : node.right;
    const farChild = diff < 0 ? node.right : node.left;

    this.searchNearest(nearChild, target, depth + 1, best);

    // If hypersphere crosses splitting plane, investigate far child
    if (Math.abs(diff) < best.distance) {
      this.searchNearest(farChild, target, depth + 1, best);
    }
  }

  private searchRange(
    node: KDNode<T> | undefined,
    minCoords: number[],
    maxCoords: number[],
    results: KDPoint<T>[]
  ): void {
    if (!node) return;

    let inRange = true;
    for (let i = 0; i < this.dimensions; i++) {
      if (node.point.coords[i] < minCoords[i] || node.point.coords[i] > maxCoords[i]) {
        inRange = false;
        break;
      }
    }

    if (inRange) {
      results.push(node.point);
    }

    const axis = node.axis;
    if (minCoords[axis] <= node.point.coords[axis]) {
      this.searchRange(node.left, minCoords, maxCoords, results);
    }
    if (maxCoords[axis] >= node.point.coords[axis]) {
      this.searchRange(node.right, minCoords, maxCoords, results);
    }
  }

  private euclideanDistance(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += Math.pow(a[i] - b[i], 2);
    }
    return Math.sqrt(sum);
  }
}
