import { EventEmitter, TaskEvent } from '../../src/events/EventEmitter';
import { EventJournal } from '../../src/events/sourcing/EventJournal';
import { EventStore } from '../../src/events/store/EventStore';

describe('Events & Sourcing Integration Tests', () => {
  it('should publish and subscribe to domain events across channels', () => {
    const emitter = new EventEmitter();
    const events: any[] = [];

    emitter.on(TaskEvent.COMPLETED, (payload) => events.push(payload));
    emitter.emit(TaskEvent.COMPLETED, { taskId: 't-100', data: { status: 'SUCCESS' } });

    expect(events.length).toBe(1);
    expect(events[0].taskId).toBe('t-100');
  });

  it('should append events to EventJournal and rebuild aggregate state through replay', () => {
    const journal = new EventJournal();
    const aggregateId = 'workflow-stream-alpha';

    journal.append(aggregateId, 'Workflow', 'WorkflowStarted', { name: 'BillingRun' }, 0);
    journal.append(aggregateId, 'Workflow', 'StepCompleted', { step: 'calculate_totals' }, 1);
    journal.append(aggregateId, 'Workflow', 'StepCompleted', { step: 'charge_cards' }, 2);
    journal.append(aggregateId, 'Workflow', 'WorkflowFinished', { status: 'SUCCESS' }, 3);

    const stream = journal.getEventsForAggregate(aggregateId);
    expect(stream.length).toBe(4);

    let state = { started: false, stepsDone: 0, finished: false };
    for (const evt of stream) {
      if (evt.eventType === 'WorkflowStarted') state.started = true;
      if (evt.eventType === 'StepCompleted') state.stepsDone++;
      if (evt.eventType === 'WorkflowFinished') state.finished = true;
    }

    expect(state.started).toBe(true);
    expect(state.stepsDone).toBe(2);
    expect(state.finished).toBe(true);
  });

  it('should store and query events in EventStore by task id', () => {
    const store = new EventStore();
    store.record(TaskEvent.CREATED, { taskId: 'task-101', data: { status: 'PENDING' } });
    store.record(TaskEvent.COMPLETED, { taskId: 'task-101', data: { status: 'SUCCESS' } });

    const taskEvents = store.getByTaskId('task-101');
    expect(taskEvents.length).toBe(2);
    expect(taskEvents[0].type).toBe(TaskEvent.CREATED);
    expect(taskEvents[1].type).toBe(TaskEvent.COMPLETED);
  });
});
