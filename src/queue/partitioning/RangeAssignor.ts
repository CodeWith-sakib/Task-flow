import { GroupMember, IPartitionAssignor, PartitionId, TopicName } from '../streams/types';

/**
 * RangeAssignor lays out partitions in contiguous ranges per topic across consumer group members.
 */
export class RangeAssignor implements IPartitionAssignor {
  public readonly name = 'range';

  public assign(
    members: Map<string, GroupMember>,
    topics: Map<TopicName, number>
  ): Map<string, { topic: TopicName; partition: PartitionId }[]> {
    const assignment = new Map<string, { topic: TopicName; partition: PartitionId }[]>();
    const sortedMemberIds = Array.from(members.keys()).sort();

    for (const memberId of sortedMemberIds) {
      assignment.set(memberId, []);
    }

    if (sortedMemberIds.length === 0) return assignment;

    for (const [topic, numPartitions] of topics.entries()) {
      const consumersForTopic = sortedMemberIds.filter(mId => {
        const mem = members.get(mId);
        return mem && mem.topics.includes(topic);
      });

      if (consumersForTopic.length === 0) continue;

      const numConsumers = consumersForTopic.length;
      const minPartitionsPerConsumer = Math.floor(numPartitions / numConsumers);
      const consumersWithExtra = numPartitions % numConsumers;

      let currentPartition = 0;
      for (let i = 0; i < numConsumers; i++) {
        const consumerId = consumersForTopic[i];
        const count = minPartitionsPerConsumer + (i < consumersWithExtra ? 1 : 0);
        const memberPartitions = assignment.get(consumerId)!;

        for (let p = 0; p < count; p++) {
          memberPartitions.push({ topic, partition: currentPartition++ });
        }
      }
    }

    return assignment;
  }
}
