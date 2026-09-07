/**
 * Active Anti-Entropy State Synchronization.
 * Uses Merkle trees and key-range digests to exchange differences between
 * distributed cluster nodes with minimal network bandwidth overhead.
 */

import * as crypto from 'crypto';

export interface KeyDigest {
  key: string;
  version: number;
  hash: string;
}

export interface RangeDigest {
  rangeStart: string;
  rangeEnd: string;
  treeHash: string;
  count: number;
}

export class AntiEntropyStateSync {
  private localState = new Map<string, { version: number; payload: string; hash: string }>();

  public put(key: string, version: number, payload: string): void {
    const hash = crypto.createHash('sha256').update(`${version}:${payload}`).digest('hex');
    this.localState.set(key, { version, payload, hash });
  }

  public get(key: string): { version: number; payload: string; hash: string } | undefined {
    return this.localState.get(key);
  }

  public generateDigests(partitionCount: number = 4): RangeDigest[] {
    const sortedKeys = Array.from(this.localState.keys()).sort();
    if (sortedKeys.length === 0) {
      return [{ rangeStart: '', rangeEnd: '', treeHash: '', count: 0 }];
    }

    const chunkSize = Math.max(1, Math.ceil(sortedKeys.length / partitionCount));
    const digests: RangeDigest[] = [];

    for (let i = 0; i < sortedKeys.length; i += chunkSize) {
      const chunkKeys = sortedKeys.slice(i, i + chunkSize);
      const hasher = crypto.createHash('sha256');

      for (const k of chunkKeys) {
        const item = this.localState.get(k)!;
        hasher.update(`${k}:${item.version}:${item.hash}`);
      }

      digests.push({
        rangeStart: chunkKeys[0],
        rangeEnd: chunkKeys[chunkKeys.length - 1],
        treeHash: hasher.digest('hex'),
        count: chunkKeys.length,
      });
    }

    return digests;
  }

  /**
   * Compares remote digests against local state and returns keys that need to be synchronized.
   */
  public findDifferences(remoteDigests: RangeDigest[]): { missingOrStaleKeys: string[]; extraKeys: string[] } {
    const missingOrStaleKeys: string[] = [];
    const extraKeys: string[] = [];

    const localDigests = this.generateDigests(remoteDigests.length);

    for (let i = 0; i < remoteDigests.length; i++) {
      const remote = remoteDigests[i];
      const local = localDigests[i];

      if (!local || local.treeHash !== remote.treeHash) {
        // Range mismatch: identify divergent keys in range [remote.rangeStart, remote.rangeEnd]
        const rangeKeys = Array.from(this.localState.keys()).filter((k) => {
          if (remote.rangeStart && k < remote.rangeStart) return false;
          if (remote.rangeEnd && k > remote.rangeEnd) return false;
          return true;
        });

        missingOrStaleKeys.push(...rangeKeys);
      }
    }

    return {
      missingOrStaleKeys: Array.from(new Set(missingOrStaleKeys)),
      extraKeys,
    };
  }
}
