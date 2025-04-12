import { RetentionPolicyEngine } from '../../src/storage/RetentionPolicyEngine';

describe('RetentionPolicyEngine', () => {
  it('should expire completed and failed tasks according to distinct policies', () => {
    const engine = new RetentionPolicyEngine({ completedDays: 1, failedDays: 5 });
    const now = 10 * 86400000;

    const completedRecent = { id: '1', status: 'COMPLETED' as const, finishedAt: now - 0.5 * 86400000 };
    const completedOld = { id: '2', status: 'COMPLETED' as const, finishedAt: now - 2 * 86400000 };
    const failedRecent = { id: '3', status: 'FAILED' as const, finishedAt: now - 3 * 86400000 };

    expect(engine.isExpired(completedRecent, now)).toBe(false);
    expect(engine.isExpired(completedOld, now)).toBe(true);
    expect(engine.isExpired(failedRecent, now)).toBe(false);
  });
});
