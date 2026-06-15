import { shandaEncrypt, shandaDecrypt } from './shanda.ts';
import { aesTransform } from './aes.ts';
import { makeHeader, nextIv } from './iv.ts';

/**
 * Combines the AES + shanda layers and owns the send/receive IV nonces for one
 * connection (RustMS: "manages packet encryption/decryption nonces").
 *
 * Wire order, matching MapleStory:
 *   send:  packet → shanda → AES → [4-byte header][body], then roll send IV
 *   recv:  [body] → AES → shanda → packet,                then roll recv IV
 *
 * Because AES-OFB is symmetric and both peers roll IVs deterministically, the
 * two directions stay synchronized for the life of the connection.
 */
export class MapleCipher {
  private sendIv: Buffer;
  private recvIv: Buffer;

  constructor(sendIv: Buffer, recvIv: Buffer) {
    this.sendIv = sendIv;
    this.recvIv = recvIv;
  }

  /** Encrypt a raw packet into a framed [header][body] buffer. */
  encrypt(packet: Buffer): Buffer {
    const body = aesTransform(shandaEncrypt(packet), this.sendIv);
    const header = makeHeader(packet.length, this.sendIv);
    this.sendIv = nextIv(this.sendIv);
    return Buffer.concat([header, body]);
  }

  /** Decrypt an encrypted body (header already stripped) into a raw packet. */
  decrypt(body: Buffer): Buffer {
    const packet = shandaDecrypt(aesTransform(body, this.recvIv));
    this.recvIv = nextIv(this.recvIv);
    return packet;
  }
}
