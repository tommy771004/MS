/** Shared data contracts. Mirrors the JSON data files in src/data/. */

export type ItemType = 'EQUIP' | 'USE' | 'ETC' | 'SETUP' | 'QUEST';

/** Stat bonuses an equip can grant. Keys mirror MapleStory's inc* fields. */
export interface ItemStats {
  incSTR?: number;
  incDEX?: number;
  incINT?: number;
  incLUK?: number;
  incMaxHP?: number;
  incMaxMP?: number;
  incPAD?: number; // physical attack
  incMAD?: number; // magic attack
}

/** Effect applied when a USE item is consumed. */
export interface ItemConsumeEffect {
  healHP?: number;
  healMP?: number;
}

export interface ItemDef {
  itemId: number;
  type: ItemType;
  name: string;
  /** Texture key generated at preload time. */
  icon: string;
  reqLevel?: number;
  /** Equip slot for EQUIP items. */
  slot?: 'weapon' | 'hat' | 'top' | 'bottom';
  stats?: ItemStats;
  consume?: ItemConsumeEffect;
  /** Max items that fit in a single inventory slot. */
  maxStack?: number;
  /** Mesos cost to buy this item from an NPC shop. */
  buyPrice?: number;
  /** Mesos an NPC pays when you sell this item (omit = not sellable). */
  sellPrice?: number;
}

/**
 * An NPC shop's catalogue (design.md §3.2, docs/phase5.md 階段六). The shop only
 * references itemIds; prices live on each ItemDef so the item database stays the
 * single source of truth.
 */
export interface ShopDef {
  shopId: number;
  /** Display name of the shopkeeper NPC. */
  npcName: string;
  /** Line shown when the shop opens. */
  greeting: string;
  /** itemIds the shop offers for sale. */
  stock: number[];
}

/** A drop entry with a probability (0..1) and quantity range. */
export interface DropEntry {
  itemId: number;
  chance: number;
  min: number;
  max: number;
}

export interface MonsterDef {
  monsterId: number;
  name: string;
  texture: string;
  level: number;
  maxHP: number;
  /** Flat physical defense subtracted from incoming damage. */
  pdef: number;
  /** Touch damage dealt to the player on contact. */
  touchDamage: number;
  exp: number;
  moveSpeed: number;
  /** Body size for the generated texture + hitbox. */
  bodyWidth: number;
  bodyHeight: number;
  drops: DropEntry[];
}

export type SkillType = 'ACTIVE' | 'PASSIVE' | 'BUFF';

export interface SkillDef {
  skillId: number;
  name: string;
  type: SkillType;
  icon: string;
  mpCost: number;
  cooldownMs: number;
  /** ACTIVE: damage multiplier applied to the base attack (e.g. 1.8 = 180%). */
  damageMultiplier?: number;
  /** ACTIVE: how many monsters the skill can hit in one cast. */
  maxTargets?: number;
  /** ACTIVE: hitbox reach in px in front of the player. */
  range?: number;
  /** PASSIVE: flat stat bonuses folded into StatManager. */
  passiveStats?: ItemStats;
  /** BUFF: duration in ms and the stat bonuses granted while active. */
  durationMs?: number;
  buffStats?: ItemStats;
  description: string;
}

/** One occupied inventory slot. */
export interface InventorySlot {
  itemId: number;
  qty: number;
}

/** The four primary attributes (design.md §3.1). */
export interface PrimaryStats {
  str: number;
  dex: number;
  int: number;
  luk: number;
}
