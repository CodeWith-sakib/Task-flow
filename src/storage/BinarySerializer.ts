export enum BinaryType {
  STRING = 0x01,
  INT32 = 0x02,
  FLOAT64 = 0x03,
  BOOLEAN = 0x04,
  JSON = 0x05
}

export class BinarySerializer {
  public static serializeString(val: string): Buffer {
    const strBuf = Buffer.from(val, 'utf8');
    const buf = Buffer.alloc(1 + 4 + strBuf.length);
    buf.writeUInt8(BinaryType.STRING, 0);
    buf.writeUInt32BE(strBuf.length, 1);
    strBuf.copy(buf, 5);
    return buf;
  }

  public static deserializeString(buf: Buffer): string {
    const type = buf.readUInt8(0);
    if (type !== BinaryType.STRING) {
      throw new Error(`Expected STRING type tag, got ${type}`);
    }
    const len = buf.readUInt32BE(1);
    return buf.toString('utf8', 5, 5 + len);
  }

  public static serializeJson(obj: unknown): Buffer {
    const jsonStr = JSON.stringify(obj);
    const strBuf = Buffer.from(jsonStr, 'utf8');
    const buf = Buffer.alloc(1 + 4 + strBuf.length);
    buf.writeUInt8(BinaryType.JSON, 0);
    buf.writeUInt32BE(strBuf.length, 1);
    strBuf.copy(buf, 5);
    return buf;
  }

  public static deserializeJson<T = unknown>(buf: Buffer): T {
    const type = buf.readUInt8(0);
    if (type !== BinaryType.JSON) {
      throw new Error(`Expected JSON type tag, got ${type}`);
    }
    const len = buf.readUInt32BE(1);
    const str = buf.toString('utf8', 5, 5 + len);
    return JSON.parse(str);
  }
}
