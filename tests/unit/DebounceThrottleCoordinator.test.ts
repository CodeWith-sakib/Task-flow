import { DebounceThrottleCoordinator } from '../../src/concurrency/DebounceThrottleCoordinator';

describe('DebounceThrottleCoordinator', () => {
  it('should throttle frequent invocations', () => {
    const coordinator = new DebounceThrottleCoordinator(100);
    expect(coordinator.shouldExecute(1000)).toBe(true);
    expect(coordinator.shouldExecute(1050)).toBe(false);
    expect(coordinator.shouldExecute(1110)).toBe(true);
  });
});
