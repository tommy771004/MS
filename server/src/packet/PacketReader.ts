/**
 * Little-endian packet reader (RustMS `packet` crate's Read extensions).
 * Mirrors PacketWriter: bytes/shorts/ints/longs and length-headered strings.
 */
export class PacketReader {
  private offset = 0;

  constructor(private readonly buf: Buffer) {}

  get remaining(): number {
    return this.buf.length - this.offset;
  }

  readByte(): number {
    return this.buf.readUInt8(this.offset++);
  }

  readBool(): boolean {
    return this.readByte() !== 0;
  }

  readShort(): number {
    const v = this.buf.readUInt16LE(this.offset);
    this.offset += 2;
    return v;
  }

  readInt(): number {
    const v = this.buf.readInt32LE(this.offset);
    this.offset += 4;
    return v;
  }

  readLong(): bigint {
    const v = this.buf.readBigInt64LE(this.offset);
    this.offset += 8;
    return v;
  }

  readBytes(n: number): Buffer {
    const v = Buffer.from(this.buf.subarray(this.offset, this.offset + n));
    this.offset += n;
    return v;
  }

  readString(): string {
    const len = this.readShort();
    const s = this.buf.toString('utf8', this.offset, this.offset + len);
    this.offset += len;
    return s;
  }
}
