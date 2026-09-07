/**
 * In-Memory & Block-Ready B+ Tree Index implementation.
 * Provides logarithmic search, insertion, deletion, and efficient range scans.
 * All values reside in leaf nodes, linked sequentially for high-performance range queries.
 */

export interface BPlusTreeNode<K, V> {
  isLeaf: boolean;
  keys: K[];
  next?: BPlusTreeLeafNode<K, V> | null;
  prev?: BPlusTreeLeafNode<K, V> | null;
}

export interface BPlusTreeInternalNode<K, V> extends BPlusTreeNode<K, V> {
  isLeaf: false;
  children: BPlusTreeNode<K, V>[];
}

export interface BPlusTreeLeafNode<K, V> extends BPlusTreeNode<K, V> {
  isLeaf: true;
  values: V[];
  next: BPlusTreeLeafNode<K, V> | null;
  prev: BPlusTreeLeafNode<K, V> | null;
}

export type Comparator<K> = (a: K, b: K) => number;

export function defaultComparator<K>(a: K, b: K): number {
  if (a === b) return 0;
  if (a < b) return -1;
  return 1;
}

export class BPlusTreeIndex<K, V> {
  private root: BPlusTreeNode<K, V>;
  private order: number;
  private comparator: Comparator<K>;
  private sizeCount: number = 0;

  constructor(order: number = 4, comparator: Comparator<K> = defaultComparator) {
    if (order < 3) {
      throw new Error('BPlusTree order must be at least 3');
    }
    this.order = order;
    this.comparator = comparator;
    this.root = this.createLeafNode();
  }

  public size(): number {
    return this.sizeCount;
  }

  public get(key: K): V | undefined {
    const leaf = this.findLeaf(this.root, key);
    for (let i = 0; i < leaf.keys.length; i++) {
      if (this.comparator(leaf.keys[i], key) === 0) {
        return leaf.values[i];
      }
    }
    return undefined;
  }

  public has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  public insert(key: K, value: V): void {
    const leaf = this.findLeaf(this.root, key);

    // Check if key already exists in leaf
    for (let i = 0; i < leaf.keys.length; i++) {
      if (this.comparator(leaf.keys[i], key) === 0) {
        leaf.values[i] = value;
        return;
      }
    }

    // Insert into leaf in sorted position
    let insertIdx = 0;
    while (insertIdx < leaf.keys.length && this.comparator(leaf.keys[insertIdx], key) < 0) {
      insertIdx++;
    }

    leaf.keys.splice(insertIdx, 0, key);
    leaf.values.splice(insertIdx, 0, value);
    this.sizeCount++;

    // Check overflow
    if (leaf.keys.length >= this.order) {
      this.splitLeaf(leaf);
    }
  }

  public delete(key: K): boolean {
    const leaf = this.findLeaf(this.root, key);
    let removeIdx = -1;

    for (let i = 0; i < leaf.keys.length; i++) {
      if (this.comparator(leaf.keys[i], key) === 0) {
        removeIdx = i;
        break;
      }
    }

    if (removeIdx === -1) {
      return false;
    }

    leaf.keys.splice(removeIdx, 1);
    leaf.values.splice(removeIdx, 1);
    this.sizeCount--;
    return true;
  }

  public rangeScan(minKey?: K, maxKey?: K): { key: K; value: V }[] {
    const results: { key: K; value: V }[] = [];

    let leaf: BPlusTreeLeafNode<K, V> | null = minKey !== undefined ? this.findLeaf(this.root, minKey) : this.getFirstLeaf();

    while (leaf) {
      for (let i = 0; i < leaf.keys.length; i++) {
        const k = leaf.keys[i];
        if (minKey !== undefined && this.comparator(k, minKey) < 0) {
          continue;
        }
        if (maxKey !== undefined && this.comparator(k, maxKey) > 0) {
          return results;
        }
        results.push({ key: k, value: leaf.values[i] });
      }
      leaf = leaf.next;
    }

    return results;
  }

  private findLeaf(node: BPlusTreeNode<K, V>, key: K): BPlusTreeLeafNode<K, V> {
    if (node.isLeaf) {
      return node as BPlusTreeLeafNode<K, V>;
    }

    const internal = node as BPlusTreeInternalNode<K, V>;
    let childIdx = 0;

    while (childIdx < internal.keys.length && this.comparator(key, internal.keys[childIdx]) >= 0) {
      childIdx++;
    }

    return this.findLeaf(internal.children[childIdx], key);
  }

  private getFirstLeaf(): BPlusTreeLeafNode<K, V> {
    let curr = this.root;
    while (!curr.isLeaf) {
      curr = (curr as BPlusTreeInternalNode<K, V>).children[0];
    }
    return curr as BPlusTreeLeafNode<K, V>;
  }

  private splitLeaf(leaf: BPlusTreeLeafNode<K, V>): void {
    const mid = Math.floor(leaf.keys.length / 2);
    const newLeaf = this.createLeafNode();

    newLeaf.keys = leaf.keys.splice(mid);
    newLeaf.values = leaf.values.splice(mid);

    newLeaf.next = leaf.next;
    if (newLeaf.next) {
      newLeaf.next.prev = newLeaf;
    }
    leaf.next = newLeaf;
    newLeaf.prev = leaf;

    const promotedKey = newLeaf.keys[0];

    if (leaf === this.root) {
      const newRoot: BPlusTreeInternalNode<K, V> = {
        isLeaf: false,
        keys: [promotedKey],
        children: [leaf, newLeaf],
      };
      this.root = newRoot;
    } else {
      this.insertIntoParent(leaf, promotedKey, newLeaf);
    }
  }

  private splitInternal(internal: BPlusTreeInternalNode<K, V>): void {
    const mid = Math.floor(internal.keys.length / 2);
    const promotedKey = internal.keys[mid];

    const newInternal: BPlusTreeInternalNode<K, V> = {
      isLeaf: false,
      keys: internal.keys.splice(mid + 1),
      children: internal.children.splice(mid + 1),
    };

    // Remove the promoted key from left node
    internal.keys.splice(mid, 1);

    if (internal === this.root) {
      const newRoot: BPlusTreeInternalNode<K, V> = {
        isLeaf: false,
        keys: [promotedKey],
        children: [internal, newInternal],
      };
      this.root = newRoot;
    } else {
      this.insertIntoParent(internal, promotedKey, newInternal);
    }
  }

  private insertIntoParent(
    left: BPlusTreeNode<K, V>,
    key: K,
    right: BPlusTreeNode<K, V>
  ): void {
    const parent = this.findParent(this.root, left) as BPlusTreeInternalNode<K, V>;
    if (!parent) return;

    let idx = 0;
    while (idx < parent.keys.length && this.comparator(parent.keys[idx], key) < 0) {
      idx++;
    }

    parent.keys.splice(idx, 0, key);
    parent.children.splice(idx + 1, 0, right);

    if (parent.keys.length >= this.order) {
      this.splitInternal(parent);
    }
  }

  private findParent(
    current: BPlusTreeNode<K, V>,
    target: BPlusTreeNode<K, V>
  ): BPlusTreeInternalNode<K, V> | null {
    if (current.isLeaf || (current as BPlusTreeInternalNode<K, V>).children[0].isLeaf) {
      const internal = current as BPlusTreeInternalNode<K, V>;
      if (!current.isLeaf && internal.children.includes(target)) {
        return internal;
      }
      return null;
    }

    const internal = current as BPlusTreeInternalNode<K, V>;
    for (const child of internal.children) {
      if (child === target) {
        return internal;
      }
      const p = this.findParent(child, target);
      if (p) return p;
    }

    return null;
  }

  private createLeafNode(): BPlusTreeLeafNode<K, V> {
    return {
      isLeaf: true,
      keys: [],
      values: [],
      next: null,
      prev: null,
    };
  }
}
