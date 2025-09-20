import { ExecutionWindowGuard } from '../../src/scheduler/ExecutionWindowGuard';

describe('ExecutionWindowGuard', () => {
  it('should validate daytime windows', () => {
    const guard = new ExecutionWindowGuard(9, 17);
    const inWindow = new Date('2025-01-01T12:00:00Z');
    const outWindow = new Date('2025-01-01T20:00:00Z');

    expect(guard.isWithinWindow(inWindow)).toBe(true);
    expect(guard.isWithinWindow(outWindow)).toBe(false);
  });

  it('should validate overnight windows', () => {
    const guard = new ExecutionWindowGuard(22, 4);
    const late = new Date('2025-01-01T23:00:00Z');
    const early = new Date('2025-01-01T02:00:00Z');
    const afternoon = new Date('2025-01-01T14:00:00Z');

    expect(guard.isWithinWindow(late)).toBe(true);
    expect(guard.isWithinWindow(early)).toBe(true);
    expect(guard.isWithinWindow(afternoon)).toBe(false);
  });
});
