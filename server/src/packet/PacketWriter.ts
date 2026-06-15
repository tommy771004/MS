/**
 * Little-endian packet builder (RustMS `packet` crate's Write extensions).
 * Grows a buffer as bytes/shorts/ints/strings are appended; MapleStory strings
 * are length-headered (u16 length + ASCII bytes).
 */
export class PacketWriter {
  private buf: Buffer;
  private len = 0;

  constructor(opcode?: number, capacity = 64) {
    this.buf = Buffer.alloc(capacity);
    if (opcode !== undefined) this.writeShort(opcode);
  }

  private ensure(extra: number): void {
    if (this.len + extra <= this.buf.length) return;
    let next = this.buf.length * 2;
    while (next < this.len + extra) next *= 2;
    const grown = Buffer.alloc(next);
    this.buf.copy(grown, 0, 0, this.len);
    this.buf = grown;
  }

  writeByte(v: number): this {
    this.ensure(1);
    this.buf[this.len++] = v & 0xff;
    return this;
  }

  writeBool(v: boolean): this {
    return this.writeByte(v ? 1 : 0);
  }

  writeShort(v: number): this {
    this.ensure(2);
    this.buf.writeUInt16LE(v & 0xffff, this.len);
    this.len += 2;
    return this;
  }

  writeInt(v: number): this {
    this.ensure(4);
    this.buf.writeInt32LE(v | 0, this.len);
    this.len += 4;
    return this;
  }

  writeLong(v: bigint): this {
    this.ensure(8);
    this.buf.writeBigInt64LE(v, this.len);
    this.len += 8;
    return this;
  }

  writeBytes(bytes: Buffer): this {
    this.ensure(bytes.length);
    bytes.copy(this.buf, this.len);
    this.len += bytes.length;
    return this;
  }

  /** Length-headered ASCII string (u16 length + bytes). */
  writeString(s: string): this {
    const bytes = Buffer.from(s, 'utf8');
    this.writeShort(bytes.length);
    this.writeBytes(bytes);
    return this;
  }

  toBuffer(): Buffer {
    return Buffer.from(this.buf.subarray(0, this.len));
  }
}
