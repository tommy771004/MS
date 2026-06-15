import Phaser from 'phaser';
import type { ItemStats, PrimaryStats } from '../types';

/** Aggregated bonus stats from one source (equipment, passives, or buffs). */
type BonusBucket = Required<ItemStats>;

const EMPTY_BONUS: BonusBucket = {
  incSTR: 0,
  incDEX: 0,
  incINT: 0,
  incLUK: 0,
  incMaxHP: 0,
  incMaxMP: 0,
  incPAD: 0,
  incMAD: 0,
};

/** Snapshot of everything an attack needs (consumed by DamageFormula). */
export interface AttackStats {
  mainStat: number;
  secondaryStat: number;
  weaponAttack: number;
  level: number;
  luk: number;
}

/**
 * Central, data-driven stat store (design.md §3.1). Owns base attributes, the
 * three bonus buckets, current HP/MP, level and EXP, and recomputes derived
 * stats whenever anything changes. UI subscribes to its events.
 *
 * Events: 'hp', 'mp', 'exp', 'levelup', 'death', 'change'.
 */
export class StatManager extends Phaser.Events.EventEmitter {
  base: PrimaryStats;
  level = 1;
  exp = 0;

  hp = 1;
  mp = 1;
  maxHP = 1;
  maxMP = 1;

  /** Base weapon attack with no weapon equipped (bare fists). */
  private readonly baseWeaponAttack = 8;

  private equipBonus: BonusBucket = { ...EMPTY_BONUS };
  private passiveBonus: BonusBucket = { ...EMPTY_BONUS };
  private buffBonus: BonusBucket = { ...EMPTY_BONUS };

  constructor(base: PrimaryStats, level = 1) {
    super();
    this.base = { ...base };
    this.level = level;
    this.recompute(true);
  }

  // ---- Bonus buckets -------------------------------------------------------

  setEquipBonus(statsList: ItemStats[]): void {
    this.equipBonus = this.merge(statsList);
    this.recompute();
  }

  setPassiveBonus(statsList: ItemStats[]): void {
    this.passiveBonus = this.merge(statsList);
    this.recompute();
  }

  setBuffBonus(statsList: ItemStats[]): void {
    this.buffBonus = this.merge(statsList);
    this.recompute();
  }

  private merge(list: ItemStats[]): BonusBucket {
    const out: BonusBucket = { ...EMPTY_BONUS };
    for (const s of list) {
      for (const k of Object.keys(EMPTY_BONUS) as (keyof BonusBucket)[]) {
        out[k] += s[k] ?? 0;
      }
    }
    return out;
  }

  private bonus(key: keyof BonusBucket): number {
    return this.equipBonus[key] + this.passiveBonus[key] + this.buffBonus[key];
  }

  // ---- Derived stats -------------------------------------------------------

  get str(): number {
    return this.base.str + this.bonus('incSTR');
  }
  get dex(): number {
    return this.base.dex + this.bonus('incDEX');
  }
  get int(): number {
    return this.base.int + this.bonus('incINT');
  }
  get luk(): number {
    return this.base.luk + this.bonus('incLUK');
  }
  get weaponAttack(): number {
    return this.baseWeaponAttack + this.bonus('incPAD');
  }
  get magicAttack(): number {
    return this.bonus('incMAD');
  }

  /** Accuracy / avoidability (design.md §3.1) — simple DEX/LUK derivations. */
  get accuracy(): number {
    return Math.floor(this.dex * 0.8 + this.luk * 0.5);
  }
  get avoidability(): number {
    return Math.floor(this.luk * 0.5 + this.dex * 0.25);
  }

  getAttackStats(): AttackStats {
    // Warrior archetype: STR is main, DEX is secondary.
    return {
      mainStat: this.str,
      secondaryStat: this.dex,
      weaponAttack: this.weaponAttack,
      level: this.level,
      luk: this.luk,
    };
  }

  /** Recompute max HP/MP from level + bonuses, keeping current ratios sane. */
  private recompute(initFull = false): void {
    const prevMaxHP = this.maxHP;
    const prevMaxMP = this.maxMP;

    this.maxHP = 50 + this.level * 18 + this.base.str * 2 + this.bonus('incMaxHP');
    this.maxMP = 20 + this.level * 12 + this.base.int * 3 + this.bonus('incMaxMP');

    if (initFull) {
      this.hp = this.maxHP;
      this.mp = this.maxMP;
    } else {
      // Grant the delta so equipping +HP gear doesn't feel like a heal nerf.
      this.hp = Phaser.Math.Clamp(this.hp + (this.maxHP - prevMaxHP), 1, this.maxHP);
      this.mp = Phaser.Math.Clamp(this.mp + (this.maxMP - prevMaxMP), 0, this.maxMP);
    }
    this.emit('change', this);
    this.emit('hp', this.hp, this.maxHP);
    this.emit('mp', this.mp, this.maxMP);
  }

  // ---- HP / MP -------------------------------------------------------------

  healHP(amount: number): void {
    if (this.hp <= 0) return;
    this.hp = Phaser.Math.Clamp(this.hp + amount, 0, this.maxHP);
    this.emit('hp', this.hp, this.maxHP);
  }

  healMP(amount: number): void {
    this.mp = Phaser.Math.Clamp(this.mp + amount, 0, this.maxMP);
    this.emit('mp', this.mp, this.maxMP);
  }

  spendMP(amount: number): boolean {
    if (this.mp < amount) return false;
    this.mp -= amount;
    this.emit('mp', this.mp, this.maxMP);
    return true;
  }

  /** Returns true if this damage killed the player. */
  takeDamage(amount: number): boolean {
    if (this.hp <= 0) return true;
    this.hp = Math.max(0, this.hp - amount);
    this.emit('hp', this.hp, this.maxHP);
    if (this.hp <= 0) {
      this.emit('death');
      return true;
    }
    return false;
  }

  get isDead(): boolean {
    return this.hp <= 0;
  }

  reviveFull(): void {
    this.hp = this.maxHP;
    this.mp = this.maxMP;
    this.emit('hp', this.hp, this.maxHP);
    this.emit('mp', this.mp, this.maxMP);
  }

  // ---- EXP / leveling ------------------------------------------------------

  /** EXP required to advance from `level` to the next. */
  expToNext(level = this.level): number {
    return Math.floor(15 + level * level * 6 + level * 10);
  }

  gainExp(amount: number): void {
    this.exp += amount;
    let leveled = false;
    while (this.exp >= this.expToNext()) {
      this.exp -= this.expToNext();
      this.level++;
      leveled = true;
      // Auto-distribute a few AP each level (warrior-leaning).
      this.base.str += 3;
      this.base.dex += 1;
      this.base.luk += 1;
    }
    if (leveled) {
      this.recompute();
      this.hp = this.maxHP;
      this.mp = this.maxMP;
      this.emit('hp', this.hp, this.maxHP);
      this.emit('mp', this.mp, this.maxMP);
      this.emit('levelup', this.level);
    }
    this.emit('exp', this.exp, this.expToNext());
  }
}
