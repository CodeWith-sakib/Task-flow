import { computeCRC32 } from '../../storage/wal/crc32';

export enum FrameType {
  DATA = 0x01,
  ACK = 0x02,
  PING = 0x03,
  PONG = 0x04,
  CANCEL = 0x05,
  ERROR = 0xFF
}

export interface BinaryFrame {
  type: FrameType;
  flags: number;
  streamId: number;
  payload: Buffer;
}

export const FRAME_MAGIC = 0x5446; // 'TF' in ASCII

/**
 * BinaryFrameCodec serializes and deserializes length-prefixed, CRC-validated binary protocol frames.
 */
export class BinaryFrameCodec {
  public static encode(frame: BinaryFrame): Buffer {
    const payloadLen = frame.payload.length;
    const checksum = computeCRC32(frame.payload.toString('binary'));

    // Header size = 16 bytes:
    // Magic (2) + Type (1) + Flags (1) + StreamId (4) + PayloadLen (4) + CRC (4)
    const header = Buffer.alloc(16);
    header.writeUInt16BE(FRAME_MAGIC, 0);
    header.writeUInt8(frame.type, 2);
    header.writeUInt8(frame.flags, 3);
    header.writeUInt32BE(frame.streamId, 4);
    header.writeUInt32BE(payloadLen, 8);
    header.writeUInt32BE(checksum, 12);

    return Buffer.concat([header, frame.payload]);
  }

  public static decode(buffer: Buffer): { frame: BinaryFrame; bytesConsumed: number } | null {
    if (buffer.length < 16) {
      return null; // Need more header bytes
    }

    const magic = buffer.readUInt16BE(0);
    if (magic !== FRAME_MAGIC) {
      throw new Error(`Invalid frame magic: 0x${magic.toString(16)} (expected 0x${FRAME_MAGIC.toString(16)})`);
    }

    const type = buffer.readUInt8(2) as FrameType;
    const flags = buffer.readUInt8(3);
    const streamId = buffer.readUInt32BE(4);
    const payloadLen = buffer.readUInt32BE(8);
    const expectedCrc = buffer.readUInt32BE(12);

    const totalLength = 16 + payloadLen;
    if (buffer.length < totalLength) {
      return null; // Need full payload buffer
    }

    const payload = buffer.slice(16, totalLength);
    const actualCrc = computeCRC32(payload.toString('binary'));
    if (actualCrc !== expectedCrc) {
      throw new Error(`Frame checksum mismatch: expected ${expectedCrc}, got ${actualCrc}`);
    }

    return {
      frame: {
        type,
        flags,
        streamId,
        payload
      },
      bytesConsumed: totalLength
    };
  }
}
