/**
 * Binary Proto & RPC Message Codec.
 * Encodes and decodes framed binary RPC messages with 4-byte length prefix,
 * 1-byte message type ID, 1-byte compression flag, 2-byte CRC16 checksum,
 * and arbitrary binary payload.
 */

import * as zlib from 'zlib';

export interface RpcFrame {
  messageType: number;
  compressed: boolean;
  payload: Buffer;
}

export class ProtoMessageCodec {
  /**
   * Encodes an RpcFrame into a wire-ready Buffer.
   * Frame Layout:
   * [4 bytes Total Length][1 byte Message Type][1 byte Compression (0/1)][2 bytes Checksum][Payload Bytes]
   */
  public encode(frame: RpcFrame): Buffer {
    let payloadBuf = frame.payload;
    let isCompressed = frame.compressed;

    if (isCompressed && payloadBuf.length > 64) {
      payloadBuf = zlib.gzipSync(payloadBuf);
    } else {
      isCompressed = false;
    }

    const totalPayloadLen = payloadBuf.length;
    const frameLength = 4 + 1 + 1 + 2 + totalPayloadLen; // total frame size

    const buffer = Buffer.alloc(frameLength);
    buffer.writeUInt32BE(frameLength, 0);
    buffer.writeUInt8(frame.messageType, 4);
    buffer.writeUInt8(isCompressed ? 1 : 0, 5);

    const checksum = this.computeCrc16(payloadBuf);
    buffer.writeUInt16BE(checksum, 6);

    payloadBuf.copy(buffer, 8);

    return buffer;
  }

  /**
   * Decodes a buffer into an RpcFrame.
   */
  public decode(buffer: Buffer): RpcFrame {
    if (buffer.length < 8) {
      throw new Error(`Buffer too short for RPC frame (length: ${buffer.length})`);
    }

    const frameLength = buffer.readUInt32BE(0);
    if (buffer.length < frameLength) {
      throw new Error(`Incomplete RPC frame: expected ${frameLength} bytes, got ${buffer.length}`);
    }

    const messageType = buffer.readUInt8(4);
    const compressed = buffer.readUInt8(5) === 1;
    const checksum = buffer.readUInt16BE(6);

    const rawPayload = buffer.subarray(8, frameLength);
    const expectedChecksum = this.computeCrc16(rawPayload);

    if (checksum !== expectedChecksum) {
      throw new Error(`CRC16 checksum mismatch: frame has 0x${checksum.toString(16)}, computed 0x${expectedChecksum.toString(16)}`);
    }

    let payload = rawPayload;
    if (compressed) {
      payload = zlib.gunzipSync(rawPayload);
    }

    return {
      messageType,
      compressed,
      payload,
    };
  }

  private computeCrc16(data: Buffer): number {
    let crc = 0xffff;
    for (let i = 0; i < data.length; i++) {
      crc ^= data[i] << 8;
      for (let j = 0; j < 8; j++) {
        if ((crc & 0x8000) !== 0) {
          crc = ((crc << 1) ^ 0x1021) & 0xffff;
        } else {
          crc = (crc << 1) & 0xffff;
        }
      }
    }
    return crc & 0xffff;
  }
}
