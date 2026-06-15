import { Application, Container, Graphics, Sprite, type Ticker } from 'pixi.js';
import { VIEW, WORLD_WIDTH, COLORS } from '../constants';
import { buildTextures, type TextureSet } from './textures';
import { FootholdMap, type FootholdSeg } from './Foothold';
import { Character } from './Character';
import { Monster, type MonsterConfig } from './Monster';
import { Parallax } from './Parallax';
import { Keyboard } from './input';
import { useGameStore } from '../store/gameStore';

const SPAWN = { x: 200, y: 0 };

interface SpawnDef {
  cfg: MonsterConfig;
  x: number;
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/**
 * The WebGL game layer. Owns the PIXI scene (parallax + world + entities), the
 * game loop, foothold terrain, and combat — and pushes discrete results
 * (damage numbers, HP/EXP changes, chat) into the Zustand store for the React
 * DOM UI to render. It never touches the DOM UI directly.
 */
export class PixiGame {
  readonly app = new Application();
  private readonly world = new Container();
  private parallax!: Parallax;
  private tex!: TextureSet;
  private fh!: FootholdMap;
  private player!: Character;
  private monsters: Monster[] = [];
  private spawns: SpawnDef[] = [];
  private readonly monsterDef = new Map<Monster, SpawnDef>();
  private kb!: Keyboard;
  private camX = 0;
  private attackResolved = false;
  private ready = false;
  private readonly tick = (t: Ticker): void => this.update(t.deltaMS);

  async init(parent: HTMLElement): Promise<void> {
    await this.app.init({
      width: VIEW.width,
      height: VIEW.height,
      background: 0x8fb7d6,
      antialias: false,
      autoDensity: true,
      resolution: Math.min(2, window.devicePixelRatio || 1),
    });
    parent.appendChild(this.app.canvas);

    this.tex = buildTextures(this.app.renderer);

    this.parallax = new Parallax(this.tex);
    this.app.stage.addChild(this.parallax);
    this.app.stage.addChild(this.world);

    this.buildTerrain();
    this.buildMonsters();

    this.player = new Character(this.tex);
    this.player.position.set(SPAWN.x, SPAWN.y);
    this.world.addChild(this.player);

    this.kb = new Keyboard();
    this.app.ticker.add(this.tick);
    this.ready = true;
  }

  // ---- World ---------------------------------------------------------------

  private buildTerrain(): void {
    const bottom = VIEW.height + 40;
    const segs: FootholdSeg[] = [
      { x1: 0, y1: 460, x2: 2200, y2: 460 }, // main ground
      { x1: 2200, y1: 460, x2: 2500, y2: 380 }, // slope up
      { x1: 2500, y1: 380, x2: WORLD_WIDTH, y2: 380 }, // upper flat
      { x1: 700, y1: 340, x2: 950, y2: 340 }, // platform 1
      { x1: 1300, y1: 300, x2: 1550, y2: 300 }, // platform 2
    ];
    this.fh = new FootholdMap(segs);

    // Filled terrain bodies (handles slopes/platforms visually).
    const gfx = new Graphics();
    for (const s of segs) {
      gfx.poly([s.x1, s.y1, s.x2, s.y2, s.x2, bottom, s.x1, bottom]).fill(COLORS.dirt);
      gfx.poly([s.x1, s.y1, s.x2, s.y2, s.x2, s.y2 + 6, s.x1, s.y1 + 6]).fill(COLORS.grassTop);
    }
    this.world.addChild(gfx);

    // Batch-rendered ground tiles along the main flat foothold (one draw call).
    for (let x = 0; x < 2200; x += 40) {
      const tile = new Sprite(this.tex.tile);
      tile.position.set(x, 460);
      this.world.addChild(tile);
    }
  }

  private buildMonsters(): void {
    const slime: MonsterConfig = {
      texture: this.tex.slime,
      name: 'Green Slime',
      maxHp: 140,
      speed: 45,
      exp: 18,
      patrolMin: 0,
      patrolMax: 0,
    };
    const mush: MonsterConfig = {
      texture: this.tex.mushroom,
      name: 'Violet Mushroom',
      maxHp: 240,
      speed: 60,
      exp: 34,
      patrolMin: 0,
      patrolMax: 0,
    };

    this.spawns = [
      { cfg: { ...slime, patrolMin: 380, patrolMax: 620 }, x: 500 },
      { cfg: { ...slime, patrolMin: 980, patrolMax: 1240 }, x: 1100 },
      { cfg: { ...mush, patrolMin: 1450, patrolMax: 1850 }, x: 1650 },
      { cfg: { ...slime, patrolMin: 720, patrolMax: 930 }, x: 820 }, // on platform 1
    ];
    for (const s of this.spawns) this.addMonster(s);
  }

  private addMonster(def: SpawnDef): void {
    const groundY = this.fh.groundUnder(def.x) ?? 460;
    const m = new Monster(def.cfg, def.x, groundY);
    this.monsters.push(m);
    this.monsterDef.set(m, def);
    this.world.addChild(m);
  }

  // ---- Loop ----------------------------------------------------------------

  private update(dtRaw: number): void {
    const dtMs = Math.min(dtRaw, 40); // clamp big frame gaps
    const store = useGameStore.getState();

    // Attack (edge-triggered).
    if ((this.kb.justPressed('KeyX') || this.kb.justPressed('ControlLeft')) && !this.player.attacking) {
      this.player.startAttack();
      this.attackResolved = false;
    }

    this.player.update(dtMs, this.kb, this.fh);

    // Apply the hit partway through the swing.
    if (this.player.attacking && !this.attackResolved && this.player.attackTimer <= 190) {
      this.attackResolved = true;
      this.resolveAttack();
    }

    for (const m of this.monsters) m.update(dtMs, this.fh);
    this.handleTouchDamage();

    // Quick-slot potions + inventory toggle (UI also offers buttons).
    if (this.kb.justPressed('Digit1')) store.useItem(2000000);
    if (this.kb.justPressed('Digit2')) store.useItem(2000001);
    if (this.kb.justPressed('KeyI')) store.toggleInventory();

    // Camera follow (clamped to world).
    this.camX = clamp(this.player.x - VIEW.width / 2, 0, Math.max(0, WORLD_WIDTH - VIEW.width));
    this.world.x = -Math.round(this.camX);
    this.parallax.update(this.camX);

    if (useGameStore.getState().player.hp <= 0) this.respawnPlayer();

    this.kb.endFrame();
  }

  private resolveAttack(): void {
    const range = 84;
    const f = this.player.facing;
    const x1 = f === 1 ? this.player.x : this.player.x - range;
    const x2 = f === 1 ? this.player.x + range : this.player.x;
    const store = useGameStore.getState();

    for (const m of this.monsters) {
      if (!m.alive) continue;
      if (m.x + m.halfWidth < x1 || m.x - m.halfWidth > x2) continue;
      if (Math.abs(m.y - this.player.y) > 70) continue;

      const crit = Math.random() < 0.18;
      let dmg = Math.floor(40 + Math.random() * 80);
      if (crit) dmg = Math.floor(dmg * 1.5);
      const killed = m.hit(dmg);

      store.spawnDamage(m.x - this.camX, m.y - m.bodyHeight - 6, dmg, crit, 'enemy');
      if (killed) this.onMonsterKilled(m);
    }
  }

  private onMonsterKilled(m: Monster): void {
    const store = useGameStore.getState();
    store.gainExp(m.exp);
    store.addChat('SYSTEM', `擊倒怪物，獲得 ${m.exp} 經驗`, true);

    const def = this.monsterDef.get(m) ?? this.spawns[0];
    this.world.removeChild(m);
    this.monsters = this.monsters.filter((x) => x !== m);
    this.monsterDef.delete(m);
    m.destroy();

    window.setTimeout(() => this.addMonster(def), 4500);
  }

  private handleTouchDamage(): void {
    if (this.player.iframe > 0) return;
    for (const m of this.monsters) {
      if (!m.alive) continue;
      if (Math.abs(m.x - this.player.x) > m.halfWidth + 14) continue;
      if (Math.abs(m.y - this.player.y) > 40) continue;

      const dmg = Math.floor(8 + Math.random() * 8);
      const store = useGameStore.getState();
      store.damagePlayer(dmg);
      store.spawnDamage(this.player.x - this.camX, this.player.y - 60, dmg, false, 'player');
      this.player.iframe = 700;
      this.player.vx = (this.player.x < m.x ? -1 : 1) * 180;
      this.player.vy = -260;
      this.player.grounded = false;
      break;
    }
  }

  private respawnPlayer(): void {
    const store = useGameStore.getState();
    this.player.position.set(SPAWN.x, SPAWN.y);
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.iframe = 1500;
    store.patchPlayer({ hp: store.player.maxHp, mp: store.player.maxMp });
    store.addChat('SYSTEM', '你倒下了…已在出生點復活。', true);
  }

  destroy(): void {
    if (!this.ready) return; // init hasn't finished; nothing to tear down yet
    this.ready = false;
    this.kb.destroy();
    this.app.ticker.remove(this.tick);
    this.app.destroy(true, { children: true, texture: true });
  }
}
