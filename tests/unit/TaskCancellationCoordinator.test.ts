import { TaskCancellationCoordinator } from '../../src/concurrency/TaskCancellationCoordinator';

describe('TaskCancellationCoordinator', () => {
  it('should notify callbacks when token is cancelled', () => {
    const coordinator = new TaskCancellationCoordinator();
    let notified = false;

    coordinator.onCancelled('token-1', () => { notified = true; });
    expect(coordinator.isCancelled('token-1')).toBe(false);

    coordinator.cancel('token-1');
    expect(coordinator.isCancelled('token-1')).toBe(true);
    expect(notified).toBe(true);
  });
});
