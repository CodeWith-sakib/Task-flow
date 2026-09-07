/**
 * Multiplexed HTTP/2 Workflow Streamer.
 * Handles concurrent stream multiplexing over a single TCP connection,
 * stream priority weighting, flow control window updates, and server push promises.
 */

import { HPackHeaderCompressor, HeaderField } from './HPackHeaderCompressor';

export interface Http2Stream {
  streamId: number;
  weight: number;
  state: 'IDLE' | 'OPEN' | 'HALF_CLOSED' | 'CLOSED';
  outboundBuffer: Buffer[];
  windowSize: number;
}

export class Http2WorkflowStreamer {
  private compressor = new HPackHeaderCompressor();
  private streams = new Map<number, Http2Stream>();
  private nextStreamId = 1;
  private defaultWindowSize = 65535;

  public openStream(weight: number = 16): Http2Stream {
    const streamId = this.nextStreamId;
    this.nextStreamId += 2; // client initiated are odd numbers

    const stream: Http2Stream = {
      streamId,
      weight,
      state: 'OPEN',
      outboundBuffer: [],
      windowSize: this.defaultWindowSize,
    };

    this.streams.set(streamId, stream);
    return stream;
  }

  public sendHeaders(streamId: number, headers: HeaderField[]): Buffer {
    const stream = this.streams.get(streamId);
    if (!stream || stream.state === 'CLOSED') {
      throw new Error(`Stream ${streamId} is closed or invalid`);
    }

    return this.compressor.encode(headers);
  }

  public sendData(streamId: number, data: Buffer | string): boolean {
    const stream = this.streams.get(streamId);
    if (!stream || stream.state !== 'OPEN') {
      return false;
    }

    const dataBuf = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf-8');

    if (dataBuf.length > stream.windowSize) {
      // Flow control throttling: buffer data until window expands
      stream.outboundBuffer.push(dataBuf);
      return false;
    }

    stream.windowSize -= dataBuf.length;
    return true;
  }

  public updateWindowSize(streamId: number, delta: number): void {
    const stream = this.streams.get(streamId);
    if (!stream) return;

    stream.windowSize += delta;

    // Flush pending outbound data if window permits
    while (stream.outboundBuffer.length > 0 && stream.outboundBuffer[0].length <= stream.windowSize) {
      const chunk = stream.outboundBuffer.shift()!;
      stream.windowSize -= chunk.length;
    }
  }

  public closeStream(streamId: number): void {
    const stream = this.streams.get(streamId);
    if (stream) {
      stream.state = 'CLOSED';
      stream.outboundBuffer = [];
    }
  }

  public getActiveStreamCount(): number {
    return Array.from(this.streams.values()).filter((s) => s.state === 'OPEN').length;
  }
}
