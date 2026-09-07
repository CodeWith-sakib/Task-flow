import { ProtoMessageCodec } from '../../src/transports/grpc/ProtoMessageCodec';
import { HPackHeaderCompressor } from '../../src/transports/http2/HPackHeaderCompressor';
import { ServerSentEventsBroadcaster } from '../../src/transports/sse/ServerSentEventsBroadcaster';
import { WebhookSignatureRotator } from '../../src/webhooks/WebhookSignatureRotator';
import { WebhookDeadLetterVault } from '../../src/webhooks/WebhookDeadLetterVault';

describe('Transports & Webhooks Integration Tests', () => {
  it('should encode and decode framed binary RPC messages for gRPC workflows', () => {
    const codec = new ProtoMessageCodec();
    const payloadData = Buffer.from(JSON.stringify({ workflowId: 'wf-992', batchSize: 500 }));

    const frame = {
      messageType: 1,
      compressed: false,
      payload: payloadData,
    };

    const encoded = codec.encode(frame);
    expect(encoded).toBeInstanceOf(Buffer);

    const decoded = codec.decode(encoded);
    expect(decoded.messageType).toBe(1);
    const parsedPayload = JSON.parse(decoded.payload.toString('utf-8'));
    expect(parsedPayload.workflowId).toBe('wf-992');
    expect(parsedPayload.batchSize).toBe(500);
  });

  it('should compress and decompress HTTP/2 headers with HPACK table indexing', () => {
    const hpack = new HPackHeaderCompressor();
    const headers = [
      { name: ':method', value: 'POST' },
      { name: ':path', value: '/v1/workflows/execute' },
      { name: 'content-type', value: 'application/json' },
    ];

    const compressed = hpack.encode(headers);
    expect(compressed.length).toBeGreaterThan(0);

    const decompressed = hpack.decode(compressed);
    expect(decompressed.length).toBe(headers.length);
    expect(decompressed.find((h) => h.name === ':method')?.value).toBe('POST');
  });

  it('should broadcast Server-Sent Events (SSE) to active client streams', () => {
    const sse = new ServerSentEventsBroadcaster();
    const receivedEvents: string[] = [];

    sse.registerClient({
      connectionId: 'client-1',
      channel: 'workflows',
      lastEventId: 0,
      sendRaw: (data) => receivedEvents.push(data),
      connectedAt: Date.now(),
    });

    sse.broadcast('workflows', 'workflow_progress', { percent: 45, step: 'extract' });
    expect(receivedEvents.length).toBe(1);
    expect(receivedEvents[0]).toContain('event: workflow_progress');

    sse.unregisterClient('client-1');
    sse.broadcast('workflows', 'workflow_progress', { percent: 100, step: 'done' });
    expect(receivedEvents.length).toBe(1); // No new events after unregister
  });

  it('should sign and verify webhook payloads and handle DLQ dead letters', () => {
    const rotator = new WebhookSignatureRotator('primary-secret-key-2026', 'old-fallback-key');
    const body = JSON.stringify({ event: 'task.completed', taskId: 't-123', status: 'SUCCESS' });

    const signature = rotator.sign(body);
    expect(rotator.verify(body, signature)).toBe(true);
    expect(rotator.verify(body + 'tampered', signature)).toBe(false);

    const dlq = new WebhookDeadLetterVault();
    const stored = dlq.store('https://api.example.com/callback', { task: 't-123' }, 'HTTP 503 Service Unavailable');

    expect(stored.id).toBeDefined();
    const deadLetters = dlq.list();
    expect(deadLetters.length).toBe(1);
    expect(deadLetters[0].endpoint).toBe('https://api.example.com/callback');

    const redrived = dlq.redrive(stored.id);
    expect(redrived?.id).toBe(stored.id);
    expect(dlq.list().length).toBe(0);
  });
});
