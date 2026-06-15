import type { Character } from '../db/models.ts';

/**
 * Server-authoritative damage roll (design.md §3.1, §4). The client only
 * *requests* an attack; the server alone decides the number, so a hacked
 * client can't inflate its damage. Mirrors the client's DamageFormula shape.
 */

const STAT_FACTOR = 4.0;
const MASTERY = 0.45;
const CRIT_MULTIPLIER = 1.5;

/** A character's effective weapon attack (no equipment model yet → derived). */
export function weaponAttackOf(c: Character): number {
  return 40 + c.level * 4;
}

export interface DamageRoll {
  amount: number;
  crit: boolean;
}

export function rollServerDamage(attacker: Character, monsterDefense: number, multiplier = 1): DamageRoll {
  const wa = weaponAttackOf(attacker);
  const max = ((attacker.str * STAT_FACTOR + attacker.dex) * wa) / 100;
  const min = max * MASTERY;

  let amount = (min + Math.random() * (max - min)) * multiplier;
  const critChance = Math.min(0.05 + attacker.luk * 0.004, 0.5);
  const crit = Math.random() < critChance;
  if (crit) amount *= CRIT_MULTIPLIER;

  amount = Math.max(1, Math.floor(amount - monsterDefense));
  return { amount, crit };
}

/** EXP a character needs to reach the next level (matches the client curve). */
export function expToNext(level: number): number {
  return Math.floor(15 + level * level * 6 + level * 10);
}
