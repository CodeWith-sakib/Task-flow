import { AsyncResourcePool } from '../../src/concurrency/AsyncResourcePool';

describe('AsyncResourcePool', () => {
  it('should reuse released resources within capacity', async () => {
    let count = 0;
    const pool = new AsyncResourcePool(async () => `res-${++count}`, 2);

    const r1 = await pool.acquire();
    const r2 = await pool.acquire();
    expect(r1).toBe('res-1');
    expect(r2).toBe('res-2');

    await expect(pool.acquire()).rejects.toThrow('Resource pool exhausted');

    pool.release(r1);
    const r3 = await pool.acquire();
    expect(r3).toBe('res-1');
  });
});
