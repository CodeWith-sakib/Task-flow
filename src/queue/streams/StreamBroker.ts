import { Offset, PartitionId, StreamRecord, TopicConfig, TopicName } from './types';
import { TopicPartition } from './TopicPartition';
import { ConsistentHashRing } from '../../utils/ConsistentHashRing';

/**
 * StreamBroker coordinates partitioned commit-logs across topics,
 * handles record dispatching, and maintains consumer group offset checkpoints.
 */
export class StreamBroker {
  private topics: Map<TopicName, TopicPartition[]> = new Map();
  private topicConfigs: Map<TopicName, TopicConfig> = new Map();
  private groupOffsets: Map<string, Map<string, Offset>> = new Map(); // group -> `${topic}:${partition}` -> offset
  private hashRing: ConsistentHashRing;

  constructor() {
    this.hashRing = new ConsistentHashRing(100);
  }

  public createTopic(config: TopicConfig): void {
    if (this.topics.has(config.name)) {
      return;
    }

    const partitions: TopicPartition[] = [];
    for (let p = 0; p < config.partitions; p++) {
      partitions.push(new TopicPartition(config.name, p, config.segmentMaxBytes));
    }

    this.topics.set(config.name, partitions);
    this.topicConfigs.set(config.name, config);
  }

  public produce(topic: TopicName, value: any, key?: string, headers?: Record<string, string>): StreamRecord {
    const partitions = this.topics.get(topic);
    if (!partitions || partitions.length === 0) {
      throw new Error(`Topic '${topic}' does not exist`);
    }

    let partitionId = 0;
    if (key !== undefined) {
      const hash = this.computeHash(key);
      partitionId = Math.abs(hash) % partitions.length;
    } else {
      partitionId = Math.floor(Math.random() * partitions.length);
    }

    const partition = partitions[partitionId];
    return partition.append(key, value, headers);
  }

  public consume(
    topic: TopicName,
    partitionId: PartitionId,
    fromOffset: Offset,
    maxCount: number = 100
  ): StreamRecord[] {
    const partitions = this.topics.get(topic);
    if (!partitions || !partitions[partitionId]) {
      throw new Error(`Topic '${topic}' partition ${partitionId} does not exist`);
    }

    return partitions[partitionId].read(fromOffset, maxCount);
  }

  public commitOffset(groupId: string, topic: TopicName, partitionId: PartitionId, offset: Offset): void {
    if (!this.groupOffsets.has(groupId)) {
      this.groupOffsets.set(groupId, new Map());
    }
    const offsets = this.groupOffsets.get(groupId)!;
    offsets.set(`${topic}:${partitionId}`, offset);
  }

  public getCommittedOffset(groupId: string, topic: TopicName, partitionId: PartitionId): Offset | null {
    const offsets = this.groupOffsets.get(groupId);
    if (!offsets) return null;
    return offsets.get(`${topic}:${partitionId}`) ?? null;
  }

  public getTopicPartitions(topic: TopicName): number {
    return this.topics.get(topic)?.length ?? 0;
  }

  public getTopicList(): TopicName[] {
    return Array.from(this.topics.keys());
  }

  private computeHash(str: string): number {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i);
      h |= 0;
    }
    return h;
  }
}
