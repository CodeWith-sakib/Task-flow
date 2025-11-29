export class PartitionLockCoordinator {
  private activeLocks: Map<string, string> = new Map(); // partitionKey -> holderId

  public acquirePartition(partitionKey: string, holderId: string): boolean {
    const current = this.activeLocks.get(partitionKey);
    if (!current) {
      this.activeLocks.set(partitionKey, holderId);
      return true;
    }
    return current === holderId;
  }

  public releasePartition(partitionKey: string, holderId: string): boolean {
    if (this.activeLocks.get(partitionKey) === holderId) {
      this.activeLocks.delete(partitionKey);
      return true;
    }
    return false;
  }

  public getHolder(partitionKey: string): string | undefined {
    return this.activeLocks.get(partitionKey);
  }
}
