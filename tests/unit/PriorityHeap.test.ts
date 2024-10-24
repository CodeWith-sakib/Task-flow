import { PriorityHeap } from '../../src/queue/heap/PriorityHeap';

describe('PriorityHeap Unit Tests', () => {
  it('should dequeue items in strict max-priority order with FIFO tie breaking', () => {
    const heap = new PriorityHeap<string>();
    heap.push('low-1', 1);
    heap.push('high-1', 10);
    heap.push('mid-1', 5);
    heap.push('high-2', 10);

    expect(heap.pop()).toBe('high-1');
    expect(heap.pop()).toBe('high-2');
    expect(heap.pop()).toBe('mid-1');
    expect(heap.pop()).toBe('low-1');
    expect(heap.pop()).toBeUndefined();
  });
});
