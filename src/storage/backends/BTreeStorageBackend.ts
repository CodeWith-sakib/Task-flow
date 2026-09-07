export interface BTreeNode<K, V> {
  keys: K[];
  values?: V[]; // Only in leaf nodes
  children?: BTreeNode<K, V>[]; // Only in internal nodes
  next?: BTreeNode<K, V> | null; // Leaf linked-list pointer
  isLeaf: boolean;
}

/**
 * BTreeStorageBackend implements a B+ Tree index supporting O(log N) point lookups,
 * range scans along leaf sibling pointers, and automatic page splitting.
 */
export class BTreeStorageBackend<K extends string | number, V = any> {
  private root: BTreeNode<K, V>;
  private order: number;
  private length: number = 0;

  constructor(order: number = 32) {
    this.order = Math.max(3, order);
    this.root = {
      keys: [],
      values: [],
      next: null,
      isLeaf: true
    };
  }

  public get(key: K): V | null {
    let leaf = this.findLeafNode(key);
    for (let i = 0; i < leaf.keys.length; i++) {
      if (leaf.keys[i] === key) {
        return leaf.values![i];
      }
    }
    return null;
  }

  public put(key: K, value: V): void {
    let leaf = this.findLeafNode(key);
    for (let i = 0; i < leaf.keys.length; i++) {
      if (leaf.keys[i] === key) {
        leaf.values![i] = value;
        return;
      }
    }

    // Insert key into leaf in sorted order
    let insertIdx = 0;
    while (insertIdx < leaf.keys.length && leaf.keys[insertIdx] < key) {
      insertIdx++;
    }

    leaf.keys.splice(insertIdx, 0, key);
    leaf.values!.splice(insertIdx, 0, value);
    this.length++;

    if (leaf.keys.length >= this.order) {
      this.splitLeaf(leaf);
    }
  }

  public range(startKey: K, endKey: K, limit: number = 100): { key: K; value: V }[] {
    const results: { key: K; value: V }[] = [];
    let leaf: BTreeNode<K, V> | null = this.findLeafNode(startKey);

    while (leaf && results.length < limit) {
      for (let i = 0; i < leaf.keys.length; i++) {
        if (leaf.keys[i] >= startKey && leaf.keys[i] <= endKey) {
          results.push({ key: leaf.keys[i], value: leaf.values![i] });
          if (results.length >= limit) break;
        }
        if (leaf.keys[i] > endKey) {
          return results;
        }
      }
      leaf = leaf.next ?? null;
    }

    return results;
  }

  public size(): number {
    return this.length;
  }

  private findLeafNode(key: K): BTreeNode<K, V> {
    let current = this.root;
    while (!current.isLeaf) {
      let idx = 0;
      while (idx < current.keys.length && key >= current.keys[idx]) {
        idx++;
      }
      current = current.children![idx];
    }
    return current;
  }

  private splitLeaf(leaf: BTreeNode<K, V>): void {
    const mid = Math.floor(leaf.keys.length / 2);
    const newLeaf: BTreeNode<K, V> = {
      keys: leaf.keys.splice(mid),
      values: leaf.values!.splice(mid),
      next: leaf.next,
      isLeaf: true
    };
    leaf.next = newLeaf;

    if (leaf === this.root) {
      const newRoot: BTreeNode<K, V> = {
        keys: [newLeaf.keys[0]],
        children: [leaf, newLeaf],
        isLeaf: false
      };
      this.root = newRoot;
    } else {
      this.insertIntoParent(leaf, newLeaf.keys[0], newLeaf);
    }
  }

  private insertIntoParent(left: BTreeNode<K, V>, key: K, right: BTreeNode<K, V>): void {
    const parent = this.findParent(this.root, left);
    if (!parent) return;

    let idx = 0;
    while (idx < parent.keys.length && parent.keys[idx] < key) {
      idx++;
    }

    parent.keys.splice(idx, 0, key);
    parent.children!.splice(idx + 1, 0, right);

    if (parent.keys.length >= this.order) {
      this.splitInternal(parent);
    }
  }

  private splitInternal(node: BTreeNode<K, V>): void {
    const mid = Math.floor(node.keys.length / 2);
    const promoteKey = node.keys[mid];

    const newInternal: BTreeNode<K, V> = {
      keys: node.keys.splice(mid + 1),
      children: node.children!.splice(mid + 1),
      isLeaf: false
    };
    node.keys.splice(mid, 1);

    if (node === this.root) {
      this.root = {
        keys: [promoteKey],
        children: [node, newInternal],
        isLeaf: false
      };
    } else {
      this.insertIntoParent(node, promoteKey, newInternal);
    }
  }

  private findParent(current: BTreeNode<K, V>, target: BTreeNode<K, V>): BTreeNode<K, V> | null {
    if (current.isLeaf || !current.children) return null;
    for (const child of current.children) {
      if (child === target) return current;
      const found = this.findParent(child, target);
      if (found) return found;
    }
    return null;
  }
}
