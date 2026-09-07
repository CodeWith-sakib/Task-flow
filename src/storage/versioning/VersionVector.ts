/**
 * Version Vector & Causality Tracker.
 * Tracks partial ordering and causal dependencies among distributed cluster nodes.
 * Distinguishes between ancestor, descendant, identical, and concurrent/conflicting updates.
 */

export type CausalityRelation = 'BEFORE' | 'AFTER' | 'EQUAL' | 'CONCURRENT';

export class VersionVector {
  private versions: Map<string, number>;

  constructor(initialVersions?: Map<string, number> | Record<string, number>) {
    this.versions = new Map();
    if (initialVersions) {
      if (initialVersions instanceof Map) {
        for (const [node, ver] of initialVersions.entries()) {
          this.versions.set(node, ver);
        }
      } else {
        for (const [node, ver] of Object.entries(initialVersions)) {
          this.versions.set(node, ver);
        }
      }
    }
  }

  public get(nodeId: string): number {
    return this.versions.get(nodeId) || 0;
  }

  public increment(nodeId: string): void {
    const current = this.get(nodeId);
    this.versions.set(nodeId, current + 1);
  }

  public set(nodeId: string, version: number): void {
    this.versions.set(nodeId, version);
  }

  public clone(): VersionVector {
    return new VersionVector(new Map(this.versions));
  }

  public toJSON(): Record<string, number> {
    const obj: Record<string, number> = {};
    for (const [node, ver] of this.versions.entries()) {
      obj[node] = ver;
    }
    return obj;
  }

  /**
   * Compares this vector with another vector.
   * Returns:
   * - 'BEFORE': this vector strictly happened-before other
   * - 'AFTER': this vector strictly happened-after other
   * - 'EQUAL': both vectors have identical versions
   * - 'CONCURRENT': independent concurrent edits (conflict)
   */
  public compareTo(other: VersionVector): CausalityRelation {
    let hasGreater = false;
    let hasLesser = false;

    const allNodes = new Set([...this.versions.keys(), ...other.versions.keys()]);

    for (const node of allNodes) {
      const v1 = this.get(node);
      const v2 = other.get(node);

      if (v1 > v2) {
        hasGreater = true;
      } else if (v1 < v2) {
        hasLesser = true;
      }
    }

    if (!hasGreater && !hasLesser) return 'EQUAL';
    if (hasGreater && !hasLesser) return 'AFTER';
    if (!hasGreater && hasLesser) return 'BEFORE';
    return 'CONCURRENT';
  }

  /**
   * Merges another version vector into this one by taking pointwise maximums.
   */
  public merge(other: VersionVector): void {
    for (const [node, otherVer] of other.versions.entries()) {
      const currentVer = this.get(node);
      if (otherVer > currentVer) {
        this.versions.set(node, otherVer);
      }
    }
  }

  public dominates(other: VersionVector): boolean {
    const rel = this.compareTo(other);
    return rel === 'AFTER' || rel === 'EQUAL';
  }
}
