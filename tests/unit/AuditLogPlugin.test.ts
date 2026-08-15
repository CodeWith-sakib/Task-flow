import { AuditLogPlugin } from '../../src/plugins/AuditLogPlugin';

describe('AuditLogPlugin', () => {
  it('should capture audit trails', () => {
    const plugin = new AuditLogPlugin();
    plugin.log('admin', 'UPDATE_STATUS', 'task-10');
    expect(plugin.getLogs().length).toBe(1);
    expect(plugin.getLogs()[0].action).toBe('UPDATE_STATUS');
  });
});
