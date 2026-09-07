/**
 * VarintCodec implements Protocol Buffers / LEB128 variable-length integer encoding and decoding
 * with ZigZag signed integer transformation for space-efficient binary storage.
 */
export class VarintCodec {
  public static encodeUInt32(value: number): Buffer {
    const bytes: number[] = [];
    let v = value >>> 0;

    while (v >= 0x80) {
      bytes.push((v & 0x7f) | 0x80);
      v >>>= 7;
    }
    bytes.push(v & 0x7f);

    return Buffer.from(bytes);
  }

  public static decodeUInt32(buffer: Buffer, offset: number = 0): { value: number; bytesRead: number } {
    let result = 0;
    let shift = 0;
    let bytesRead = 0;

    while (offset + bytesRead < buffer.length) {
      const byte = buffer[offset + bytesRead];
      bytesRead++;
      result |= (byte & 0x7f) << shift;

      if ((byte & 0x80) === 0) {
        return { value: result >>> 0, bytesRead };
      }

      shift += 7;
      if (shift >= 35) {
        throw new Error('Varint overflow: exceeds 32 bits');
      }
    }

    throw new Error('Unexpected end of buffer while decoding varint');
  }

  public static encodeZigZag32(value: number): Buffer {
    const encoded = (value << 1) ^ (value >> 31);
    return this.encodeUInt32(encoded);
  }

  public static decodeZigZag32(buffer: Buffer, offset: number = 0): { value: number; bytesRead: number } {
    const { value, bytesRead } = this.decodeUInt32(buffer, offset);
    const decoded = (value >>> 1) ^ -(value & 1);
    return { value: decoded, bytesRead };
  }
}
