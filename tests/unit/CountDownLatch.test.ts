import { CountDownLatch } from '../../src/concurrency/CountDownLatch';

describe('CountDownLatch', () => {
  it('should block until count reaches zero', async () => {
    const latch = new CountDownLatch(3);
    let resolved = false;

    latch.await().then(() => { resolved = true; });

    latch.countDown();
    expect(resolved).toBe(false);
    latch.countDown();
    expect(resolved).toBe(false);
    latch.countDown();

    await new Promise(r => setTimeout(r, 20));
    expect(resolved).toBe(true);
    expect(latch.getCount()).toBe(0);
  });
});
