import Phaser from 'phaser';
import type { AttackStats } from './StatManager';

export interface DamageResult {
  amount: number;
  isCrit: boolean;
}

/**
 * MapleStory-style damage roll (design.md §3.1):
 *
 *   maxDamage = (mainStat * factor + secondaryStat) * weaponAttack / 100
 *   actual    = random(minDamage, maxDamage) - monsterDefense
 *
 * `minDamage` is derived from a mastery ratio. A skill multiplier scales the
 * whole roll, and LUK gives a small crit chance for extra juice.
 */
const STAT_FACTOR = 4.0;
const MASTERY = 0.45; // min damage = max * MASTERY
const CRIT_MULTIPLIER = 1.5;

export function rollDamage(
  attacker: AttackStats,
  monsterDefense: number,
  skillMultiplier = 1,
): DamageResult {
  const maxDamage = ((attacker.mainStat * STAT_FACTOR + attacker.secondaryStat) * attacker.weaponAttack) / 100;
  const minDamage = maxDamage * MASTERY;

  let amount = Phaser.Math.FloatBetween(minDamage, maxDamage) * skillMultiplier;

  // Crit chance scales mildly with LUK, capped so it stays a bonus not a norm.
  const critChance = Math.min(0.05 + attacker.luk * 0.004, 0.5);
  const isCrit = Math.random() < critChance;
  if (isCrit) amount *= CRIT_MULTIPLIER;

  // Defense is a flat reduction; a hit always does at least 1.
  amount = Math.max(1, Math.floor(amount - monsterDefense));

  return { amount, isCrit };
}

/** Monster touch damage vs the player (kept simple — flat with small jitter). */
export function rollTouchDamage(touchDamage: number): number {
  return Math.max(1, Math.floor(touchDamage * Phaser.Math.FloatBetween(0.85, 1.15)));
}
