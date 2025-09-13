import { AdaptiveTimerWheel } from '../../src/scheduler/AdaptiveTimerWheel';

describe('AdaptiveTimerWheel', () => {
  it('should adjust tick resolution under load', () => {
    const wheel = new AdaptiveTimerWheel(100);
    expect(wheel.getEffectiveTickMs()).toBe(100);

    wheel.adjustForLoad(1500);
    expect(wheel.getEffectiveTickMs()).toBe(200);

    wheel.adjustForLoad(500);
    expect(wheel.getEffectiveTickMs()).toBe(100);
  });
});
