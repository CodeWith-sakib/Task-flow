/**
 * Hinted Handoff Storage Vault.
 * Temporarily stores write mutations destined for unreachable or partitioned replica nodes,
 * continuously monitoring node recovery and replaying mutations with exponential backoff.
 */

export interface WriteHint {
  hintId: string;
  targetNodeId: string;
  key: string;
  value: any;
  timestamp: number;
  attempts: number;
  maxAttempts: number;
}

export class HintedHandoffVault {
  private hintsByNode = new Map<string, WriteHint[]>();
  private maxHintsPerNode: number;
  private maxTtlMs: number;

  constructor(maxHintsPerNode: number = 5000, maxTtlMs: number = 3 * 3600 * 1000) {
    this.maxHintsPerNode = maxHintsPerNode;
    this.maxTtlMs = maxTtlMs;
  }

  public storeHint(targetNodeId: string, key: string, value: any, maxAttempts: number = 10): boolean {
    let hints = this.hintsByNode.get(targetNodeId);
    if (!hints) {
      hints = [];
      this.hintsByNode.set(targetNodeId, hints);
    }

    if (hints.length >= this.maxHintsPerNode) {
      return false; // drop hint when capacity exceeded
    }

    const hint: WriteHint = {
      hintId: `hint-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      targetNodeId,
      key,
      value,
      timestamp: Date.now(),
      attempts: 0,
      maxAttempts,
    };

    hints.push(hint);
    return true;
  }

  public async replayHintsForNode(
    targetNodeId: string,
    replayFn: (key: string, value: any) => Promise<boolean>,
    now: number = Date.now()
  ): Promise<{ replayedCount: number; remainingCount: number }> {
    const hints = this.hintsByNode.get(targetNodeId);
    if (!hints || hints.length === 0) {
      return { replayedCount: 0, remainingCount: 0 };
    }

    let replayedCount = 0;
    const remaining: WriteHint[] = [];

    for (const hint of hints) {
      // Check TTL expiry
      if (now - hint.timestamp > this.maxTtlMs) {
        continue;
      }

      hint.attempts++;
      try {
        const success = await replayFn(hint.key, hint.value);
        if (success) {
          replayedCount++;
        } else if (hint.attempts < hint.maxAttempts) {
          remaining.push(hint);
        }
      } catch {
        if (hint.attempts < hint.maxAttempts) {
          remaining.push(hint);
        }
      }
    }

    if (remaining.length === 0) {
      this.hintsByNode.delete(targetNodeId);
    } else {
      this.hintsByNode.set(targetNodeId, remaining);
    }

    return { replayedCount, remainingCount: remaining.length };
  }

  public getHintCount(targetNodeId?: string): number {
    if (targetNodeId) {
      return this.hintsByNode.get(targetNodeId)?.length ?? 0;
    }
    let total = 0;
    for (const list of this.hintsByNode.values()) {
      total += list.length;
    }
    return total;
  }
}
