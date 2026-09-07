import { VarintCodec } from './VarintCodec';

export enum FieldWireType {
  VARINT = 0,
  FIXED64 = 1,
  LENGTH_DELIMITED = 2,
  FIXED32 = 5
}

/**
 * CompactBinarySerializer packs structured task models into length-delimited binary frames.
 */
export class CompactBinarySerializer {
  public static serializeObject(obj: Record<string, any>): Buffer {
    const jsonStr = JSON.stringify(obj);
    const payloadBuf = Buffer.from(jsonStr, 'utf8');
    const lengthVarint = VarintCodec.encodeUInt32(payloadBuf.length);

    return Buffer.concat([lengthVarint, payloadBuf]);
  }

  public static deserializeObject<T = any>(buffer: Buffer, offset: number = 0): { data: T; bytesConsumed: number } {
    const { value: length, bytesRead } = VarintCodec.decodeUInt32(buffer, offset);
    const start = offset + bytesRead;
    const end = start + length;

    if (end > buffer.length) {
      throw new Error(`Buffer underflow: expected ${length} bytes, have ${buffer.length - start}`);
    }

    const payloadStr = buffer.toString('utf8', start, end);
    const data = JSON.parse(payloadStr);

    return {
      data,
      bytesConsumed: bytesRead + length
    };
  }
}
