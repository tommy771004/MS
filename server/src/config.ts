/** Server-wide constants. */
export const SERVER = {
  /** RustMS's login server listens on 8484 — we mirror it. */
  port: 8484,
  host: '127.0.0.1',
  worldName: 'Maple',
  channelCount: 1,
  /** Map every character spawns into for this prototype. */
  startMapId: 100000000,
  startX: 140,
  startY: 540,
} as const;

/** Authoritative combat tuning (mirrors the client's config where it matters). */
export const COMBAT = {
  /** Per-skill cooldown floor enforced server-side (ms). */
  attackCooldownMs: 350,
  /** Max distance (px) a melee attack may reach a monster. */
  attackRange: 140,
  /** Monster respawn delay after death (ms). */
  respawnMs: 6000,
} as const;
