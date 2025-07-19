import { PoisonMessageQuarantine } from '../../src/queue/PoisonMessageQuarantine';

describe('PoisonMessageQuarantine', () => {
  it('should quarantine and release poison messages', () => {
    const q = new PoisonMessageQuarantine<{ code: string }>();
    q.quarantine('bad-1', { code: 'corrupted' }, 'Syntax error in JSON');

    expect(q.isQuarantined('bad-1')).toBe(true);
    expect(q.count()).toBe(1);

    const released = q.release('bad-1');
    expect(released?.payload.code).toBe('corrupted');
    expect(q.isQuarantined('bad-1')).toBe(false);
  });
});
