import { EventStore } from '../../src/events/store/EventStore';
import { TaskEvent } from '../../src/events/EventEmitter';

describe('EventStore Unit Tests', () => {
  it('should append and retrieve sequence-ordered event streams per task', () => {
    const store = new EventStore();
    store.record(TaskEvent.CREATED, { taskId: 't1' });
    store.record(TaskEvent.STARTED, { taskId: 't1' });
    store.record(TaskEvent.CREATED, { taskId: 't2' });
    store.record(TaskEvent.COMPLETED, { taskId: 't1' });

    const t1Stream = store.getByTaskId('t1');
    expect(t1Stream.length).toBe(3);
    expect(t1Stream[0].type).toBe(TaskEvent.CREATED);
    expect(t1Stream[2].type).toBe(TaskEvent.COMPLETED);

    expect(store.count()).toBe(4);
  });
});
