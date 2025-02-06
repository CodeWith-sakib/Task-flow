import { BinarySerializer } from '../../src/storage/BinarySerializer';

describe('BinarySerializer', () => {
  it('should encode and decode strings', () => {
    const input = 'hello taskflow binary serializer';
    const encoded = BinarySerializer.serializeString(input);
    const decoded = BinarySerializer.deserializeString(encoded);
    expect(decoded).toBe(input);
  });

  it('should encode and decode arbitrary JSON objects', () => {
    const data = { taskId: 'abc-123', retries: 3, active: true };
    const encoded = BinarySerializer.serializeJson(data);
    const decoded = BinarySerializer.deserializeJson<typeof data>(encoded);
    expect(decoded).toEqual(data);
  });
});
