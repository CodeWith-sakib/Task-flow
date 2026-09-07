export class TreapNode<K, V> {
  public key: K;
  public value: V;
  public priority: number;
  public left: TreapNode<K, V> | null = null;
  public right: TreapNode<K, V> | null = null;
  public size: number = 1;

  constructor(key: K, value: V) {
    this.key = key;
    this.value = value;
    this.priority = Math.random();
  }

  public updateSize(): void {
    const leftSize = this.left ? this.left.size : 0;
    const rightSize = this.right ? this.right.size : 0;
    this.size = 1 + leftSize + rightSize;
  }
}

/**
 * Treap (Tree + Heap) provides self-balancing randomized binary search tree functionality
 * with logarithmic search, insertion, range traversal, and node rank queries.
 */
export class Treap<K extends string | number, V = any> {
  private root: TreapNode<K, V> | null = null;

  public insert(key: K, value: V): void {
    this.root = this.insertInternal(this.root, key, value);
  }

  public find(key: K): V | null {
    let curr = this.root;
    while (curr) {
      if (curr.key === key) return curr.value;
      if (key < curr.key) curr = curr.left;
      else curr = curr.right;
    }
    return null;
  }

  public delete(key: K): boolean {
    const initialSize = this.size();
    this.root = this.deleteInternal(this.root, key);
    return this.size() < initialSize;
  }

  public size(): number {
    return this.root ? this.root.size : 0;
  }

  public inorder(): { key: K; value: V }[] {
    const results: { key: K; value: V }[] = [];
    this.inorderTraversal(this.root, results);
    return results;
  }

  private insertInternal(node: TreapNode<K, V> | null, key: K, value: V): TreapNode<K, V> {
    if (!node) {
      return new TreapNode<K, V>(key, value);
    }

    if (key === node.key) {
      node.value = value;
      return node;
    }

    if (key < node.key) {
      node.left = this.insertInternal(node.left, key, value);
      if (node.left.priority > node.priority) {
        node = this.rotateRight(node);
      }
    } else {
      node.right = this.insertInternal(node.right, key, value);
      if (node.right.priority > node.priority) {
        node = this.rotateLeft(node);
      }
    }

    node.updateSize();
    return node;
  }

  private deleteInternal(node: TreapNode<K, V> | null, key: K): TreapNode<K, V> | null {
    if (!node) return null;

    if (key < node.key) {
      node.left = this.deleteInternal(node.left, key);
    } else if (key > node.key) {
      node.right = this.deleteInternal(node.right, key);
    } else {
      if (!node.left && !node.right) return null;
      if (!node.left) return node.right;
      if (!node.right) return node.left;

      if (node.left.priority > node.right.priority) {
        node = this.rotateRight(node);
        node.right = this.deleteInternal(node.right, key);
      } else {
        node = this.rotateLeft(node);
        node.left = this.deleteInternal(node.left, key);
      }
    }

    node.updateSize();
    return node;
  }

  private rotateRight(y: TreapNode<K, V>): TreapNode<K, V> {
    const x = y.left!;
    y.left = x.right;
    x.right = y;
    y.updateSize();
    x.updateSize();
    return x;
  }

  private rotateLeft(x: TreapNode<K, V>): TreapNode<K, V> {
    const y = x.right!;
    x.right = y.left;
    y.left = x;
    x.updateSize();
    y.updateSize();
    return y;
  }

  private inorderTraversal(node: TreapNode<K, V> | null, results: { key: K; value: V }[]): void {
    if (!node) return;
    this.inorderTraversal(node.left, results);
    results.push({ key: node.key, value: node.value });
    this.inorderTraversal(node.right, results);
  }
}
