import { AsyncSemaphore } from '../../src/concurrency/semaphore/AsyncSemaphore';

describe('AsyncSemaphore Unit Tests', () => {
  it('should restrict concurrency to capacity and queue waiters', async () => {
    const sem = new AsyncSemaphore(2);
    const release1 = await sem.acquire();
    const release2 = await sem.acquire();
    expect(sem.getAvailable()).toBe(0);

    let waiterResolved = false;
    const waiterPromise = sem.acquire().then((rel) => {
      waiterResolved = true;
      rel();
    });

    expect(waiterResolved).toBe(false);
    release1();
    await waiterPromise;
    expect(waiterResolved).toBe(true);
    release2();
    expect(sem.getAvailable()).toBe(2);
  });
});
