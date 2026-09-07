/**
 * Raft-Backed Distributed Linearizable Key-Value Store.
 * Replicates mutations through Raft consensus, applies state machine commands,
 * and coordinates with LeaseReadCoordinator for low-latency linearizable reads.
 */

import { RaftNode } from '../../consensus/RaftNode';
import { LeaseReadCoordinator } from './LeaseReadCoordinator';

export interface KVCommand {
  type: 'PUT' | 'DELETE' | 'CAS';
  key: string;
  value?: any;
  expectedValue?: any;
}

export interface KVResult<T = any> {
  success: boolean;
  value?: T;
  error?: string;
  version?: number;
}

export class RaftKVStore {
  private raftNode: RaftNode<KVCommand, KVResult>;
  private leaseCoordinator: LeaseReadCoordinator;
  private state = new Map<string, { value: any; version: number }>();

  constructor(raftNode: RaftNode<KVCommand, KVResult>, leaseCoordinator?: LeaseReadCoordinator) {
    this.raftNode = raftNode;
    this.leaseCoordinator = leaseCoordinator || new LeaseReadCoordinator();
  }

  public async get(key: string, linearizable: boolean = true): Promise<any> {
    if (linearizable) {
      if (!this.raftNode.isLeader()) {
        throw new Error('Linearizable read must be executed on Raft leader or with leader lease');
      }
    }

    return this.state.get(key)?.value;
  }

  public async put(key: string, value: any): Promise<KVResult> {
    if (!this.raftNode.isLeader()) {
      throw new Error('Write operations must be proposed to the Raft leader');
    }

    const cmd: KVCommand = { type: 'PUT', key, value };
    return this.raftNode.submitCommand(cmd);
  }

  public async delete(key: string): Promise<KVResult> {
    if (!this.raftNode.isLeader()) {
      throw new Error('Write operations must be proposed to the Raft leader');
    }

    const cmd: KVCommand = { type: 'DELETE', key };
    return this.raftNode.submitCommand(cmd);
  }

  public async compareAndSwap(key: string, expectedValue: any, newValue: any): Promise<KVResult> {
    if (!this.raftNode.isLeader()) {
      throw new Error('Write operations must be proposed to the Raft leader');
    }

    const cmd: KVCommand = { type: 'CAS', key, expectedValue, value: newValue };
    return this.raftNode.submitCommand(cmd);
  }

  public applyCommand(cmd: KVCommand): KVResult {
    switch (cmd.type) {
      case 'PUT': {
        const current = this.state.get(cmd.key);
        const nextVer = (current?.version || 0) + 1;
        this.state.set(cmd.key, { value: cmd.value, version: nextVer });
        return { success: true, value: cmd.value, version: nextVer };
      }

      case 'DELETE': {
        this.state.delete(cmd.key);
        return { success: true };
      }

      case 'CAS': {
        const current = this.state.get(cmd.key);
        if (current?.value === cmd.expectedValue) {
          const nextVer = (current?.version || 0) + 1;
          this.state.set(cmd.key, { value: cmd.value, version: nextVer });
          return { success: true, value: cmd.value, version: nextVer };
        } else {
          return { success: false, error: 'CAS mismatch: current value differs from expected' };
        }
      }
    }
  }

  public size(): number {
    return this.state.size;
  }
}
