/**
 * Packet header + per-packet IV evolution.
 *
 * MapleStory prefixes every encrypted packet with a 4-byte header that encodes
 * the body length XORed against the current IV and protocol version, and rolls
 * the IV after each packet via a shuffle table. We keep the exact header math
 * (so length parsing is IV-independent, just like the real protocol) but evolve
 * the IV with a deterministic xorshift instead of the shuffle table — both
 * peers roll identically, so they stay in lockstep.
 */

export const PROTOCOL_VERSION = 83;

export function ivToU32(iv: Buffer): number {
  return (iv[0] | (iv[1] << 8) | (iv[2] << 16) | (iv[3] << 24)) >>> 0;
}

export function u32ToIv(x: number): Buffer {
  const b = Buffer.alloc(4);
  b[0] = x & 0xff;
  b[1] = (x >>> 8) & 0xff;
  b[2] = (x >>> 16) & 0xff;
  b[3] = (x >>> 24) & 0xff;
  return b;
}

/** Deterministic IV roll (xorshift32). Never returns 0 for a non-zero input. */
export function nextIv(iv: Buffer): Buffer {
  let x = ivToU32(iv);
  x ^= x << 13;
  x >>>= 0;
  x ^= x >>> 17;
  x ^= x << 5;
  x >>>= 0;
  return u32ToIv(x >>> 0);
}

/** A random, non-zero starting IV. */
export function randomIv(): Buffer {
  const b = Buffer.alloc(4);
  do {
    b[0] = (Math.random() * 256) | 0;
    b[1] = (Math.random() * 256) | 0;
    b[2] = (Math.random() * 256) | 0;
    b[3] = (Math.random() * 256) | 0;
  } while (ivToU32(b) === 0);
  return b;
}

/** Build the 4-byte length header for a packet of `length` bytes. */
export function makeHeader(length: number, iv: Buffer): Buffer {
  const a = (((iv[3] << 8) | iv[2]) ^ PROTOCOL_VERSION) & 0xffff;
  const b = (a ^ length) & 0xffff;
  return Buffer.from([a & 0xff, (a >> 8) & 0xff, b & 0xff, (b >> 8) & 0xff]);
}

/** Recover body length from a header (independent of IV/version). */
export function packetLength(header: Buffer): number {
  return ((header[0] ^ header[2]) & 0xff) | (((header[1] ^ header[3]) & 0xff) << 8);
}
