/** Shared tuning + viewport constants for the spike. */
export const VIEW = {
  width: 960,
  height: 540,
} as const;

export const PHYSICS = {
  gravity: 2000,
  walkSpeed: 230,
  jumpVelocity: -640,
  maxFall: 1400,
} as const;

export const WORLD_WIDTH = 2800;

/** Placeholder palette (no copyrighted art — everything is generated). */
export const COLORS = {
  skin: 0xffd9a0,
  hair: 0x4a3b2a,
  coat: 0x3aa0ff,
  pants: 0x2b3a55,
  weapon: 0xd7dde8,
  monster: 0x9b5bd6,
  monster2: 0x55c47a,
  grassTop: 0x3fa34d,
  dirt: 0x5a3d28,
} as const;
