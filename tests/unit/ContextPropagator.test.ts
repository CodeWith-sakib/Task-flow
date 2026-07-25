import { ContextPropagator } from '../../src/observability/ContextPropagator';

describe('ContextPropagator', () => {
  it('should preserve values across store invocations', () => {
    ContextPropagator.set('tenant', 'acme');
    expect(ContextPropagator.get<string>('tenant')).toBe('acme');
    ContextPropagator.clear();
    expect(ContextPropagator.get('tenant')).toBeUndefined();
  });
});
