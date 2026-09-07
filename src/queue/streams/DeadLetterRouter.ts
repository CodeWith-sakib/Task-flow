import { StreamRecord, TopicName } from './types';
import { StreamBroker } from './StreamBroker';

export interface DLQRouteOptions {
  dlqTopicSuffix?: string;
  maxRetryAttempts?: number;
  includeStackTrace?: boolean;
}

export interface DLQRecordMeta {
  originalTopic: TopicName;
  originalPartition: number;
  originalOffset: number;
  failureReason: string;
  stackTrace?: string;
  retryCount: number;
  failedAt: number;
}

/**
 * DeadLetterRouter routes defective or unprocessable stream messages to designated
 * Dead Letter Topics with rich error provenance metadata and triage classification.
 */
export class DeadLetterRouter {
  private broker: StreamBroker;
  private options: Required<DLQRouteOptions>;

  constructor(broker: StreamBroker, options?: DLQRouteOptions) {
    this.broker = broker;
    this.options = {
      dlqTopicSuffix: options?.dlqTopicSuffix ?? '.DLQ',
      maxRetryAttempts: options?.maxRetryAttempts ?? 3,
      includeStackTrace: options?.includeStackTrace ?? true
    };
  }

  public routeToDLQ(record: StreamRecord, error: Error, retryCount: number): StreamRecord {
    const dlqTopicName = `${record.topic}${this.options.dlqTopicSuffix}`;

    // Ensure DLQ topic exists
    if (this.broker.getTopicPartitions(dlqTopicName) === 0) {
      this.broker.createTopic({
        name: dlqTopicName,
        partitions: 1,
        replicationFactor: 1
      });
    }

    const dlqMeta: DLQRecordMeta = {
      originalTopic: record.topic,
      originalPartition: record.partition,
      originalOffset: record.offset,
      failureReason: error.message,
      stackTrace: this.options.includeStackTrace ? error.stack : undefined,
      retryCount,
      failedAt: Date.now()
    };

    const enrichedHeaders: Record<string, string> = {
      ...(record.headers || {}),
      'x-dlq-original-topic': record.topic,
      'x-dlq-original-partition': String(record.partition),
      'x-dlq-original-offset': String(record.offset),
      'x-dlq-failure-reason': error.message,
      'x-dlq-retry-count': String(retryCount),
      'x-dlq-failed-at': String(dlqMeta.failedAt)
    };

    const dlqPayload = {
      originalValue: record.value,
      metadata: dlqMeta
    };

    return this.broker.produce(dlqTopicName, dlqPayload, record.key, enrichedHeaders);
  }

  public shouldQuarantine(retryCount: number): boolean {
    return retryCount >= this.options.maxRetryAttempts;
  }
}
