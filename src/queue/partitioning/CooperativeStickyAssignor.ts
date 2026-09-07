import { GroupMember, IPartitionAssignor, PartitionId, TopicName } from '../streams/types';

/**
 * CooperativeStickyAssignor provides stickiness to minimize partition movements
 * across successive consumer joins/leaves while achieving balanced distribution.
 */
export class CooperativeStickyAssignor implements IPartitionAssignor {
  public readonly name = 'cooperative-sticky';

  public assign(
    members: Map<string, GroupMember>,
    topics: Map<TopicName, number>
  ): Map<string, { topic: TopicName; partition: PartitionId }[]> {
    const assignment = new Map<string, { topic: TopicName; partition: PartitionId }[]>();
    const memberIds = Array.from(members.keys()).sort();

    for (const id of memberIds) {
      assignment.set(id, []);
    }

    if (memberIds.length === 0) return assignment;

    // Collect all existing assigned partitions that remain valid
    const allAssigned = new Set<string>();
    for (const [memberId, member] of members.entries()) {
      const retained: { topic: TopicName; partition: PartitionId }[] = [];
      for (const p of member.assignedPartitions) {
        const topicTotal = topics.get(p.topic);
        if (topicTotal !== undefined && p.partition < topicTotal && member.topics.includes(p.topic)) {
          retained.push(p);
          allAssigned.add(`${p.topic}:${p.partition}`);
        }
      }
      assignment.set(memberId, retained);
    }

    // Collect all unassigned partitions
    const unassigned: { topic: TopicName; partition: PartitionId }[] = [];
    for (const [topic, numPartitions] of topics.entries()) {
      for (let p = 0; p < numPartitions; p++) {
        if (!allAssigned.has(`${topic}:${p}`)) {
          unassigned.push({ topic, partition: p });
        }
      }
    }

    // Assign unassigned partitions to least loaded eligible member
    for (const unassignedPartition of unassigned) {
      const eligibleMembers = memberIds.filter(mId => {
        const mem = members.get(mId);
        return mem && mem.topics.includes(unassignedPartition.topic);
      });

      if (eligibleMembers.length === 0) continue;

      eligibleMembers.sort((a, b) => {
        const countA = assignment.get(a)!.length;
        const countB = assignment.get(b)!.length;
        return countA - countB;
      });

      const leastLoaded = eligibleMembers[0];
      assignment.get(leastLoaded)!.push(unassignedPartition);
    }

    return assignment;
  }
}
