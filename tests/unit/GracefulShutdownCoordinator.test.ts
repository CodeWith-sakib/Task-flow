import { GracefulShutdownCoordinator } from '../../src/concurrency/GracefulShutdownCoordinator';

describe('GracefulShutdownCoordinator', () => {
  it('should invoke registered hooks sequentially on shutdown', async () => {
    const coordinator = new GracefulShutdownCoordinator();
    const order: number[] = [];

    coordinator.registerHook(async () => { order.push(1); });
    coordinator.registerHook(async () => { order.push(2); });

    await coordinator.shutdown();
    expect(order).toEqual([1, 2]);
    expect(coordinator.isTerminating()).toBe(true);
  });
});
