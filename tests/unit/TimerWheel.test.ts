import { TimerWheel } from '../../src/scheduler/wheel/TimerWheel';

describe('TimerWheel Unit Tests', () => {
  it('should advance slots and trigger timers when rounds reach zero', () => {
    const wheel = new TimerWheel(10, 100);
    let called = false;
    wheel.schedule('t1', 250, () => {
      called = true;
    });

    wheel.advance(); // slot 0 -> 1
    wheel.advance(); // slot 1 -> 2
    expect(called).toBe(false);

    wheel.advance(); // slot 2 -> 3 (triggers)
    expect(called).toBe(true);
  });
});
