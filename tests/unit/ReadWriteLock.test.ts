import { ReadWriteLock } from '../../src/concurrency/semaphore/ReadWriteLock';

describe('ReadWriteLock Unit Tests', () => {
  it('should permit concurrent readers but exclusive writers', async () => {
    const rw = new ReadWriteLock();
    const r1 = await rw.readLock();
    const r2 = await rw.readLock();
    let writeAcquired = false;

    const wPromise = rw.writeLock().then((wRel) => {
      writeAcquired = true;
      wRel();
    });

    expect(writeAcquired).toBe(false);
    r1();
    expect(writeAcquired).toBe(false);
    r2();
    await wPromise;
    expect(writeAcquired).toBe(true);
  });
});
