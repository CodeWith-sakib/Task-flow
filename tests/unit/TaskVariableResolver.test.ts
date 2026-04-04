import { TaskVariableResolver } from '../../src/workflows/TaskVariableResolver';

describe('TaskVariableResolver', () => {
  it('should substitute double-curly variables in template string', () => {
    const template = 'Hello {{ name }}, your task is {{ taskId }}.';
    const output = TaskVariableResolver.resolveTemplate(template, { name: 'Alice', taskId: '123' });
    expect(output).toBe('Hello Alice, your task is 123.');
  });
});
