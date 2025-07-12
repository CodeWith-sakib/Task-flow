import { FifoTopicChannel } from '../../src/queue/FifoTopicChannel';

describe('FifoTopicChannel', () => {
  it('should maintain strict FIFO ordering per partition', () => {
    const topic = new FifoTopicChannel<string>();
    topic.send('orders', 'order-1');
    topic.send('orders', 'order-2');
    topic.send('users', 'user-1');

    expect(topic.receive('orders')).toBe('order-1');
    expect(topic.receive('orders')).toBe('order-2');
    expect(topic.receive('users')).toBe('user-1');
    expect(topic.receive('orders')).toBeUndefined();
  });
});
