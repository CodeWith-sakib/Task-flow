import { BatchQueueConsumer } from '../../src/queue/BatchQueueConsumer';

describe('BatchQueueConsumer', () => {
  it('should drain items in batches up to maxBatchSize', () => {
    const consumer = new BatchQueueConsumer<number>();
    consumer.enqueueAll([1, 2, 3, 4, 5]);

    const batch1 = consumer.consumeBatch(2);
    expect(batch1).toEqual([1, 2]);
    expect(consumer.remaining()).toBe(3);

    const batch2 = consumer.consumeBatch(10);
    expect(batch2).toEqual([3, 4, 5]);
    expect(consumer.remaining()).toBe(0);
  });
});
