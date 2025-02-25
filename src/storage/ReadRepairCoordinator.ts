export interface ReplicaValue<T> {
  replicaId: string;
  value: T;
  version: number;
}

export class ReadRepairCoordinator<T> {
  public evaluateReplicas(replicas: ReplicaValue<T>[]): {
    latestValue?: T;
    latestVersion: number;
    staleReplicas: string[];
  } {
    if (replicas.length === 0) {
      return { latestVersion: 0, staleReplicas: [] };
    }

    let latest = replicas[0];
    for (let i = 1; i < replicas.length; i++) {
      if (replicas[i].version > latest.version) {
        latest = replicas[i];
      }
    }

    const staleReplicas = replicas
      .filter(r => r.version < latest.version)
      .map(r => r.replicaId);

    return {
      latestValue: latest.value,
      latestVersion: latest.version,
      staleReplicas
    };
  }
}
