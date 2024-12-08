import { AsyncMutex } from '../../src/concurrency/semaphore/AsyncMutex';

describe('AsyncMutex Unit Tests', () => {
  it('should run operations exclusively without race conditions', async () => {
    const mutex = new AsyncMutex();
    let balance = 0;

    const task = async () => {
      await mutex.runExclusive(async () => {
        const b = balance;
        await new Promise((res) => setTimeout(res, 5));
        balance = b + 10;
      });
    };

    await Promise.all([task(), task(), task()]);
    expect(balance).toBe(30);
  });
});
