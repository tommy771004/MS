import Phaser from 'phaser';
import { Physics, PlayerBody, Combat, Depth } from '../config';
import { StateMachine, type State } from './StateMachine';
import { Avatar } from './Avatar';
import type { StatManager } from '../systems/StatManager';

/** Per-frame input snapshot read from the keyboard. */
interface InputFlags {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jumpHeld: boolean;
  jumpPressed: boolean;
  attackPressed: boolean;
}

/** Payload emitted on the 'attack' event so GameScene can resolve damage. */
export interface MeleeHit {
  rect: Phaser.Geom.Rectangle;
  multiplier: number;
  maxTargets: number;
  kind: 'basic' | 'skill';
}

const States = {
  Idle: 'idle',
  Walk: 'walk',
  Jump: 'jump',
  Prone: 'prone',
  Attack: 'attack',
  Climb: 'climb',
  Dead: 'dead',
} as const;

/**
 * The player avatar (design.md §2.1, §2.2).
 *
 * - A Container holds the physics body; an inner "rig" Container holds the
 *   paper-doll parts (torso / head / arm+weapon) so we can flip and animate
 *   limbs independently of the collision body.
 * - Movement is a strict FSM: idle → walk → jump → prone → attack → climb.
 * - Jump height is variable (hold to jump higher); one-way platforms are
 *   passed through with ↓ + jump.
 */
export class Player extends Phaser.GameObjects.Container {
  declare body: Phaser.Physics.Arcade.Body;

  readonly stats: StatManager;
  facing: 1 | -1 = 1;

  /** True while intentionally falling through a one-way platform. */
  isDroppingThrough = false;
  /** True while attached to a ladder/rope. */
  isClimbing = false;

  /** Data-driven paper-doll rig (z-layered like MapleSalon2's renderer). */
  readonly avatar: Avatar;
  private readonly rig: Phaser.GameObjects.Container;
  private readonly armRig: Phaser.GameObjects.Container;

  private readonly fsm: StateMachine<Player>;
  private readonly keys: {
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    jump: Phaser.Input.Keyboard.Key[];
    attack: Phaser.Input.Keyboard.Key[];
  };

  inputState: InputFlags = {
    left: false,
    right: false,
    up: false,
    down: false,
    jumpHeld: false,
    jumpPressed: false,
    attackPressed: false,
  };

  /** Ladder bounds the player currently overlaps (set by GameScene). */
  nearbyLadder: Phaser.Geom.Rectangle | null = null;

  private jumpCutDone = false;
  private attackSpawned = false;
  private iframeUntil = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, stats: StatManager) {
    super(scene, x, y);
    this.stats = stats;

    // --- Paper-doll rig (design.md §2.2): z-layered Avatar ---
    this.avatar = new Avatar(scene);
    this.rig = this.avatar;
    this.armRig = this.avatar.armGroup;
    this.add(this.rig);

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(Depth.Player);

    this.body.setSize(PlayerBody.width, PlayerBody.height);
    this.body.setOffset(-PlayerBody.width / 2, -PlayerBody.height / 2);
    this.body.setGravityY(Physics.gravityY);
    this.body.setMaxVelocity(10000, Physics.maxFallSpeed);
    this.body.setCollideWorldBounds(true);

    const kb = scene.input.keyboard!;
    this.keys = {
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      up: kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      down: kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      jump: [Phaser.Input.Keyboard.KeyCodes.SPACE, Phaser.Input.Keyboard.KeyCodes.ALT].map((c) => kb.addKey(c)),
      attack: [Phaser.Input.Keyboard.KeyCodes.CTRL, Phaser.Input.Keyboard.KeyCodes.X].map((c) => kb.addKey(c)),
    };

    this.fsm = new StateMachine<Player>(this)
      .add(idleState)
      .add(walkState)
      .add(jumpState)
      .add(proneState)
      .add(attackState)
      .add(climbState)
      .add(deadState);
    this.fsm.transition(States.Idle);
  }

  get onGround(): boolean {
    return this.body.blocked.down || this.body.touching.down;
  }

  get stateName(): string {
    return this.fsm.currentName;
  }

  get isInvulnerable(): boolean {
    return this.scene.time.now < this.iframeUntil;
  }

  // ---- Per-frame update ----------------------------------------------------
  // Called explicitly from GameScene.update (Containers aren't auto-ticked).

  tick(_time: number, delta: number): void {
    this.readInput();
    this.fsm.update(delta);
    this.faceVisual();
    this.depthSortHint();
  }

  private readInput(): void {
    const jumpPressed = this.keys.jump.some((k) => Phaser.Input.Keyboard.JustDown(k));
    const attackPressed = this.keys.attack.some((k) => Phaser.Input.Keyboard.JustDown(k));
    this.inputState = {
      left: this.keys.left.isDown,
      right: this.keys.right.isDown,
      up: this.keys.up.isDown,
      down: this.keys.down.isDown,
      jumpHeld: this.keys.jump.some((k) => k.isDown),
      jumpPressed,
      attackPressed,
    };
  }

  /** Flip the rig (not the body) to face the movement direction. */
  private faceVisual(): void {
    if (!this.isClimbing) {
      if (this.inputState.left && !this.inputState.right) this.facing = -1;
      else if (this.inputState.right && !this.inputState.left) this.facing = 1;
    }
    this.rig.scaleX = this.facing * Math.abs(this.rig.scaleX || 1);
  }

  /** Tiny per-frame depth nudge so the player draws above overlapping mobs. */
  private depthSortHint(): void {
    this.setDepth(Depth.Player + this.y * 0.0001);
  }

  // ---- Shared movement helpers used by states ------------------------------

  horizontalMove(speed: number): void {
    if (this.inputState.left && !this.inputState.right) this.body.setVelocityX(-speed);
    else if (this.inputState.right && !this.inputState.left) this.body.setVelocityX(speed);
    else this.body.setVelocityX(0);
  }

  startJump(): void {
    this.body.setVelocityY(Physics.jumpVelocity);
    this.jumpCutDone = false;
  }

  /** Variable jump height: cut the rise short if the key is released early. */
  applyJumpCut(): void {
    if (!this.jumpCutDone && !this.inputState.jumpHeld && this.body.velocity.y < 0) {
      this.body.setVelocityY(this.body.velocity.y * Physics.jumpCutMultiplier);
      this.jumpCutDone = true;
    }
  }

  /** Try to drop through a one-way platform with ↓ + jump. */
  tryDropThrough(): boolean {
    if (!(this.inputState.down && this.inputState.jumpPressed && this.onGround)) return false;
    this.isDroppingThrough = true;
    this.body.setVelocityY(40);
    this.scene.time.delayedCall(220, () => (this.isDroppingThrough = false));
    return true;
  }

  /** Enter the ladder the player is standing in front of. */
  private tryGrabLadder(): boolean {
    if (!this.nearbyLadder) return false;
    const wantsUp = this.inputState.up;
    const wantsDown = this.inputState.down && !this.onGround;
    if (!wantsUp && !wantsDown) return false;
    this.fsm.transition(States.Climb);
    return true;
  }

  attemptGrabLadder(): boolean {
    return this.tryGrabLadder();
  }

  // ---- Attack --------------------------------------------------------------

  /** Build the melee hitbox in front of the player and broadcast it. */
  emitMelee(multiplier: number, maxTargets: number, range: number, kind: MeleeHit['kind']): void {
    const w = Math.max(Combat.hitboxWidth, range);
    const h = Combat.hitboxHeight;
    const x = this.facing === 1 ? this.x + 6 : this.x - 6 - w;
    const rect = new Phaser.Geom.Rectangle(x, this.y - h / 2, w, h);
    this.emit('attack', { rect, multiplier, maxTargets, kind } satisfies MeleeHit);
  }

  /** GameScene calls this to trigger a skill swing (re-uses the attack state). */
  performSkill(multiplier: number, maxTargets: number, range: number): void {
    this.pendingSkill = { multiplier, maxTargets, range };
    this.fsm.transition(States.Attack, true);
  }
  pendingSkill: { multiplier: number; maxTargets: number; range: number } | null = null;

  // ---- Taking damage / death ----------------------------------------------

  takeHit(rawDamage: number, fromX: number): boolean {
    if (this.isInvulnerable || this.stats.isDead) return false;
    const killed = this.stats.takeDamage(rawDamage);
    this.iframeUntil = this.scene.time.now + 600;

    // Knockback away from the source + red flash.
    const dir = this.x < fromX ? -1 : 1;
    this.body.setVelocity(dir * 180, -220);
    this.flashTint(0xff5555, 600);

    if (killed) this.fsm.transition(States.Dead);
    return killed;
  }

  private flashTint(color: number, durationMs: number): void {
    const parts = this.avatar.tintParts;
    parts.forEach((p) => p.setTint(color));
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 120,
      yoyo: true,
      repeat: Math.floor(durationMs / 240),
      onUpdate: (tw) => {
        const v = tw.getValue() ?? 0;
        if (v > 0.5) parts.forEach((p) => p.clearTint());
        else parts.forEach((p) => p.setTint(color));
      },
      onComplete: () => parts.forEach((p) => p.clearTint()),
    });
  }

  revive(x: number, y: number): void {
    this.stats.reviveFull();
    this.setPosition(x, y);
    this.body.setVelocity(0, 0);
    this.iframeUntil = this.scene.time.now + 1500;
    this.fsm.transition(States.Idle);
  }

  // ---- Animation helpers ---------------------------------------------------

  setSquash(sx: number, sy: number): void {
    this.rig.scaleX = this.facing * sx;
    this.rig.scaleY = sy;
  }

  setArmAngle(deg: number): void {
    this.armRig.setAngle(deg);
  }

  setRigOffsetY(y: number): void {
    this.rig.y = y;
  }

  /** Wind up and swing the weapon arm for an attack. */
  swingArm(): void {
    this.scene.tweens.killTweensOf(this.armRig);
    const start = this.facing === 1 ? -120 : 120;
    const end = this.facing === 1 ? 90 : -90;
    this.armRig.setAngle(start);
    this.scene.tweens.add({
      targets: this.armRig,
      angle: end,
      duration: Combat.attackLockMs * 0.7,
      ease: 'Cubic.out',
    });
  }

  endSwing(): void {
    this.scene.tweens.killTweensOf(this.armRig);
    this.armRig.setAngle(0);
  }

  bob(amount: number, speed: number): void {
    this.rig.y = Math.sin(this.scene.time.now / speed) * amount;
  }

  resetRig(): void {
    this.rig.y = 0;
    this.rig.scaleY = 1;
    this.rig.scaleX = this.facing;
    this.armRig.setAngle(0);
  }

  // Internal accessors for states (kept on the instance for the FSM).
  get _fsm(): StateMachine<Player> {
    return this.fsm;
  }
  markAttackSpawned(v: boolean): void {
    this.attackSpawned = v;
  }
  get _attackSpawned(): boolean {
    return this.attackSpawned;
  }
}

// =============================================================================
// FSM states. Each is a stateless object operating on the Player owner.
// =============================================================================

function toGroundedState(p: Player): void {
  if (Math.abs(p.body.velocity.x) > 5 && (p.inputState.left || p.inputState.right)) p._fsm.transition(States.Walk);
  else p._fsm.transition(States.Idle);
}

const idleState: State<Player> = {
  name: States.Idle,
  enter: (p) => p.resetRig(),
  update: (p) => {
    if (p.stats.isDead) return p._fsm.transition(States.Dead);
    p.horizontalMove(0);
    p.bob(1.2, 420);

    if (p.attemptGrabLadder()) return;
    if (p.inputState.attackPressed) return p._fsm.transition(States.Attack);
    if (p.inputState.down && p.onGround) {
      if (p.tryDropThrough()) return p._fsm.transition(States.Jump);
      return p._fsm.transition(States.Prone);
    }
    if (p.inputState.jumpPressed && p.onGround) {
      p.startJump();
      return p._fsm.transition(States.Jump);
    }
    if ((p.inputState.left || p.inputState.right) && p.onGround) return p._fsm.transition(States.Walk);
    if (!p.onGround) return p._fsm.transition(States.Jump);
  },
};

const walkState: State<Player> = {
  name: States.Walk,
  enter: (p) => p.resetRig(),
  update: (p) => {
    if (p.stats.isDead) return p._fsm.transition(States.Dead);
    p.horizontalMove(Physics.walkSpeed);
    p.bob(1.8, 90);
    // gentle forward lean
    p.setArmAngle(Math.sin(p.scene.time.now / 90) * 12);

    if (p.attemptGrabLadder()) return;
    if (p.inputState.attackPressed) return p._fsm.transition(States.Attack);
    if (p.inputState.down && p.onGround) {
      if (p.tryDropThrough()) return p._fsm.transition(States.Jump);
      return p._fsm.transition(States.Prone);
    }
    if (p.inputState.jumpPressed && p.onGround) {
      p.startJump();
      return p._fsm.transition(States.Jump);
    }
    if (!p.onGround) return p._fsm.transition(States.Jump);
    if (!p.inputState.left && !p.inputState.right) return p._fsm.transition(States.Idle);
  },
};

const jumpState: State<Player> = {
  name: States.Jump,
  enter: (p) => {
    p.resetRig();
    p.setSquash(0.92, 1.1); // stretch upward
  },
  update: (p) => {
    if (p.stats.isDead) return p._fsm.transition(States.Dead);
    p.horizontalMove(Physics.walkSpeed); // air control
    p.applyJumpCut();
    // squash easing back toward neutral
    const sy = Phaser.Math.Linear(p.body.velocity.y < 0 ? 1.1 : 0.95, 1, 0.1);
    p.setSquash(1, sy);

    if (p.attemptGrabLadder()) return;
    if (p.inputState.attackPressed) return p._fsm.transition(States.Attack);
    if (p.onGround) return toGroundedState(p);
  },
};

const proneState: State<Player> = {
  name: States.Prone,
  enter: (p) => {
    p.body.setVelocityX(0);
    p.setSquash(1.15, 0.55);
    p.setRigOffsetY(10);
  },
  update: (p) => {
    if (p.stats.isDead) return p._fsm.transition(States.Dead);
    p.body.setVelocityX(0);

    if (p.inputState.jumpPressed && p.tryDropThrough()) return p._fsm.transition(States.Jump);
    if (!p.inputState.down || !p.onGround) return toGroundedState(p);
  },
  exit: (p) => {
    p.setRigOffsetY(0);
  },
};

const attackState: State<Player> = {
  name: States.Attack,
  enter: (p) => {
    p.resetRig();
    p.markAttackSpawned(false);
    if (p.onGround) p.body.setVelocityX(0); // horizontal lock (design.md §2.1)
    p.swingArm();
  },
  update: (p, dt) => {
    if (p.stats.isDead) return p._fsm.transition(States.Dead);
    if (p.onGround) p.body.setVelocityX(0);

    // Spawn the hitbox once, partway through the swing.
    if (!p._attackSpawned && p._fsm.elapsed >= Combat.attackLockMs * 0.35) {
      p.markAttackSpawned(true);
      const skill = p.pendingSkill;
      if (skill) {
        p.emitMelee(skill.multiplier, skill.maxTargets, skill.range, 'skill');
        p.pendingSkill = null;
      } else {
        p.emitMelee(1, 1, Combat.hitboxWidth, 'basic');
      }
    }

    void dt;
    if (p._fsm.elapsed >= Combat.attackLockMs) {
      if (!p.onGround) return p._fsm.transition(States.Jump);
      return toGroundedState(p);
    }
  },
  exit: (p) => {
    p.endSwing();
    p.pendingSkill = null;
  },
};

const climbState: State<Player> = {
  name: States.Climb,
  enter: (p) => {
    p.isClimbing = true;
    p.body.setAllowGravity(false);
    p.body.setVelocity(0, 0);
    if (p.nearbyLadder) p.setX(p.nearbyLadder.centerX);
    p.resetRig();
  },
  update: (p) => {
    if (p.stats.isDead) {
      p._fsm.transition(States.Dead);
      return;
    }
    const ladder = p.nearbyLadder;
    if (!ladder) return p._fsm.transition(States.Jump);
    p.setX(ladder.centerX);

    let vy = 0;
    if (p.inputState.up) vy = -Physics.climbSpeed;
    else if (p.inputState.down) vy = Physics.climbSpeed;
    p.body.setVelocityY(vy);

    // Climbing animation: alternate the arm as you ascend.
    if (vy !== 0) p.setArmAngle(Math.sin(p.scene.time.now / 80) * 30);

    // Leave the ladder by jumping off or walking off the top/bottom.
    if (p.inputState.jumpPressed) {
      p.startJump();
      return p._fsm.transition(States.Jump);
    }
    if (p.y < ladder.top - 2 || p.y > ladder.bottom + 2) {
      return toGroundedState(p);
    }
    if ((p.inputState.left || p.inputState.right) && p.onGround) {
      return p._fsm.transition(States.Walk);
    }
  },
  exit: (p) => {
    p.isClimbing = false;
    p.body.setAllowGravity(true);
  },
};

const deadState: State<Player> = {
  name: States.Dead,
  enter: (p) => {
    p.body.setVelocityX(0);
    p.setSquash(1.2, 0.5);
    p.setArmAngle(60);
    p.setAlpha(0.6);
  },
  update: (p) => {
    p.body.setVelocityX(0);
  },
  exit: (p) => {
    p.setAlpha(1);
    p.resetRig();
  },
};
