import net from 'node:net';
import { MapleCipher } from '../src/crypt/MapleCipher.ts';
import { packetLength } from '../src/crypt/iv.ts';
import { PacketReader } from '../src/packet/PacketReader.ts';
import { PacketWriter } from '../src/packet/PacketWriter.ts';

interface Received {
  op: number;
  reader: PacketReader;
}

interface Waiter {
  op: number;
  resolve: (r: PacketReader) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * A TCP test client that speaks the same protocol as the browser game would:
 * reads the handshake, sets up the mirrored cipher, then frames/encrypts every
 * packet. Used by the integration harness to exercise the server end-to-end —
 * proving the crypt + packet + net stack round-trips.
 */
export class TestClient {
  private readonly socket: net.Socket;
  private cipher: MapleCipher | null = null;
  private buf: Buffer = Buffer.alloc(0);
  private handshakeDone = false;
  private onReady: (() => void) | null = null;
  private readonly queue: Received[] = [];
  private readonly waiters: Waiter[] = [];

  constructor(port: number, host = '127.0.0.1') {
    this.socket = net.connect(port, host);
    this.socket.setNoDelay(true);
    this.socket.on('data', (d) => this.onData(d));
  }

  static async connect(port: number, host = '127.0.0.1'): Promise<TestClient> {
    const c = new TestClient(port, host);
    await c.ready();
    return c;
  }

  private ready(): Promise<void> {
    return new Promise((resolve) => {
      if (this.handshakeDone) resolve();
      else this.onReady = resolve;
    });
  }

  private onData(chunk: Buffer): void {
    this.buf = Buffer.concat([this.buf, chunk]);

    if (!this.handshakeDone) {
      if (this.buf.length < 2) return;
      const len = this.buf.readUInt16LE(0);
      if (this.buf.length < 2 + len) return;
      const payload = this.buf.subarray(2, 2 + len);
      this.buf = this.buf.subarray(2 + len);
      this.parseHandshake(payload);
      this.handshakeDone = true;
      this.onReady?.();
    }

    while (this.cipher && this.buf.length >= 4) {
      const len = packetLength(this.buf.subarray(0, 4));
      if (this.buf.length < 4 + len) break;
      const body = Buffer.from(this.buf.subarray(4, 4 + len));
      this.buf = this.buf.subarray(4 + len);
      const packet = this.cipher.decrypt(body);
      const reader = new PacketReader(packet);
      const op = reader.readShort();
      this.deliver({ op, reader });
    }
  }

  private parseHandshake(payload: Buffer): void {
    const r = new PacketReader(payload);
    r.readShort(); // version
    r.readString(); // patch
    const clientIv = r.readBytes(4);
    const serverIv = r.readBytes(4);
    // Mirror of the server: we encrypt with clientIv, decrypt with serverIv.
    this.cipher = new MapleCipher(clientIv, serverIv);
  }

  private deliver(rec: Received): void {
    const idx = this.waiters.findIndex((w) => w.op === rec.op);
    if (idx >= 0) {
      const w = this.waiters[idx];
      this.waiters.splice(idx, 1);
      clearTimeout(w.timer);
      w.resolve(rec.reader);
    } else {
      this.queue.push(rec);
    }
  }

  /** Wait for the next packet with `op`, returning a reader past the opcode. */
  waitFor(op: number, timeoutMs = 2500): Promise<PacketReader> {
    const qi = this.queue.findIndex((r) => r.op === op);
    if (qi >= 0) {
      const [rec] = this.queue.splice(qi, 1);
      return Promise.resolve(rec.reader);
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const i = this.waiters.findIndex((w) => w.timer === timer);
        if (i >= 0) this.waiters.splice(i, 1);
        reject(new Error(`timeout waiting for op 0x${op.toString(16)}`));
      }, timeoutMs);
      this.waiters.push({ op, resolve, reject, timer });
    });
  }

  send(packet: Buffer): void {
    if (!this.cipher) throw new Error('handshake not complete');
    this.socket.write(this.cipher.encrypt(packet));
  }

  /** Build a packet (opcode prewritten) with `fill`, then send it. */
  sendOp(op: number, fill?: (w: PacketWriter) => void): void {
    const w = new PacketWriter(op);
    fill?.(w);
    this.send(w.toBuffer());
  }

  close(): void {
    this.socket.destroy();
  }
}

// ---- Field decoders mirroring src/net/build/encode.ts ----------------------

export interface CharacterSnapshot {
  id: number;
  name: string;
  level: number;
  exp: number;
  job: number;
  str: number;
  dex: number;
  int: number;
  luk: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  mesos: number;
  gender: number;
  hair: number;
  skin: number;
  mapId: number;
  x: number;
  y: number;
}

export function readCharacter(r: PacketReader): CharacterSnapshot {
  return {
    id: r.readInt(),
    name: r.readString(),
    level: r.readShort(),
    exp: r.readInt(),
    job: r.readShort(),
    str: r.readShort(),
    dex: r.readShort(),
    int: r.readShort(),
    luk: r.readShort(),
    hp: r.readInt(),
    maxHp: r.readInt(),
    mp: r.readInt(),
    maxMp: r.readInt(),
    mesos: r.readInt(),
    gender: r.readByte(),
    hair: r.readShort(),
    skin: r.readShort(),
    mapId: r.readInt(),
    x: r.readShort(),
    y: r.readShort(),
  };
}

export interface PlayerSnapshot {
  id: number;
  name: string;
  level: number;
  job: number;
  x: number;
  y: number;
  stance: number;
}

export function readPlayer(r: PacketReader): PlayerSnapshot {
  return {
    id: r.readInt(),
    name: r.readString(),
    level: r.readShort(),
    job: r.readShort(),
    x: r.readShort(),
    y: r.readShort(),
    stance: r.readByte(),
  };
}

export interface MonsterSnapshot {
  oid: number;
  monsterId: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
}

export function readMonster(r: PacketReader): MonsterSnapshot {
  return {
    oid: r.readInt(),
    monsterId: r.readInt(),
    x: r.readShort(),
    y: r.readShort(),
    hp: r.readInt(),
    maxHp: r.readInt(),
  };
}
