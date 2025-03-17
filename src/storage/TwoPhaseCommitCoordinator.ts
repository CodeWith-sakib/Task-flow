export interface Participant {
  id: string;
  prepare(txId: string): Promise<boolean>;
  commit(txId: string): Promise<void>;
  rollback(txId: string): Promise<void>;
}

export class TwoPhaseCommitCoordinator {
  public async executeTransaction(txId: string, participants: Participant[]): Promise<boolean> {
    const prepared: Participant[] = [];

    for (const p of participants) {
      try {
        const canCommit = await p.prepare(txId);
        if (!canCommit) {
          await this.abort(txId, prepared);
          return false;
        }
        prepared.push(p);
      } catch {
        await this.abort(txId, prepared);
        return false;
      }
    }

    // Phase 2: Commit all
    for (const p of prepared) {
      await p.commit(txId);
    }
    return true;
  }

  private async abort(txId: string, participants: Participant[]): Promise<void> {
    for (const p of participants) {
      try {
        await p.rollback(txId);
      } catch {
        // ignore rollback errors
      }
    }
  }
}
