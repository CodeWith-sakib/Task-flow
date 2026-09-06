import { TaskFlowEngineFacade } from '../../src/core/TaskFlowEngineFacade';

describe('TaskFlowEngineFacade', () => {
  it('should coordinate storage and task processing', () => {
    const facade = new TaskFlowEngineFacade();
    facade.submitTask('task-100', { job: 'sync' });

    const processed = facade.processTask('task-100');
    expect(processed).toEqual({ job: 'sync' });
    expect(facade.getProcessedCount()).toBe(1);
  });
});
