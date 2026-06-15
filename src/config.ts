/**
 * Central place for tuning constants. Keep "feel" numbers here so the whole
 * game can be re-balanced from one file (data-driven design — see design.md §6).
 */

export const GAME_WIDTH = 1024;
export const GAME_HEIGHT = 576;

/** Scene keys. */
export const Scenes = {
  Boot: 'BootScene',
  Preload: 'PreloadScene',
  Game: 'GameScene',
  UI: 'UIScene',
} as const;

/** Arcade-physics depth ordering. Higher = drawn on top. */
export const Depth = {
  ParallaxFar: 0,
  ParallaxMid: 1,
  ParallaxNear: 2,
  Tiles: 5,
  Platforms: 6,
  Drops: 8,
  Monster: 10,
  Player: 12,
  Hitbox: 14,
  DamageNumber: 20,
  Vfx: 22,
} as const;

/**
 * Physics constants tuned for a "MapleStory" floaty parabola rather than a
 * realistic fall. See design.md §2.1.
 */
export const Physics = {
  gravityY: 2000,
  /** Horizontal ground speed (px/s). */
  walkSpeed: 260,
  /** Initial upward velocity on jump (px/s). Negative = up. */
  jumpVelocity: -720,
  /**
   * When the jump key is released while still rising, the upward velocity is
   * multiplied by this to allow variable jump height (hold = higher).
   */
  jumpCutMultiplier: 0.4,
  /** Climbing speed on ladders/ropes (px/s). */
  climbSpeed: 180,
  /** Terminal fall speed (px/s). */
  maxFallSpeed: 1400,
} as const;

/** Player collision body size (the character art is larger than the hitbox). */
export const PlayerBody = {
  width: 28,
  height: 48,
} as const;

export const Combat = {
  /** Frames (ms) the attack animation locks horizontal movement. */
  attackLockMs: 280,
  /** Window (ms) after the swing starts during which the hitbox is active. */
  hitboxActiveMs: 140,
  /** Attack hitbox size, placed in front of the player. */
  hitboxWidth: 64,
  hitboxHeight: 56,
  /** Monster invulnerability after being hit (ms) to avoid multi-hits/frame. */
  monsterIframeMs: 120,
  /** How long a hit monster flashes white (ms). */
  hitFlashMs: 90,
  /** Knockback applied to monsters on hit (px/s). */
  knockback: 140,
} as const;

/** Colors used by the runtime texture generator (no external art). */
export const Palette = {
  skin: 0xffd9a0,
  hair: 0x4a3b2a,
  shirt: 0x3aa0ff,
  pants: 0x2b3a55,
  weapon: 0xd7dde8,
  weaponEdge: 0x9aa3b2,
  platform: 0x6b4f33,
  platformTop: 0x3fa34d,
  ladder: 0xb9893f,
  coin: 0xffcc33,
  potionHp: 0xff5566,
  potionMp: 0x55a0ff,
  monsterBody: 0xa05bd6,
  monsterBody2: 0x55c47a,
  damagePlayer: 0xffe45e,
  damageCrit: 0xff7b3d,
} as const;
