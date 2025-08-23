import { MissedExecutionPolicy, MisfirePolicy } from '../../src/scheduler/MissedExecutionPolicy';

describe('MissedExecutionPolicy', () => {
  it('should resolve missed executions according to selected policy', () => {
    expect(MissedExecutionPolicy.resolveExecutions(MisfirePolicy.FIRE_ALL, 5)).toBe(5);
    expect(MissedExecutionPolicy.resolveExecutions(MisfirePolicy.FIRE_ONCE, 5)).toBe(1);
    expect(MissedExecutionPolicy.resolveExecutions(MisfirePolicy.SKIP, 5)).toBe(0);
  });
});
