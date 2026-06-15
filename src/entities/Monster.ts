import Phaser from 'phaser';
import { Physics, Combat, Depth } from '../config';
import type { MonsterDef } from '../types';

/**
 * A patrolling monster (design.md Phase 2). Walks back and forth within a
 * range, flashes white and gets knocked back when hit, shows a floating HP
 * bar, and emits 'killed' (with itself) on death so GameScene can award EXP
 * and roll drops.
 *
 * Events: 'killed' (monster).
 */
export class Monster extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;

  readonly def: MonsterDef;
  hp: number;
  readonly maxHP: number;

  private dir: 1 | -1 = 1;
  private leftBound = 0;
  private rightBound = 0;
  private invulnUntil = 0;
  private dying = false;

  private readonly hpBarBg: Phaser.GameObjects.Rectangle;
  private readonly hpBarFill: Phaser.GameObjects.Rectangle;
  private readonly hpBarWidth: number;

  constructor(scene: Phaser.Scene, x: number, y: number, def: MonsterDef) {
    super(scene, x, y, def.texture);
    this.def = def;
    this.hp = def.maxHP;
    this.maxHP = def.maxHP;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(Depth.Monster);

    this.body.setSize(def.bodyWidth * 0.82, def.bodyHeight * 0.86);
    this.body.setGravityY(Physics.gravityY);
    this.body.setCollideWorldBounds(true);
    this.body.setMaxVelocity(400, Physics.maxFallSpeed);

    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.leftBound = x - 120;
    this.rightBound = x + 120;

    // Floating HP bar (hidden until first hit).
    this.hpBarWidth = Math.max(34, def.bodyWidth);
    this.hpBarBg = scene.add
      .rectangle(x, y, this.hpBarWidth, 5, 0x000000, 0.7)
      .setDepth(Depth.Monster + 1)
      .setVisible(false);
    this.hpBarFill = scene.add
      .rectangle(x, y, this.hpBarWidth, 5, 0x37d067, 1)
      .setOrigin(0, 0.5)
      .setDepth(Depth.Monster + 2)
      .setVisible(false);

    // Idle squash-bounce for a bit of life.
    scene.tweens.add({
      targets: this,
      scaleY: 0.9,
      scaleX: 1.06,
      duration: 520,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
  }

  setPatrol(left: number, right: number): void {
    this.leftBound = left;
    this.rightBound = right;
  }

  canBeHit(now: number): boolean {
    return !this.dying && now >= this.invulnUntil;
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (this.dying) {
      this.syncHpBar();
      return;
    }

    // Patrol: reverse at the patrol bounds or when bumping a wall.
    if (this.x <= this.leftBound || this.body.blocked.left) this.dir = 1;
    else if (this.x >= this.rightBound || this.body.blocked.right) this.dir = -1;

    this.body.setVelocityX(this.dir * this.def.moveSpeed);
    this.setFlipX(this.dir === -1);
    this.syncHpBar();
  }

  private syncHpBar(): void {
    const top = this.y - this.def.bodyHeight / 2 - 12;
    this.hpBarBg.setPosition(this.x, top);
    this.hpBarFill.setPosition(this.x - this.hpBarWidth / 2, top);
    this.hpBarFill.width = this.hpBarWidth * Phaser.Math.Clamp(this.hp / this.maxHP, 0, 1);
  }

  /** Apply damage. Returns true if this hit killed the monster. */
  takeDamage(amount: number, fromX: number, now: number): boolean {
    if (!this.canBeHit(now)) return false;
    this.invulnUntil = now + Combat.monsterIframeMs;
    this.hp = Math.max(0, this.hp - amount);

    this.hpBarBg.setVisible(true);
    this.hpBarFill.setVisible(true);
    this.flash();

    // Knockback away from the attacker.
    const away = this.x < fromX ? -1 : 1;
    this.body.setVelocity(away * Combat.knockback, -120);

    if (this.hp <= 0) {
      this.die();
      return true;
    }
    return false;
  }

  private flash(): void {
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(Combat.hitFlashMs, () => {
      if (!this.dying) this.clearTint();
    });
  }

  private die(): void {
    this.dying = true;
    this.body.setVelocity(0, 0);
    this.body.setEnable(false);
    this.scene.tweens.killTweensOf(this);
    this.clearTint();
    this.setTint(0x888888);

    this.emit('killed', this);

    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleY: 0.2,
      y: this.y + 8,
      angle: this.dir * 40,
      duration: 260,
      ease: 'Quad.in',
      onComplete: () => this.destroy(),
    });
  }

  destroy(fromScene?: boolean): void {
    this.hpBarBg.destroy();
    this.hpBarFill.destroy();
    super.destroy(fromScene);
  }
}
