/**
 * "Shanda" secondary cipher — RustMS's `crypt` crate calls this the "secondary
 * encryption algorithm" layered under AES.
 *
 * MapleStory ships a custom byte-rolling cipher on top of AES. This is an
 * educational reimplementation in the same spirit (two position-dependent
 * passes with a ciphertext-feedback XOR chain and bit rotations). It is
 * provably invertible by construction — `shandaDecrypt(shandaEncrypt(x)) === x`
 * — which is all our own client/server pair needs.
 */

const SEED_FWD = 0xab;
const SEED_BWD = 0x5c;

const rol = (b: number, n: number): number => ((b << n) | (b >> (8 - n))) & 0xff;
const ror = (b: number, n: number): number => ((b >> n) | (b << (8 - n))) & 0xff;

export function shandaEncrypt(data: Buffer): Buffer {
  const out = Buffer.from(data);
  const len = out.length;

  // Pass 1 — forward, position add + feedback chain.
  let key = SEED_FWD;
  for (let i = 0; i < len; i++) {
    let c = rol(out[i], 3);
    c = (c + ((len - i) & 0xff)) & 0xff;
    c ^= key;
    key = c;
    out[i] = c;
  }

  // Pass 2 — backward, rotate + constant XOR + feedback chain.
  key = SEED_BWD;
  for (let i = len - 1; i >= 0; i--) {
    let c = rol(out[i], 4);
    c ^= 0x13;
    c ^= key;
    key = c;
    out[i] = c;
  }

  return out;
}

export function shandaDecrypt(data: Buffer): Buffer {
  const out = Buffer.from(data);
  const len = out.length;

  // Invert pass 2 (same backward order; capture ciphertext into the chain key
  // before overwriting the byte).
  let key = SEED_BWD;
  for (let i = len - 1; i >= 0; i--) {
    const cipher = out[i];
    let t = cipher ^ key;
    key = cipher;
    t ^= 0x13;
    out[i] = ror(t & 0xff, 4);
  }

  // Invert pass 1 (forward order).
  key = SEED_FWD;
  for (let i = 0; i < len; i++) {
    const cipher = out[i];
    let t = cipher ^ key;
    key = cipher;
    t = (t - ((len - i) & 0xff)) & 0xff;
    out[i] = ror(t, 3);
  }

  return out;
}
