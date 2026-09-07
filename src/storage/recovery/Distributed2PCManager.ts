export type ParticipantId = string;

export interface IParticipant {
  id: ParticipantId;
  prepare(txId: string): Promise<boolean>;
  commit(txId: string): Promise<void>;
  abort(txId: string): Promise<void>;
}

export enum TransactionPhase {
  INITIATED = 'INITIATED',
  PREPARING = 'PREPARING',
  PREPARED = 'PREPARED',
  COMMITTING = 'COMMITTING',
  COMMITTED = 'COMMITTED',
  ABORTING = 'ABORTING',
  ABORTED = 'ABORTED'
}

/**
 * Distributed2PCManager coordinates atomic transactions across distributed storage and queue participants.
 */
export class Distributed2PCManager {
  private participants: Map<ParticipantId, IParticipant> = new Map();
  private transactionStates: Map<string, TransactionPhase> = new Map();

  public registerParticipant(participant: IParticipant): void {
    this.participants.set(participant.id, participant);
  }

  public async executeTransaction(txId: string): Promise<boolean> {
    this.transactionStates.set(txId, TransactionPhase.PREPARING);

    const participantList = Array.from(this.participants.values());
    const preparedList: IParticipant[] = [];

    // Phase 1: Prepare
    let allPrepared = true;
    for (const p of participantList) {
      try {
        const canCommit = await p.prepare(txId);
        if (canCommit) {
          preparedList.push(p);
        } else {
          allPrepared = false;
          break;
        }
      } catch {
        allPrepared = false;
        break;
      }
    }

    if (!allPrepared) {
      // Phase 2: Abort
      this.transactionStates.set(txId, TransactionPhase.ABORTING);
      for (const p of preparedList) {
        try {
          await p.abort(txId);
        } catch {
          // Ignore abort error
        }
      }
      this.transactionStates.set(txId, TransactionPhase.ABORTED);
      return false;
    }

    // Phase 2: Commit
    this.transactionStates.set(txId, TransactionPhase.COMMITTING);
    for (const p of participantList) {
      await p.commit(txId);
    }
    this.transactionStates.set(txId, TransactionPhase.COMMITTED);
    return true;
  }

  public getTransactionPhase(txId: string): TransactionPhase | undefined {
    return this.transactionStates.get(txId);
  }
}
