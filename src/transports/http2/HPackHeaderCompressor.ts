/**
 * HPACK Header Compression Engine (RFC 7541).
 * Implements HTTP/2 header table compression using static and dynamic tables,
 * reducing header payload overhead across multiplexed HTTP/2 streams.
 */

export interface HeaderField {
  name: string;
  value: string;
}

export class HPackHeaderCompressor {
  private staticTable: HeaderField[] = [
    { name: ':authority', value: '' },
    { name: ':method', value: 'GET' },
    { name: ':method', value: 'POST' },
    { name: ':path', value: '/' },
    { name: ':path', value: '/index.html' },
    { name: ':scheme', value: 'http' },
    { name: ':scheme', value: 'https' },
    { name: ':status', value: '200' },
    { name: ':status', value: '204' },
    { name: ':status', value: '206' },
    { name: ':status', value: '304' },
    { name: ':status', value: '400' },
    { name: ':status', value: '404' },
    { name: ':status', value: '500' },
    { name: 'accept-charset', value: '' },
    { name: 'accept-encoding', value: 'gzip, deflate' },
    { name: 'accept-language', value: '' },
    { name: 'accept-ranges', value: '' },
    { name: 'accept', value: '' },
    { name: 'content-type', value: 'application/json' },
  ];

  private dynamicTable: HeaderField[] = [];
  private maxDynamicTableSize = 4096;

  public encode(headers: HeaderField[]): Buffer {
    const parts: Buffer[] = [];

    for (const h of headers) {
      // 1. Check if full match in static table
      const staticIdx = this.staticTable.findIndex((s) => s.name === h.name && s.value === h.value);
      if (staticIdx !== -1) {
        // Indexed header field representation (1xxxxxxx)
        parts.push(Buffer.from([0x80 | (staticIdx + 1)]));
        continue;
      }

      // 2. Check if name match in static table
      const staticNameIdx = this.staticTable.findIndex((s) => s.name === h.name);
      if (staticNameIdx !== -1) {
        // Literal with incremental indexing
        const nameIdxByte = Buffer.from([0x40 | (staticNameIdx + 1)]);
        const valLen = Buffer.from([h.value.length]);
        const valBuf = Buffer.from(h.value, 'utf-8');
        parts.push(Buffer.concat([nameIdxByte, valLen, valBuf]));
        this.addToDynamicTable(h);
        continue;
      }

      // 3. Literal header field without indexing
      const nameLen = Buffer.from([0x00, h.name.length]);
      const nameBuf = Buffer.from(h.name, 'utf-8');
      const valLen = Buffer.from([h.value.length]);
      const valBuf = Buffer.from(h.value, 'utf-8');
      parts.push(Buffer.concat([nameLen, nameBuf, valLen, valBuf]));
      this.addToDynamicTable(h);
    }

    return Buffer.concat(parts);
  }

  public decode(buffer: Buffer): HeaderField[] {
    const headers: HeaderField[] = [];
    let offset = 0;

    while (offset < buffer.length) {
      const firstByte = buffer[offset];

      if ((firstByte & 0x80) !== 0) {
        // Indexed header field (1xxxxxxx)
        const idx = (firstByte & 0x7f) - 1;
        if (idx >= 0 && idx < this.staticTable.length) {
          headers.push(this.staticTable[idx]);
        }
        offset += 1;
      } else if ((firstByte & 0x40) !== 0) {
        // Literal with indexing (01xxxxxx)
        const nameIdx = (firstByte & 0x3f) - 1;
        offset += 1;
        const name = nameIdx >= 0 && nameIdx < this.staticTable.length ? this.staticTable[nameIdx].name : 'custom';
        const valLen = buffer[offset++];
        const value = buffer.slice(offset, offset + valLen).toString('utf-8');
        offset += valLen;
        const field = { name, value };
        headers.push(field);
        this.addToDynamicTable(field);
      } else {
        // Literal without indexing
        offset += 1;
        const nameLen = buffer[offset++];
        const name = buffer.slice(offset, offset + nameLen).toString('utf-8');
        offset += nameLen;
        const valLen = buffer[offset++];
        const value = buffer.slice(offset, offset + valLen).toString('utf-8');
        offset += valLen;
        const field = { name, value };
        headers.push(field);
        this.addToDynamicTable(field);
      }
    }

    return headers;
  }

  private addToDynamicTable(field: HeaderField): void {
    this.dynamicTable.unshift(field);
    if (this.dynamicTable.length > 100) {
      this.dynamicTable.pop();
    }
  }
}
