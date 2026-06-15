import { Container, Graphics, Sprite } from 'pixi.js';
import type { Texture } from 'pixi.js';
import type { FootholdMap } from './Foothold';

export interface MonsterConfig {
  texture: Texture;
  name: string;
  maxHp: number;
  speed: number;
  exp: number;
  patrolMin: number;
  patrolMax: number;
}

/**
 * A patrolling monster. Built from a shared Texture so many monsters batch into
 * one draw call (PixiJS batch rendering). Walks along the footholds and snaps
 * to the ground; flashes white on hit.
 */
export class Monster extends Container {
  hp: number;
  readonly maxHp: number;
  readonly exp: number;
  alive = true;

  private dir: 1 | -1 = Math.random() < 0.5 ? -1 : 1;
  private flash = 0;
  private readonly sprite: Sprite;
  private readonly bar: Graphics;

  constructor(
    private readonly cfg: MonsterConfig,
    x: number,
    y: number,
  ) {
    super();
    this.hp = cfg.maxHp;
    this.maxHp = cfg.maxHp;
    this.exp = cfg.exp;

    this.sprite = new Sprite(cfg.texture);
    this.sprite.anchor.set(0.5, 1);
    this.addChild(this.sprite);

    this.bar = new Graphics();
    this.addChild(this.bar);

    this.position.set(x, y);
    this.drawBar();
  }

  /** Half-width / height for hit tests. */
  get halfWidth(): number {
    return this.sprite.width / 2;
  }
  get bodyHeight(): number {
    return this.sprite.height;
  }

  private drawBar(): void {
    const w = 40;
    const ratio = Math.max(0, this.hp / this.maxHp);
    this.bar.clear();
    this.bar.rect(-w / 2, -this.bodyHeight - 8, w, 5).fill({ color: 0x000000, alpha: 0.6 });
    this.bar.rect(-w / 2, -this.bodyHeight - 8, w * ratio, 5).fill({ color: 0x37d067 });
    this.bar.visible = this.hp < this.maxHp;
  }

  update(dtMs: number, fh: FootholdMap): void {
    if (!this.alive) return;
    const dt = dtMs / 1000;

    // Patrol; reverse at bounds.
    if (this.x <= this.cfg.patrolMin) this.dir = 1;
    else if (this.x >= this.cfg.patrolMax) this.dir = -1;
    this.x += this.dir * this.cfg.speed * dt;
    this.sprite.scale.x = this.dir;

    // Stick to the ground.
    const g = fh.groundUnder(this.x);
    if (g !== null) this.y = g;

    // Hit flash decay.
    if (this.flash > 0) {
      this.flash -= dtMs;
      this.sprite.tint = this.flash > 0 ? 0xffffff : 0xffffff;
      this.sprite.alpha = this.flash > 0 ? 0.6 : 1;
    } else {
      this.sprite.alpha = 1;
    }
  }

  /** Apply damage; returns true if this killed it. */
  hit(amount: number): boolean {
    if (!this.alive) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.flash = 90;
    this.drawBar();
    if (this.hp <= 0) {
      this.alive = false;
      return true;
    }
    return false;
  }
}
