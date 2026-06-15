import { Container, Sprite } from 'pixi.js';
import type { Texture } from 'pixi.js';
import { PHYSICS } from '../constants';
import type { FootholdMap } from './Foothold';
import type { Keyboard } from './input';
import type { TextureSet } from './textures';

const ATTACK_MS = 280;

/**
 * The player avatar as a layered PIXI.Container paper-doll — exactly the
 * structure the architecture calls for: a `rig` Container holds Body / Pants /
 * Coat / Hair / Weapon sprites in z-order, so moving or flipping the outer
 * container moves every "equipped" part together. Movement uses foothold-based
 * terrain collision rather than box physics.
 */
export class Character extends Container {
  vx = 0;
  vy = 0;
  facing: 1 | -1 = 1;
  grounded = false;
  attackTimer = 0;
  iframe = 0;

  private readonly rig: Container;
  private readonly armRig: Container;
  private animClock = 0;

  constructor(tex: TextureSet) {
    super();
    this.rig = new Container();

    const part = (t: Texture, ax: number, ay: number, x: number, y: number): Sprite => {
      const s = new Sprite(t);
      s.anchor.set(ax, ay);
      s.position.set(x, y);
      return s;
    };

    // Back-to-front: pants → coat → head → hair → (arm + weapon).
    const pants = part(tex.pants, 0.5, 1, 0, 0);
    const coat = part(tex.coat, 0.5, 1, 0, -16);
    const head = part(tex.head, 0.5, 1, 0, -38);
    const hair = part(tex.hair, 0.5, 1, 0, -56);

    this.armRig = new Container();
    this.armRig.position.set(6, -34);
    this.armRig.addChild(part(tex.arm, 0.5, 0, 0, 0), part(tex.weapon, 0.5, 0, 2, 6));

    this.rig.addChild(pants, coat, head, hair, this.armRig);
    this.addChild(this.rig);
  }

  get attacking(): boolean {
    return this.attackTimer > 0;
  }

  startAttack(): void {
    if (this.attackTimer <= 0) this.attackTimer = ATTACK_MS;
  }

  update(dtMs: number, kb: Keyboard, fh: FootholdMap): void {
    const dt = dtMs / 1000;
    if (this.attackTimer > 0) this.attackTimer -= dtMs;
    if (this.iframe > 0) this.iframe -= dtMs;
    const locked = this.attacking && this.grounded;

    // Horizontal movement.
    if (!locked) {
      if (kb.isDown('ArrowLeft') && !kb.isDown('ArrowRight')) {
        this.vx = -PHYSICS.walkSpeed;
        this.facing = -1;
      } else if (kb.isDown('ArrowRight') && !kb.isDown('ArrowLeft')) {
        this.vx = PHYSICS.walkSpeed;
        this.facing = 1;
      } else {
        this.vx = 0;
      }
    } else {
      this.vx = 0;
    }

    // Jump.
    if (kb.isDown('Space') && this.grounded && !locked) {
      this.vy = PHYSICS.jumpVelocity;
      this.grounded = false;
    }

    // Gravity + integrate.
    this.vy = Math.min(this.vy + PHYSICS.gravity * dt, PHYSICS.maxFall);
    const nx = this.x + this.vx * dt;
    const ny = this.y + this.vy * dt;

    const land = this.vy >= 0 ? fh.landingY(nx, this.y, ny) : null;
    if (land !== null) {
      this.y = land;
      this.vy = 0;
      this.grounded = true;
    } else {
      this.y = ny;
      this.grounded = false;
    }
    this.x = nx;

    this.animate(dtMs);
  }

  private animate(dtMs: number): void {
    this.animClock += dtMs;
    this.rig.scale.x = this.facing;

    // Attack swing (local space; the rig flip handles facing).
    if (this.attacking) {
      const prog = 1 - this.attackTimer / ATTACK_MS;
      this.armRig.rotation = -2.0 * (1 - prog) + 1.4 * prog;
    } else {
      this.armRig.rotation = 0;
    }

    // Walk bob / idle breathe.
    const moving = Math.abs(this.vx) > 1 && this.grounded;
    this.rig.y = moving ? -Math.abs(Math.sin(this.animClock / 90)) * 2 : Math.sin(this.animClock / 420) * -1;

    // Flash while invulnerable.
    this.alpha = this.iframe > 0 ? 0.5 : 1;
  }
}
