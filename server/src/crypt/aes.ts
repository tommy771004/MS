import crypto from 'node:crypto';

/**
 * MapleStory-style AES layer. The real client uses AES in a segmented OFB mode
 * with a fixed 256-bit user key and the 4-byte IV expanded to 16 bytes. We use
 * the platform's standard AES-256-OFB (no external deps), which is symmetric:
 * applying it twice with the same IV recovers the plaintext.
 */

// The classic MapleStory user key (16 little-endian ints → 32 bytes). Both
// peers share it; for our own client/server pair only consistency matters.
const USER_KEY = Buffer.from([
  0x13, 0x00, 0x00, 0x00, 0x08, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00, 0xb4, 0x00, 0x00, 0x00,
  0x1b, 0x00, 0x00, 0x00, 0x0f, 0x00, 0x00, 0x00, 0x33, 0x00, 0x00, 0x00, 0x52, 0x00, 0x00, 0x00,
]);

/** Symmetric AES-OFB keystream XOR. `iv4` is expanded to 16 bytes (×4). */
export function aesTransform(data: Buffer, iv4: Buffer): Buffer {
  const iv16 = Buffer.concat([iv4, iv4, iv4, iv4]);
  const cipher = crypto.createCipheriv('aes-256-ofb', USER_KEY, iv16);
  return Buffer.concat([cipher.update(data), cipher.final()]);
}
