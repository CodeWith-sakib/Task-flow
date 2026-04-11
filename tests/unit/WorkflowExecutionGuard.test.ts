import { WorkflowExecutionGuard } from '../../src/workflows/WorkflowExecutionGuard';

describe('WorkflowExecutionGuard', () => {
  it('should pass when all fields exist and throw when missing', () => {
    expect(() => {
      WorkflowExecutionGuard.assertRequiredFields({ id: 1, title: 'Test' }, ['id', 'title']);
    }).not.toThrow();

    expect(() => {
      WorkflowExecutionGuard.assertRequiredFields({ id: 1 }, ['id', 'title']);
    }).toThrow('Missing required workflow field: title');
  });
});
