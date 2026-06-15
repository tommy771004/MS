/**
 * Data-driven level layout (design.md §6 — geometry lives in data, not code).
 * All coordinates are top-left in world space.
 */

export const WORLD_WIDTH = 3200;
export const WORLD_HEIGHT = 640;

/** Y of the main floor surface. */
export const FLOOR_TOP = 600;

export interface RectDef {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface OneWayDef {
  x: number;
  y: number;
  w: number;
}

export interface LadderDef {
  x: number;
  top: number;
  bottom: number;
}

export interface MonsterSpawn {
  monsterId: number;
  x: number;
  surfaceY: number;
  patrol: number;
}

export interface NpcSpawn {
  shopId: number;
  x: number;
  /** Surface (platform top) the NPC stands on. */
  surfaceY: number;
}

/** Solid terrain: floor, walls, raised blocks. */
export const SOLIDS: RectDef[] = [
  { x: 0, y: FLOOR_TOP, w: WORLD_WIDTH, h: WORLD_HEIGHT - FLOOR_TOP }, // floor
  { x: 1480, y: 520, w: 220, h: WORLD_HEIGHT - 520 }, // raised mesa
  { x: -20, y: 0, w: 20, h: WORLD_HEIGHT }, // left wall
  { x: WORLD_WIDTH, y: 0, w: 20, h: WORLD_HEIGHT }, // right wall
];

/** One-way (jump-through) platforms. */
export const ONE_WAYS: OneWayDef[] = [
  { x: 300, y: 470, w: 240 },
  { x: 640, y: 360, w: 220 },
  { x: 1000, y: 470, w: 240 },
  { x: 1330, y: 380, w: 200 },
  { x: 1760, y: 300, w: 240 },
  { x: 2060, y: 450, w: 260 },
  { x: 2440, y: 360, w: 220 },
  { x: 2800, y: 470, w: 260 },
];

/** Climbable ladders/ropes. */
export const LADDERS: LadderDef[] = [
  { x: 360, top: 470, bottom: FLOOR_TOP },
  { x: 720, top: 360, bottom: 486 },
  { x: 1100, top: 470, bottom: FLOOR_TOP },
  { x: 1420, top: 380, bottom: FLOOR_TOP },
  { x: 1840, top: 300, bottom: FLOOR_TOP },
  { x: 2160, top: 450, bottom: FLOOR_TOP },
  { x: 2520, top: 360, bottom: FLOOR_TOP },
  { x: 2900, top: 470, bottom: FLOOR_TOP },
];

/** Where the player starts. */
export const PLAYER_SPAWN = { x: 140, y: 520 };

/** Shop NPCs placed in the world (docs/phase5.md 階段六). */
export const NPC_SPAWNS: NpcSpawn[] = [{ shopId: 9000001, x: 230, surfaceY: FLOOR_TOP }];

/** Initial monster spawns (surfaceY = the platform top they stand on). */
export const MONSTER_SPAWNS: MonsterSpawn[] = [
  { monsterId: 100100, x: 420, surfaceY: 470, patrol: 100 },
  { monsterId: 100100, x: 760, surfaceY: FLOOR_TOP, patrol: 220 },
  { monsterId: 100100, x: 1120, surfaceY: 470, patrol: 100 },
  { monsterId: 100101, x: 1600, surfaceY: 520, patrol: 90 },
  { monsterId: 100100, x: 1900, surfaceY: 300, patrol: 100 },
  { monsterId: 100101, x: 2180, surfaceY: 450, patrol: 110 },
  { monsterId: 100101, x: 2560, surfaceY: 360, patrol: 90 },
  { monsterId: 100100, x: 2920, surfaceY: 470, patrol: 110 },
];
