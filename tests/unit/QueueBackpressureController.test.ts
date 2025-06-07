import { QueueBackpressureController } from '../../src/queue/QueueBackpressureController';

describe('QueueBackpressureController', () => {
  it('should pause on high watermark and resume on low watermark', () => {
    const ctrl = new QueueBackpressureController(100, 0.8, 0.4);
    expect(ctrl.updateDepth(50).accept).toBe(true);
    expect(ctrl.isPaused()).toBe(false);

    // Hit high watermark (80)
    expect(ctrl.updateDepth(85).accept).toBe(false);
    expect(ctrl.isPaused()).toBe(true);

    // Dropping to 60 still paused (above low watermark 40)
    expect(ctrl.updateDepth(60).accept).toBe(false);

    // Drops to 30 (below low watermark)
    expect(ctrl.updateDepth(30).accept).toBe(true);
    expect(ctrl.isPaused()).toBe(false);
  });
});
