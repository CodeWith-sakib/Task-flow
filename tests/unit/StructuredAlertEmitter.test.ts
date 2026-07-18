import { StructuredAlertEmitter } from '../../src/observability/StructuredAlertEmitter';

describe('StructuredAlertEmitter', () => {
  it('should emit and query critical alerts', () => {
    const emitter = new StructuredAlertEmitter();
    emitter.emit('INFO', 'System starting', {});
    emitter.emit('CRITICAL', 'Disk full', { mount: '/var' });

    expect(emitter.getCriticalAlerts().length).toBe(1);
    expect(emitter.getCriticalAlerts()[0].title).toBe('Disk full');
  });
});
