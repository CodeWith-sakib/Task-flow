import * as crypto from 'crypto';

export interface ILockNode {
  nodeId: string;
  acquire(resource: string, value: string, ttlMs: number): Promise<boolean>;
  release(resource: string, value: string): Promise<boolean>;
}

export interface RedlockHandle {
  resource: string;
  value: string;
  validityMs: number;
  acquiredAt: number;
}

/**
 * RedlockCoordinator implements the distributed multi-node consensus Redlock algorithm.
 */
export class RedlockCoordinator {
  private nodes: ILockNode[];
  private quorum: number;
  private clockDriftFactor: number = 0.01;

  constructor(nodes: ILockNode[]) {
    this.nodes = nodes;
    this.quorum = Math.floor(nodes.length / 2) + 1;
  }

  public async acquire(resource: string, ttlMs: number = 10000): Promise<RedlockHandle | null> {
    const value = crypto.randomBytes(16).toString('hex');
    const startTime = Date.now();
    let acquiredNodes: ILockNode[] = [];

    const promises = this.nodes.map(async node => {
      try {
        const ok = await node.acquire(resource, value, ttlMs);
        if (ok) acquiredNodes.push(node);
      } catch {
        // Node failure
      }
    });

    await Promise.allSettled(promises);

    const elapsed = Date.now() - startTime;
    const drift = (ttlMs * this.clockDriftFactor) + 2;
    const validityTime = ttlMs - elapsed - drift;

    if (acquiredNodes.length >= this.quorum && validityTime > 0) {
      return {
        resource,
        value,
        validityMs: validityTime,
        acquiredAt: Date.now()
      };
    }

    // Failed to acquire quorum within validity period: unlock all acquired nodes
    await this.release({ resource, value, validityMs: 0, acquiredAt: 0 });
    return null;
  }

  public async release(handle: RedlockHandle): Promise<void> {
    const promises = this.nodes.map(node =>
      node.release(handle.resource, handle.value).catch(() => false)
    );
    await Promise.allSettled(promises);
  }
}
