export class RadixNode<V = any> {
  public prefix: string;
  public value?: V;
  public isLeaf: boolean = false;
  public children: Map<string, RadixNode<V>> = new Map();

  constructor(prefix: string, value?: V) {
    this.prefix = prefix;
    this.value = value;
  }
}

/**
 * RadixTreeIndex (Compressed Prefix Tree / Patricia Trie) provides space-optimized
 * string key lookups and prefix range searches.
 */
export class RadixTreeIndex<V = any> {
  private root: RadixNode<V>;
  private count: number = 0;

  constructor() {
    this.root = new RadixNode<V>('');
  }

  public insert(key: string, value: V): void {
    let current = this.root;
    let remaining = key;

    while (remaining.length > 0) {
      let matchedChild: RadixNode<V> | undefined;
      let commonPrefixLen = 0;

      for (const child of current.children.values()) {
        const len = this.getCommonPrefixLength(remaining, child.prefix);
        if (len > 0) {
          matchedChild = child;
          commonPrefixLen = len;
          break;
        }
      }

      if (!matchedChild) {
        // No match: add new child
        const newNode = new RadixNode<V>(remaining, value);
        newNode.isLeaf = true;
        current.children.set(remaining[0], newNode);
        this.count++;
        return;
      }

      if (commonPrefixLen < matchedChild.prefix.length) {
        // Split existing child node
        const splitPrefix = matchedChild.prefix.substring(0, commonPrefixLen);
        const childRemainingPrefix = matchedChild.prefix.substring(commonPrefixLen);

        const splitNode = new RadixNode<V>(splitPrefix);
        current.children.set(splitPrefix[0], splitNode);

        matchedChild.prefix = childRemainingPrefix;
        splitNode.children.set(childRemainingPrefix[0], matchedChild);

        const newRemaining = remaining.substring(commonPrefixLen);
        if (newRemaining.length === 0) {
          splitNode.value = value;
          splitNode.isLeaf = true;
          this.count++;
          return;
        } else {
          const newNode = new RadixNode<V>(newRemaining, value);
          newNode.isLeaf = true;
          splitNode.children.set(newRemaining[0], newNode);
          this.count++;
          return;
        }
      }

      // Exact match with child prefix
      remaining = remaining.substring(commonPrefixLen);
      current = matchedChild;
    }

    current.value = value;
    if (!current.isLeaf) {
      current.isLeaf = true;
      this.count++;
    }
  }

  public find(key: string): V | undefined {
    let current = this.root;
    let remaining = key;

    while (remaining.length > 0) {
      const char = remaining[0];
      const child = current.children.get(char);
      if (!child) return undefined;

      if (!remaining.startsWith(child.prefix)) {
        return undefined;
      }

      remaining = remaining.substring(child.prefix.length);
      current = child;
    }

    return current.isLeaf ? current.value : undefined;
  }

  public findByPrefix(prefix: string): { key: string; value: V }[] {
    let current = this.root;
    let remaining = prefix;
    let accumulatedPath = '';

    while (remaining.length > 0) {
      const char = remaining[0];
      const child = current.children.get(char);
      if (!child) return [];

      const commonLen = this.getCommonPrefixLength(remaining, child.prefix);
      if (commonLen === remaining.length) {
        accumulatedPath += child.prefix;
        current = child;
        break;
      } else if (commonLen < child.prefix.length) {
        return [];
      }

      accumulatedPath += child.prefix;
      remaining = remaining.substring(child.prefix.length);
      current = child;
    }

    const results: { key: string; value: V }[] = [];
    this.collectAllLeaves(current, accumulatedPath, results);
    return results;
  }

  public size(): number {
    return this.count;
  }

  private getCommonPrefixLength(a: string, b: string): number {
    const minLen = Math.min(a.length, b.length);
    let i = 0;
    while (i < minLen && a[i] === b[i]) {
      i++;
    }
    return i;
  }

  private collectAllLeaves(node: RadixNode<V>, currentPath: string, results: { key: string; value: V }[]): void {
    if (node.isLeaf && node.value !== undefined) {
      results.push({ key: currentPath, value: node.value });
    }

    for (const child of node.children.values()) {
      this.collectAllLeaves(child, currentPath + child.prefix, results);
    }
  }
}
