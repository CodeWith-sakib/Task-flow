import { TaskService } from '../src/core/TaskService';
import { DatabaseFactory } from '../src/storage/db/index';
import { QueueFactory } from '../src/queue/redis/index';
import { EventEmitter } from '../src/events/EventEmitter';
import { StateTransitioner } from '../src/core/state/StateTransitioner';
import { RetryManager } from '../src/core/retry/RetryManager';
import { TaskScheduler } from '../src/core/scheduler/TaskScheduler';
import { TaskHandlerRegistry } from '../src/core/lifecycle/TaskHandlerRegistry';

export function createTestService(): TaskService {
  const db = DatabaseFactory.createDatabase();
  const queue = QueueFactory.createQueue();
  const eventEmitter = new EventEmitter();
  const stateTransitioner = new StateTransitioner();
  const retryManager = new RetryManager();
  const scheduler = new TaskScheduler();
  const handlerRegistry = new TaskHandlerRegistry();

  return new TaskService(
    db,
    queue,
    eventEmitter,
    stateTransitioner,
    retryManager,
    scheduler,
    handlerRegistry
  );
}
