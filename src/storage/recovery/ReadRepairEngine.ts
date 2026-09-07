export interface ReplicaReadResult<V = any> {
  replicaId: string;
  value: V | null;
  version: number;
  timestamp: number;
}

export interface IReplicaNode<V = any> {
  id: string;
  write(key: string, value: V, version: number): Promise<void>;
}

/**
 * ReadRepairEngine performs asynchronous anti-entropy reconciliation when divergent replica versions
 * are detected during quorum read operations.
 */
export class ReadRepairEngine<V = any> {
  private replicas: Map<string, IReplicaNode<V>> = new Map();

  public registerReplica(replica: IReplicaNode<V>): void {
    this.replicas.set(replica.id, replica);
  }

  public evaluateAndRepair(key: string, readResults: ReplicaReadResult<V>[]): {
    reconciledValue: V | null;
    highestVersion: number;
    staleReplicas: string[];
  } {
    if (readResults.length === 0) {
      return { reconciledValue: null, highestVersion: 0, staleReplicas: [] };
    }

    // Find highest version
    let newest = readResults[0];
    for (let i = 1; i < readResults.length; i++) {
      if (readResults[i].version > newest.version) {
        newest = readResults[i];
      }
    }

    const staleReplicas: string[] = [];
    for (const res of readResults) {
      if (res.version < newest.version) {
        staleReplicas.push(res.replicaId);
        // Async background write repair
        const replica = this.replicas.get(res.replicaId);
        if (replica && newest.value !== null) {
          replica.write(key, newest.value, newest.version).catch(() => {});
        }
      }
    }

    return {
      reconciledValue: newest.value,
      highestVersion: newest.version,
      staleReplicas
    };
  }
}
