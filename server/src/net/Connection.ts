import type { Socket } from 'node:net';
import { MapleCipher } from '../crypt/MapleCipher.ts';
import { randomIv, packetLength, PROTOCOL_VERSION } from '../crypt/iv.ts';
import { PacketWriter } from '../packet/PacketWriter.ts';
import { PacketReader } from '../packet/PacketReader.ts';
import { dispatch } from './router.ts';
import { logPacket } from './packetLog.ts';
import type { Account, Character } from '../db/models.ts';
import type { PlayerEntity } from '../world/types.ts';
import type { AccountRepo } from '../db/accounts.ts';
import type { CharacterRepo } from '../db/characters.ts';
import type { GameWorld } from '../world/GameWorld.ts';

/** Shared services every handler needs. */
export interface ServerContext {
  world: GameWorld;
  accounts: AccountRepo;
  characters: CharacterRepo;
}

let nextConnectionId = 1;

/**
 * One client connection (RustMS `net::io`). Performs the unencrypted handshake,
 * then frames every subsequent packet as [4-byte header][encrypted body],
 * decrypting inbound and dispatching by opcode. Also holds the per-connection
 * session (account → character → in-map player).
 */
export class Connection {
  readonly id = nextConnectionId++;
  private readonly cipher: MapleCipher;
  private recvBuf: Buffer = Buffer.alloc(0);

  // Session state.
  account: Account | null = null;
  character: Character | null = null;
  mapId: number | null = null;
  player: PlayerEntity | null = null;

  constructor(
    private readonly socket: Socket,
    readonly ctx: ServerContext,
  ) {
    // Two nonces: serverIv encrypts our sends, clientIv decrypts client sends.
    const serverIv = randomIv();
    const clientIv = randomIv();
    this.cipher = new MapleCipher(serverIv, clientIv);

    this.sendHandshake(clientIv, serverIv);

    socket.on('data', (chunk) => this.onData(chunk));
    socket.on('error', () => this.dispose());
    socket.on('close', () => this.dispose());
  }

  /** Unencrypted, length-prefixed handshake (mirrors MapleStory). */
  private sendHandshake(clientIv: Buffer, serverIv: Buffer): void {
    const w = new PacketWriter();
    w.writeShort(PROTOCOL_VERSION);
    w.writeString('1'); // patch/locale string
    w.writeBytes(clientIv); // the IV the client should encrypt with
    w.writeBytes(serverIv); // the IV the client should decrypt with
    w.writeByte(8); // locale
    const body = w.toBuffer();

    const framed = Buffer.alloc(2 + body.length);
    framed.writeUInt16LE(body.length, 0);
    body.copy(framed, 2);
    this.socket.write(framed);
  }

  private onData(chunk: Buffer): void {
    this.recvBuf = Buffer.concat([this.recvBuf, chunk]);

    // Drain as many complete packets as are buffered.
    while (this.recvBuf.length >= 4) {
      const len = packetLength(this.recvBuf.subarray(0, 4));
      if (this.recvBuf.length < 4 + len) break;

      const body = this.recvBuf.subarray(4, 4 + len);
      this.recvBuf = this.recvBuf.subarray(4 + len);

      const packet = this.cipher.decrypt(Buffer.from(body));
      const reader = new PacketReader(packet);
      const opcode = reader.readShort();
      logPacket('recv', this.id, opcode, packet);
      try {
        dispatch(this, opcode, reader);
      } catch (err) {
        console.error(`[conn ${this.id}] handler error for op 0x${opcode.toString(16)}:`, err);
      }
    }
  }

  /** Encrypt and send a raw packet (opcode already written into it). */
  send(packet: Buffer): void {
    if (this.socket.destroyed) return;
    if (packet.length >= 2) logPacket('send', this.id, packet.readUInt16LE(0), packet);
    this.socket.write(this.cipher.encrypt(packet));
  }

  private disposed = false;
  private dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.player && this.mapId !== null) {
      this.ctx.world.getMap(this.mapId).removePlayer(this.player.character.id);
    }
    this.socket.destroy();
  }
}
