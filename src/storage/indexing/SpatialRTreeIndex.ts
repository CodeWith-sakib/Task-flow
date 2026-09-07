/**
 * Multi-dimensional R-Tree Index implementation.
 * Used for bounding-box indexing of spatio-temporal workflows, geographical tasks,
 * and multi-dimensional interval scheduling constraints.
 */

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface RTreeEntry<T> {
  box: BoundingBox;
  data: T;
}

export interface RTreeNode<T> {
  isLeaf: boolean;
  box: BoundingBox;
  entries?: RTreeEntry<T>[];
  children?: RTreeNode<T>[];
}

export class SpatialRTreeIndex<T> {
  private root: RTreeNode<T>;
  private maxEntries: number;
  private minEntries: number;
  private count: number = 0;

  constructor(maxEntries: number = 9, minEntries?: number) {
    this.maxEntries = maxEntries;
    this.minEntries = minEntries || Math.max(2, Math.floor(maxEntries * 0.4));
    this.root = this.createNode(true);
  }

  public size(): number {
    return this.count;
  }

  public insert(box: BoundingBox, data: T): void {
    const entry: RTreeEntry<T> = { box: { ...box }, data };
    const leaf = this.chooseLeaf(this.root, box);
    leaf.entries!.push(entry);
    this.count++;

    // Update bounding box upward
    this.adjustBoundingBox(this.root);

    // Split if overflow
    if (leaf.entries!.length > this.maxEntries) {
      this.splitNode(leaf);
    }
  }

  public search(queryBox: BoundingBox): T[] {
    const results: T[] = [];
    this.searchNode(this.root, queryBox, results);
    return results;
  }

  private searchNode(node: RTreeNode<T>, queryBox: BoundingBox, results: T[]): void {
    if (!this.intersects(node.box, queryBox)) {
      return;
    }

    if (node.isLeaf) {
      for (const entry of node.entries!) {
        if (this.intersects(entry.box, queryBox)) {
          results.push(entry.data);
        }
      }
    } else {
      for (const child of node.children!) {
        this.searchNode(child, queryBox, results);
      }
    }
  }

  private chooseLeaf(node: RTreeNode<T>, box: BoundingBox): RTreeNode<T> {
    if (node.isLeaf) {
      return node;
    }

    // Find child that requires minimum enlargement
    let bestChild = node.children![0];
    let minEnlargement = Infinity;

    for (const child of node.children!) {
      const currentArea = this.calcArea(child.box);
      const combinedBox = this.combineBoxes(child.box, box);
      const enlargedArea = this.calcArea(combinedBox);
      const enlargement = enlargedArea - currentArea;

      if (enlargement < minEnlargement) {
        minEnlargement = enlargement;
        bestChild = child;
      }
    }

    return this.chooseLeaf(bestChild, box);
  }

  private splitNode(node: RTreeNode<T>): void {
    if (node.isLeaf) {
      const entries = node.entries!;
      const mid = Math.floor(entries.length / 2);
      const rightEntries = entries.splice(mid);

      const rightNode = this.createNode(true);
      rightNode.entries = rightEntries;
      rightNode.box = this.computeEntriesBox(rightEntries);
      node.box = this.computeEntriesBox(entries);

      if (node === this.root) {
        const newRoot = this.createNode(false);
        newRoot.children = [node, rightNode];
        newRoot.box = this.combineBoxes(node.box, rightNode.box);
        this.root = newRoot;
      } else {
        const parent = this.findParent(this.root, node);
        if (parent) {
          parent.children!.push(rightNode);
          parent.box = this.computeChildrenBox(parent.children!);
          if (parent.children!.length > this.maxEntries) {
            this.splitNode(parent);
          }
        }
      }
    } else {
      const children = node.children!;
      const mid = Math.floor(children.length / 2);
      const rightChildren = children.splice(mid);

      const rightNode = this.createNode(false);
      rightNode.children = rightChildren;
      rightNode.box = this.computeChildrenBox(rightChildren);
      node.box = this.computeChildrenBox(children);

      if (node === this.root) {
        const newRoot = this.createNode(false);
        newRoot.children = [node, rightNode];
        newRoot.box = this.combineBoxes(node.box, rightNode.box);
        this.root = newRoot;
      } else {
        const parent = this.findParent(this.root, node);
        if (parent) {
          parent.children!.push(rightNode);
          parent.box = this.computeChildrenBox(parent.children!);
          if (parent.children!.length > this.maxEntries) {
            this.splitNode(parent);
          }
        }
      }
    }
  }

  private findParent(current: RTreeNode<T>, target: RTreeNode<T>): RTreeNode<T> | null {
    if (current.isLeaf) return null;
    if (current.children!.includes(target)) return current;

    for (const child of current.children!) {
      const found = this.findParent(child, target);
      if (found) return found;
    }

    return null;
  }

  private adjustBoundingBox(node: RTreeNode<T>): BoundingBox {
    if (node.isLeaf) {
      node.box = this.computeEntriesBox(node.entries!);
      return node.box;
    }

    for (const child of node.children!) {
      this.adjustBoundingBox(child);
    }

    node.box = this.computeChildrenBox(node.children!);
    return node.box;
  }

  private createNode(isLeaf: boolean): RTreeNode<T> {
    return {
      isLeaf,
      box: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
      entries: isLeaf ? [] : undefined,
      children: isLeaf ? undefined : [],
    };
  }

  private intersects(a: BoundingBox, b: BoundingBox): boolean {
    return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
  }

  private calcArea(box: BoundingBox): number {
    return Math.max(0, box.maxX - box.minX) * Math.max(0, box.maxY - box.minY);
  }

  private combineBoxes(a: BoundingBox, b: BoundingBox): BoundingBox {
    return {
      minX: Math.min(a.minX, b.minX),
      minY: Math.min(a.minY, b.minY),
      maxX: Math.max(a.maxX, b.maxX),
      maxY: Math.max(a.maxY, b.maxY),
    };
  }

  private computeEntriesBox(entries: RTreeEntry<T>[]): BoundingBox {
    if (entries.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    let minX = entries[0].box.minX;
    let minY = entries[0].box.minY;
    let maxX = entries[0].box.maxX;
    let maxY = entries[0].box.maxY;

    for (let i = 1; i < entries.length; i++) {
      minX = Math.min(minX, entries[i].box.minX);
      minY = Math.min(minY, entries[i].box.minY);
      maxX = Math.max(maxX, entries[i].box.maxX);
      maxY = Math.max(maxY, entries[i].box.maxY);
    }

    return { minX, minY, maxX, maxY };
  }

  private computeChildrenBox(children: RTreeNode<T>[]): BoundingBox {
    if (children.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    let minX = children[0].box.minX;
    let minY = children[0].box.minY;
    let maxX = children[0].box.maxX;
    let maxY = children[0].box.maxY;

    for (let i = 1; i < children.length; i++) {
      minX = Math.min(minX, children[i].box.minX);
      minY = Math.min(minY, children[i].box.minY);
      maxX = Math.max(maxX, children[i].box.maxX);
      maxY = Math.max(maxY, children[i].box.maxY);
    }

    return { minX, minY, maxX, maxY };
  }
}
