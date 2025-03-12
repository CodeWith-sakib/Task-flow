import { RedisQueueAbstraction } from './RedisQueueAbstraction';

export class QueueFactory {
  static createQueue() {
    return new RedisQueueAbstraction();
  }
}

export type Queue = RedisQueueAbstraction;
