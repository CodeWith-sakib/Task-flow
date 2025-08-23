export enum MisfirePolicy {
  FIRE_ALL = 'FIRE_ALL',
  FIRE_ONCE = 'FIRE_ONCE',
  SKIP = 'SKIP'
}

export class MissedExecutionPolicy {
  public static resolveExecutions(policy: MisfirePolicy, missedCount: number): number {
    if (missedCount <= 0) return 0;
    switch (policy) {
      case MisfirePolicy.FIRE_ALL:
        return missedCount;
      case MisfirePolicy.FIRE_ONCE:
        return 1;
      case MisfirePolicy.SKIP:
        return 0;
    }
  }
}
