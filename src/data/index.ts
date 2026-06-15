/**
 * Typed access to the data-driven content. All gameplay numbers live in the
 * JSON files next to this module so the game can be re-balanced without
 * touching code (design.md §6).
 */
import type { ItemDef, MonsterDef, SkillDef, ShopDef } from '../types';
import itemsRaw from './items.json';
import monstersRaw from './monsters.json';
import skillsRaw from './skills.json';
import shopsRaw from './shops.json';

export const Items = itemsRaw as ItemDef[];
export const Monsters = monstersRaw as MonsterDef[];
export const Skills = skillsRaw as SkillDef[];
export const Shops = shopsRaw as ShopDef[];

const itemById = new Map<number, ItemDef>(Items.map((i) => [i.itemId, i]));
const monsterById = new Map<number, MonsterDef>(Monsters.map((m) => [m.monsterId, m]));
const skillById = new Map<number, SkillDef>(Skills.map((s) => [s.skillId, s]));
const shopById = new Map<number, ShopDef>(Shops.map((s) => [s.shopId, s]));

export function getItem(itemId: number): ItemDef {
  const def = itemById.get(itemId);
  if (!def) throw new Error(`Unknown itemId: ${itemId}`);
  return def;
}

export function getMonster(monsterId: number): MonsterDef {
  const def = monsterById.get(monsterId);
  if (!def) throw new Error(`Unknown monsterId: ${monsterId}`);
  return def;
}

export function getSkill(skillId: number): SkillDef {
  const def = skillById.get(skillId);
  if (!def) throw new Error(`Unknown skillId: ${skillId}`);
  return def;
}

export function getShop(shopId: number): ShopDef {
  const def = shopById.get(shopId);
  if (!def) throw new Error(`Unknown shopId: ${shopId}`);
  return def;
}
