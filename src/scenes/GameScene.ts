import Phaser from 'phaser';
import { Scenes, Depth, Physics, Combat, Palette } from '../config';
import { Player, type MeleeHit } from '../entities/Player';
import { Monster } from '../entities/Monster';
import { Npc } from '../entities/Npc';
import { StatManager } from '../systems/StatManager';
import { Inventory } from '../systems/Inventory';
import { SkillSystem } from '../systems/SkillSystem';
import { Shop } from '../systems/Shop';
import { DamageNumbers } from '../systems/DamageNumbers';
import { rollDamage, rollTouchDamage } from '../systems/DamageFormula';
import { ParallaxBackground } from '../world/ParallaxBackground';
import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  SOLIDS,
  ONE_WAYS,
  LADDERS,
  PLAYER_SPAWN,
  MONSTER_SPAWNS,
  NPC_SPAWNS,
  type MonsterSpawn,
} from '../world/level';
import { getItem, getMonster, getShop } from '../data';
import type { UISceneData } from './UIScene';

/** How close (px) the player must be to an NPC to open its shop. */
const NPC_INTERACT_RANGE = 70;

/** Skills bound to the A / S keys (design.md §3.3). */
const QUICK_SKILLS = [1001004, 1001005] as const;
const MAX_MONSTERS = 10;

/**
 * The playfield. Owns the world geometry, the player, monsters, drops and all
 * combat wiring. Authoritative-ish for single-player: every hit is resolved
 * here, mirroring how an MMO server would arbitrate (design.md §4).
 */
export class GameScene extends Phaser.Scene {
  private player!: Player;
  private stats!: StatManager;
  private inventory!: Inventory;
  private skills!: SkillSystem;
  private shop!: Shop;
  private damageNumbers!: DamageNumbers;
  private parallax!: ParallaxBackground;

  private solidGroup!: Phaser.Physics.Arcade.StaticGroup;
  private oneWayGroup!: Phaser.Physics.Arcade.StaticGroup;
  private monsters!: Phaser.Physics.Arcade.Group;
  private drops!: Phaser.Physics.Arcade.Group;

  private npcs: Npc[] = [];
  private nearbyNpc: Npc | null = null;

  private ladderRects: Phaser.Geom.Rectangle[] = [];
  private potionKeys!: { hp: Phaser.Input.Keyboard.Key; mp: Phaser.Input.Keyboard.Key };
  private skillKeys!: Phaser.Input.Keyboard.Key[];
  private interactKey!: Phaser.Input.Keyboard.Key;
  private respawning = false;

  constructor() {
    super(Scenes.Game);
  }

  create(): void {
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    this.parallax = new ParallaxBackground(this);
    this.buildTerrain();

    // --- Core systems -------------------------------------------------------
    this.stats = new StatManager({ str: 12, dex: 6, int: 4, luk: 5 }, 1);
    this.inventory = new Inventory();
    this.skills = new SkillSystem(this.stats);
    this.shop = new Shop(this.inventory);
    this.damageNumbers = new DamageNumbers(this);

    this.setupLoadout();

    // --- Player -------------------------------------------------------------
    this.player = new Player(this, PLAYER_SPAWN.x, PLAYER_SPAWN.y, this.stats);
    this.player.on('attack', (hit: MeleeHit) => this.resolveMelee(hit));
    this.stats.on('death', () => this.onPlayerDeath());
    this.stats.on('levelup', (lvl: number) => this.toast(this.player.x, this.player.y - 70, `LEVEL UP! Lv.${lvl}`, Palette.coin));

    // --- Monsters & drops ---------------------------------------------------
    this.monsters = this.physics.add.group({ runChildUpdate: false });
    this.drops = this.physics.add.group({ allowGravity: true });

    this.wireColliders();
    MONSTER_SPAWNS.forEach((s) => this.spawnMonster(s));
    this.time.addEvent({ delay: 2600, loop: true, callback: () => this.maybeRespawn() });

    // --- Shop NPCs ----------------------------------------------------------
    NPC_SPAWNS.forEach((s) => {
      const npc = new Npc(this, s.x, s.surfaceY, s.shopId, getShop(s.shopId).npcName);
      this.npcs.push(npc);
    });

    // --- Camera -------------------------------------------------------------
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setDeadzone(180, 120);

    this.bindActionKeys();

    // --- Launch the HUD in parallel ----------------------------------------
    this.scene.launch(Scenes.UI, {
      stats: this.stats,
      inventory: this.inventory,
      skills: this.skills,
      shop: this.shop,
      player: this.player,
      monsters: this.monsters,
      worldWidth: WORLD_WIDTH,
      worldHeight: WORLD_HEIGHT,
    } satisfies UISceneData);
  }

  // ---- World construction --------------------------------------------------

  private buildTerrain(): void {
    this.solidGroup = this.physics.add.staticGroup();
    this.oneWayGroup = this.physics.add.staticGroup();

    for (const s of SOLIDS) {
      // Visual (skip the off-screen walls).
      if (s.x >= 0 && s.x < WORLD_WIDTH) {
        this.add.tileSprite(s.x, s.y, s.w, s.h, 'tile_ground').setOrigin(0, 0).setDepth(Depth.Tiles);
      }
      this.addStaticBody(this.solidGroup, s.x, s.y, s.w, s.h);
    }

    for (const p of ONE_WAYS) {
      this.add.tileSprite(p.x, p.y, p.w, 16, 'platform_plank').setOrigin(0, 0).setDepth(Depth.Platforms);
      this.addStaticBody(this.oneWayGroup, p.x, p.y, p.w, 16);
    }

    for (const l of LADDERS) {
      const h = l.bottom - l.top;
      this.add.tileSprite(l.x - 16, l.top, 32, h, 'ladder').setOrigin(0, 0).setDepth(Depth.Tiles).setAlpha(0.92);
      this.ladderRects.push(new Phaser.Geom.Rectangle(l.x - 16, l.top, 32, h));
    }
  }

  /** Add an invisible static collision body (decoupled from the visual). */
  private addStaticBody(group: Phaser.Physics.Arcade.StaticGroup, x: number, y: number, w: number, h: number): void {
    const zone = this.add.zone(x, y, w, h).setOrigin(0, 0);
    this.physics.add.existing(zone, true);
    group.add(zone);
    (zone.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject();
  }

  private wireColliders(): void {
    // Solid terrain blocks everything.
    this.physics.add.collider(this.player, this.solidGroup);
    this.physics.add.collider(this.monsters, this.solidGroup);
    this.physics.add.collider(this.drops, this.solidGroup);

    // One-way platforms: only land from above (custom process callback).
    const oneWay = this.oneWayProcess.bind(this);
    this.physics.add.collider(this.player, this.oneWayGroup, undefined, oneWay, this);
    this.physics.add.collider(this.monsters, this.oneWayGroup, undefined, oneWay, this);

    // Combat / pickups.
    this.physics.add.overlap(this.player, this.monsters, (_p, m) => this.onTouchMonster(m as Monster));
    this.physics.add.overlap(this.player, this.drops, (_p, d) => this.onPickup(d as Phaser.Physics.Arcade.Image));
  }

  /**
   * One-way platform rule (design.md §2.1): collide only when the object is
   * moving downward and was above the platform last frame. The player can also
   * intentionally drop through (↓+jump) or climb past it.
   */
  private oneWayProcess(objGO: object, platGO: object): boolean {
    const ob = (objGO as Phaser.Physics.Arcade.Sprite).body as Phaser.Physics.Arcade.Body;
    const pb = (platGO as Phaser.GameObjects.Zone).body as Phaser.Physics.Arcade.StaticBody;
    if (objGO === this.player && (this.player.isDroppingThrough || this.player.isClimbing)) return false;
    const prevBottom = ob.prev.y + ob.height;
    return ob.velocity.y >= 0 && prevBottom <= pb.top + 8;
  }

  // ---- Loadout / progression ----------------------------------------------

  private setupLoadout(): void {
    this.inventory.add(1002000, 1); // beginner sword
    this.inventory.equip(1002000);
    this.inventory.add(1010000, 1); // leather cap
    this.inventory.equip(1010000);
    this.inventory.add(2000000, 20); // red potions
    this.inventory.add(2000001, 20); // blue potions
    this.inventory.addMesos(100);

    this.skills.learn(1000002); // passive iron body
    this.skills.learn(1001004); // power strike
    this.skills.learn(1001005); // slash blast
    this.skills.learn(1101006); // rage buff

    this.refreshEquipBonus();
    this.inventory.on('equip', () => this.refreshEquipBonus());
  }

  private refreshEquipBonus(): void {
    this.stats.setEquipBonus(this.inventory.equippedStats().filter((s): s is NonNullable<typeof s> => !!s));
  }

  // ---- Monsters ------------------------------------------------------------

  private spawnMonster(spawn: MonsterSpawn): void {
    const def = getMonster(spawn.monsterId);
    const m = new Monster(this, spawn.x, spawn.surfaceY - def.bodyHeight / 2, def);
    m.setPatrol(spawn.x - spawn.patrol, spawn.x + spawn.patrol);
    m.on('killed', (mob: Monster) => this.onMonsterKilled(mob));
    this.monsters.add(m);
  }

  private maybeRespawn(): void {
    if (this.monsters.countActive(true) >= MAX_MONSTERS) return;
    const spawn = Phaser.Utils.Array.GetRandom(MONSTER_SPAWNS) as MonsterSpawn;
    // Don't pop a monster right on top of the player.
    if (Math.abs(spawn.x - this.player.x) < 260) return;
    this.spawnMonster(spawn);
  }

  private onMonsterKilled(mob: Monster): void {
    this.stats.gainExp(mob.def.exp);
    this.toast(mob.x, mob.y - 24, `+${mob.def.exp} EXP`, 0xb9f2ff, 16);

    for (const drop of mob.def.drops) {
      if (Math.random() > drop.chance) continue;
      const qty = Phaser.Math.Between(drop.min, drop.max);
      this.spawnDrop(mob.x, mob.y, drop.itemId, qty);
    }
  }

  // ---- Drops ---------------------------------------------------------------

  private spawnDrop(x: number, y: number, itemId: number, qty: number): void {
    const def = getItem(itemId);
    const isMesos = itemId === 4031138;
    const icon = isMesos ? 'icon_coin' : def.icon;

    const drop = this.drops.create(x, y, icon) as Phaser.Physics.Arcade.Image;
    drop.setDepth(Depth.Drops).setScale(0.85);
    drop.setData('itemId', itemId);
    drop.setData('qty', qty);
    drop.setData('mesos', isMesos ? qty * Phaser.Math.Between(1, 4) : 0);
    drop.setData('pickupAt', this.time.now + 380);

    const body = drop.body as Phaser.Physics.Arcade.Body;
    body.setSize(20, 20);
    body.setGravityY(Physics.gravityY);
    body.setBounce(0.35);
    body.setVelocity(Phaser.Math.Between(-90, 90), -260);

    // Despawn uncollected drops after a while.
    this.time.delayedCall(12000, () => drop.active && drop.destroy());
  }

  private onPickup(drop: Phaser.Physics.Arcade.Image): void {
    if (!drop.active || this.time.now < (drop.getData('pickupAt') as number)) return;
    const itemId = drop.getData('itemId') as number;
    const qty = drop.getData('qty') as number;
    const mesos = drop.getData('mesos') as number;

    if (mesos > 0) {
      this.inventory.addMesos(mesos);
      this.toast(drop.x, drop.y - 10, `+${mesos} mesos`, Palette.coin, 14);
    } else {
      this.inventory.add(itemId, qty);
      const name = getItem(itemId).name.split(' ')[0];
      this.toast(drop.x, drop.y - 10, `+${qty} ${name}`, 0xffffff, 14);
    }
    drop.destroy();
  }

  // ---- Combat resolution ---------------------------------------------------

  /** Resolve a melee swing (basic or skill) against nearby monsters. */
  private resolveMelee(hit: MeleeHit): void {
    this.spawnSlashVfx(hit);

    const candidates: { mob: Monster; dist: number }[] = [];
    for (const obj of this.monsters.getChildren()) {
      const mob = obj as Monster;
      if (!mob.active || !mob.canBeHit(this.time.now)) continue;
      const b = mob.body as Phaser.Physics.Arcade.Body;
      const bounds = new Phaser.Geom.Rectangle(b.x, b.y, b.width, b.height);
      if (Phaser.Geom.Intersects.RectangleToRectangle(hit.rect, bounds)) {
        candidates.push({ mob, dist: Math.abs(mob.x - this.player.x) });
      }
    }
    candidates.sort((a, b) => a.dist - b.dist);

    const attackStats = this.stats.getAttackStats();
    for (const { mob } of candidates.slice(0, hit.maxTargets)) {
      const result = rollDamage(attackStats, mob.def.pdef, hit.multiplier);
      const killed = mob.takeDamage(result.amount, this.player.x, this.time.now);
      this.damageNumbers.pop(mob.x, mob.y - mob.def.bodyHeight / 2, result.amount, { crit: result.isCrit });
      this.spawnSpark(mob.x, mob.y - mob.def.bodyHeight / 4);
      if (killed) this.cameras.main.shake(60, 0.004);
    }
  }

  private onTouchMonster(mob: Monster): void {
    if (!mob.active || this.player.isInvulnerable || this.stats.isDead) return;
    const dmg = rollTouchDamage(mob.def.touchDamage);
    this.player.takeHit(dmg, mob.x);
    this.damageNumbers.pop(this.player.x, this.player.y - 30, dmg, { color: 0xff5566 });
    this.cameras.main.shake(80, 0.006);
  }

  // ---- Player death / respawn ---------------------------------------------

  private onPlayerDeath(): void {
    if (this.respawning) return;
    this.respawning = true;
    this.toast(this.player.x, this.player.y - 60, 'You Died', 0xff4d4d, 26);
    this.cameras.main.flash(200, 80, 0, 0);
    this.time.delayedCall(1800, () => {
      this.player.revive(PLAYER_SPAWN.x, PLAYER_SPAWN.y);
      this.cameras.main.flash(200, 255, 255, 255);
      this.respawning = false;
    });
  }

  // ---- Action keys (potions, skills) --------------------------------------

  private bindActionKeys(): void {
    const kb = this.input.keyboard!;
    this.potionKeys = {
      hp: kb.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
      mp: kb.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
    };
    this.skillKeys = [
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
    ];
    this.interactKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.Z);

    this.potionKeys.hp.on('down', () => this.quaffPotion('hp'));
    this.potionKeys.mp.on('down', () => this.quaffPotion('mp'));
    this.skillKeys.forEach((key, i) => key.on('down', () => this.castSkill(QUICK_SKILLS[i])));
    this.interactKey.on('down', () => this.interactWithNpc());
  }

  /** Talk to the NPC the player is standing next to (opens its shop). */
  private interactWithNpc(): void {
    if (this.stats.isDead || !this.nearbyNpc) return;
    this.events.emit('npc-interact', this.nearbyNpc.shopId);
  }

  /** Track the nearest NPC in range and toggle its prompt + the shop window. */
  private updateNpcProximity(): void {
    let nearest: Npc | null = null;
    let bestDist = NPC_INTERACT_RANGE;
    for (const npc of this.npcs) {
      const dist = Math.abs(npc.x - this.player.x);
      if (dist <= bestDist) {
        bestDist = dist;
        nearest = npc;
      }
    }

    if (nearest === this.nearbyNpc) return;
    this.nearbyNpc?.setPromptVisible(false);
    this.nearbyNpc = nearest;
    if (nearest) nearest.setPromptVisible(true);
    else this.events.emit('npc-leave'); // walked away — let the HUD close the shop
  }

  private quaffPotion(kind: 'hp' | 'mp'): void {
    if (this.stats.isDead) return;
    const itemId = this.inventory.firstUseMatching((d) =>
      kind === 'hp' ? !!d.consume?.healHP : !!d.consume?.healMP,
    );
    if (itemId == null) return;
    const effect = this.inventory.consumeUse(itemId);
    if (!effect) return;
    if (effect.healHP) {
      this.stats.healHP(effect.healHP);
      this.toast(this.player.x, this.player.y - 40, `+${effect.healHP}`, 0x66ff88, 16);
    }
    if (effect.healMP) {
      this.stats.healMP(effect.healMP);
      this.toast(this.player.x, this.player.y - 40, `+${effect.healMP}`, 0x66bbff, 16);
    }
  }

  private castSkill(skillId: number): void {
    if (this.stats.isDead) return;
    const result = this.skills.tryCast(skillId, this.time.now);
    if (!result.ok) {
      if (result.reason === 'mp') this.toast(this.player.x, this.player.y - 50, 'No MP', 0x88aaff, 14);
      return;
    }
    const def = result.def;
    if (def.type === 'ACTIVE') {
      this.player.performSkill(def.damageMultiplier ?? 1, def.maxTargets ?? 1, def.range ?? Combat.hitboxWidth);
      this.toast(this.player.x, this.player.y - 56, def.name.split(' ')[0], Palette.damageCrit, 16);
    } else if (def.type === 'BUFF') {
      this.toast(this.player.x, this.player.y - 56, `${def.name.split(' ')[0]}!`, 0xffd24d, 16);
      this.spawnSpark(this.player.x, this.player.y, 1.6);
    }
  }

  // ---- VFX & floating text -------------------------------------------------

  private spawnSlashVfx(hit: MeleeHit): void {
    const cx = hit.rect.centerX;
    const cy = hit.rect.centerY;
    const slash = this.add
      .image(cx, cy, 'vfx_slash')
      .setDepth(Depth.Vfx)
      .setFlipX(this.player.facing === -1)
      .setScale(hit.kind === 'skill' ? 1.4 : 1)
      .setAlpha(0.95);
    this.tweens.add({ targets: slash, alpha: 0, scaleX: slash.scaleX * 1.3, duration: 180, onComplete: () => slash.destroy() });
  }

  private spawnSpark(x: number, y: number, scale = 1): void {
    const spark = this.add.image(x, y, 'vfx_spark').setDepth(Depth.Vfx).setScale(scale);
    this.tweens.add({ targets: spark, alpha: 0, scale: scale * 1.8, angle: 90, duration: 220, onComplete: () => spark.destroy() });
  }

  private toast(x: number, y: number, text: string, color: number, size = 18): void {
    const t = this.add
      .text(x, y, text, {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: `${size}px`,
        color: Phaser.Display.Color.IntegerToColor(color).rgba,
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(Depth.Vfx + 1);
    this.tweens.add({ targets: t, y: y - 36, alpha: 0, duration: 1000, ease: 'Quad.in', onComplete: () => t.destroy() });
  }

  // ---- Main loop -----------------------------------------------------------

  update(time: number, delta: number): void {
    this.player.tick(time, delta);
    this.player.nearbyLadder = this.findLadder();
    this.skills.update(time);
    this.updateNpcProximity();
    this.parallax.update(this.cameras.main);
  }

  /** Which ladder (if any) the player overlaps — feeds the climb state. */
  private findLadder(): Phaser.Geom.Rectangle | null {
    const px = this.player.x;
    const py = this.player.y;
    for (const r of this.ladderRects) {
      if (px >= r.left && px <= r.right && py >= r.top - 24 && py <= r.bottom + 24) return r;
    }
    return null;
  }
}
