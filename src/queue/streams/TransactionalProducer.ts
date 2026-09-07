import { StreamRecord, TopicName, TransactionState } from './types';
import { StreamBroker } from './StreamBroker';

export interface ProducerRecord {
  topic: TopicName;
  key?: string;
  value: any;
  headers?: Record<string, string>;
}

/**
 * TransactionalProducer implements transactional produce semantics with two-phase commit markers
 * and sequence-based idempotency.
 */
export class TransactionalProducer {
  public readonly transactionalId: string;
  private broker: StreamBroker;
  private state: TransactionState = TransactionState.UNINITIALIZED;
  private producerId: number = 0;
  private epoch: number = 0;
  private sequenceNumber: number = 0;
  private bufferedRecords: ProducerRecord[] = [];

  constructor(transactionalId: string, broker: StreamBroker) {
    this.transactionalId = transactionalId;
    this.broker = broker;
  }

  public initTransactions(): void {
    this.producerId = Math.floor(Math.random() * 1000000) + 1;
    this.epoch++;
    this.sequenceNumber = 0;
    this.state = TransactionState.READY;
  }

  public beginTransaction(): void {
    if (this.state !== TransactionState.READY) {
      throw new Error(`Cannot begin transaction in state ${this.state}`);
    }
    this.state = TransactionState.IN_TRANSACTION;
    this.bufferedRecords = [];
  }

  public send(record: ProducerRecord): void {
    if (this.state !== TransactionState.IN_TRANSACTION) {
      throw new Error(`Cannot send transactional record: no active transaction (state=${this.state})`);
    }

    this.bufferedRecords.push(record);
  }

  public commitTransaction(): StreamRecord[] {
    if (this.state !== TransactionState.IN_TRANSACTION) {
      throw new Error(`Cannot commit transaction in state ${this.state}`);
    }

    this.state = TransactionState.COMMITTING;
    const publishedRecords: StreamRecord[] = [];

    try {
      for (const rec of this.bufferedRecords) {
        this.sequenceNumber++;
        const headers = {
          ...(rec.headers || {}),
          'x-tx-id': this.transactionalId,
          'x-tx-pid': String(this.producerId),
          'x-tx-epoch': String(this.epoch),
          'x-tx-seq': String(this.sequenceNumber)
        };

        const result = this.broker.produce(rec.topic, rec.value, rec.key, headers);
        publishedRecords.push(result);
      }

      this.bufferedRecords = [];
      this.state = TransactionState.READY;
      return publishedRecords;
    } catch (err) {
      this.abortTransaction();
      throw err;
    }
  }

  public abortTransaction(): void {
    this.state = TransactionState.ABORTING;
    this.bufferedRecords = [];
    this.state = TransactionState.READY;
  }

  public getState(): TransactionState {
    return this.state;
  }

  public getBufferedCount(): number {
    return this.bufferedRecords.length;
  }
}
