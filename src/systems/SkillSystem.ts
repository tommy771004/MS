import Phaser from 'phaser';
import type { ItemStats, SkillDef } from '../types';
import { getSkill } from '../data';
import type { StatManager } from './StatManager';

interface ActiveBuff {
  skillId: number;
  stats: ItemStats;
  expiresAt: number;
}

export interface SkillCastResult {
  ok: boolean;
  reason?: 'cooldown' | 'mp' | 'notActive';
  def: SkillDef;
}

/**
 * Owns the player's learned skills, cooldowns and active buffs (design.md §3.3).
 *
 * - ACTIVE skills are validated here (MP + cooldown) and executed by GameScene.
 * - PASSIVE skills fold their bonuses straight into the StatManager.
 * - BUFF skills apply timed stat bonuses, re-aggregated on a timer.
 *
 * Events: 'cooldown' (skillId, remainingMs, totalMs), 'buff' (active buffs).
 */
export class SkillSystem extends Phaser.Events.EventEmitter {
  private readonly learned: number[] = [];
  private readonly cooldownUntil = new Map<number, number>();
  private readonly buffs: ActiveBuff[] = [];

  constructor(private readonly stats: StatManager) {
    super();
  }

  learn(skillId: number): void {
    if (this.learned.includes(skillId)) return;
    this.learned.push(skillId);
    if (getSkill(skillId).type === 'PASSIVE') this.applyPassives();
  }

  learnedSkills(): SkillDef[] {
    return this.learned.map(getSkill);
  }

  private applyPassives(): void {
    const passive = this.learned
      .map(getSkill)
      .filter((s) => s.type === 'PASSIVE' && s.passiveStats)
      .map((s) => s.passiveStats!);
    this.stats.setPassiveBonus(passive);
  }

  // ---- Cooldowns -----------------------------------------------------------

  remainingCooldown(skillId: number, now: number): number {
    return Math.max(0, (this.cooldownUntil.get(skillId) ?? 0) - now);
  }

  isReady(skillId: number, now: number): boolean {
    return this.remainingCooldown(skillId, now) <= 0;
  }

  /**
   * Attempt to use a skill. For ACTIVE skills this checks MP + cooldown, spends
   * MP and starts the cooldown — GameScene then applies the damage. For BUFF
   * skills it also applies the buff here.
   */
  tryCast(skillId: number, now: number): SkillCastResult {
    const def = getSkill(skillId);
    if (def.type === 'PASSIVE') return { ok: false, reason: 'notActive', def };
    if (!this.isReady(skillId, now)) return { ok: false, reason: 'cooldown', def };
    if (!this.stats.spendMP(def.mpCost)) return { ok: false, reason: 'mp', def };

    this.cooldownUntil.set(skillId, now + def.cooldownMs);
    this.emit('cooldown', skillId, def.cooldownMs, def.cooldownMs);

    if (def.type === 'BUFF' && def.buffStats && def.durationMs) {
      this.applyBuff(def, now);
    }
    return { ok: true, def };
  }

  private applyBuff(def: SkillDef, now: number): void {
    const existing = this.buffs.find((b) => b.skillId === def.skillId);
    const expiresAt = now + (def.durationMs ?? 0);
    if (existing) {
      existing.expiresAt = expiresAt;
    } else {
      this.buffs.push({ skillId: def.skillId, stats: def.buffStats!, expiresAt });
    }
    this.recomputeBuffs();
  }

  private recomputeBuffs(): void {
    this.stats.setBuffBonus(this.buffs.map((b) => b.stats));
    this.emit('buff', this.activeBuffs());
  }

  activeBuffs(): { skillId: number; def: SkillDef; expiresAt: number }[] {
    return this.buffs.map((b) => ({ skillId: b.skillId, def: getSkill(b.skillId), expiresAt: b.expiresAt }));
  }

  /** Drop expired buffs and notify cooldown listeners. Called every frame. */
  update(now: number): void {
    let changed = false;
    for (let i = this.buffs.length - 1; i >= 0; i--) {
      if (this.buffs[i].expiresAt <= now) {
        this.buffs.splice(i, 1);
        changed = true;
      }
    }
    if (changed) this.recomputeBuffs();

    for (const [skillId, until] of this.cooldownUntil) {
      const remaining = until - now;
      this.emit('cooldown', skillId, Math.max(0, remaining), getSkill(skillId).cooldownMs);
      if (remaining <= 0) this.cooldownUntil.delete(skillId);
    }
  }
}
