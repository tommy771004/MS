import Phaser from 'phaser';

/**
 * Data-driven paper-doll, modelled on MapleSalon2 / maples.im's renderer.
 *
 * Real MapleStory stores a single ordered list of layer names in
 * `Base.wz/zmap.img`; a part's position in that list is its back-to-front draw
 * order. Layer names that aren't in the list (e.g. `mailOverArm`,
 * `weaponBelowBody`, `capOverHair`) are resolved *relative* to a base layer by
 * parsing a `Below/Under/Over/Above` preposition and offsetting ±1. This is a
 * trimmed port of MapleSalon2's `ZmapIndex`
 * (github.com/spd789562/MapleSalon2 — src/renderer/character/zmapIndex.ts).
 */

/** Trimmed zmap: index = back-to-front order. */
export const AVATAR_ZMAP = ['cape', 'body', 'pants', 'top', 'head', 'face', 'hair', 'arm'] as const;

const LAYER_PREP = /(below|under|over|above)/;

/** Resolves a z-layer name to a numeric draw index (with composite support). */
export class ZmapIndex {
  private readonly index = new Map<string, number>();

  constructor(zmap: readonly string[]) {
    // Spread base layers out so a composite ±1 slots cleanly between them.
    zmap.forEach((name, i) => this.index.set(name.toLowerCase(), i * 10));
  }

  resolve(name: string): number {
    const key = name.toLowerCase();
    const cached = this.index.get(key);
    if (cached !== undefined) return cached;

    // Composite, e.g. "capOverHair" -> ["cap","over","hair"].
    const parts = key.split(LAYER_PREP);
    if (parts.length >= 3) {
      let idx = this.index.get(parts[0]) ?? 0;
      for (let i = 1; i < parts.length; i += 2) {
        const prep = parts[i];
        const target = this.index.get(parts[i + 1]) ?? idx;
        idx = prep === 'below' || prep === 'under' ? target - 1 : target + 1;
      }
      this.index.set(key, idx);
      return idx;
    }
    return 0;
  }
}

type LayerDisplay = Phaser.GameObjects.Sprite | Phaser.GameObjects.Container;

interface Layer {
  z: string;
  zIndex: number;
  display: LayerDisplay;
  /**
   * MapleStory "visible slot" codes this layer occupies (e.g. `Ma` mail/top,
   * `Pn` pants). A layer hides when another, higher item claims one of its
   * slots — that's how an overall hides the separate pants. Structural layers
   * (body/head/arm) leave this undefined and are always shown.
   */
  vslot?: string[];
}

/** Options for {@link Avatar.setLayer}. */
export interface LayerOptions {
  x?: number;
  y?: number;
  vslot?: string[];
}

/**
 * The character rig. Holds the layered parts and keeps them z-sorted. The arm
 * and weapon live together in {@link armGroup} so they swing as one unit (our
 * stand-in for MapleStory's per-frame arm sprites); everything else is a
 * managed z-layer that can be swapped/hidden per equipment.
 */
export class Avatar extends Phaser.GameObjects.Container {
  /** Rotatable arm+weapon group (the attack swing pivots this). */
  readonly armGroup: Phaser.GameObjects.Container;
  /** Body parts that tint together on hit-flash. */
  readonly tintParts: Phaser.GameObjects.Sprite[] = [];

  private readonly zmap = new ZmapIndex(AVATAR_ZMAP);
  private readonly layers = new Map<string, Layer>();
  private readonly weapon: Phaser.GameObjects.Sprite;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);

    const body = scene.add.sprite(0, 4, 'player_body');
    const head = scene.add.sprite(0, -14, 'player_head');
    this.tintParts.push(body, head);

    this.armGroup = scene.add.container(6, -2);
    const arm = scene.add.sprite(0, 6, 'player_arm');
    this.weapon = scene.add.sprite(3, 20, 'weapon_sword');
    this.armGroup.add([arm, this.weapon]);

    this.addLayer('body', body);
    this.addLayer('head', head);
    this.addLayer('arm', this.armGroup);
    this.sortLayers();
  }

  /**
   * Create, retexture or remove a managed z-layer (e.g. a worn shirt at `top`
   * or a hat at `capOverHair`). Pass `null` to hide/remove the layer. `vslot`
   * drives the slot-lock visibility (see {@link refreshLocks}).
   */
  setLayer(z: string, textureKey: string | null, opts: LayerOptions = {}): void {
    const { x = 0, y = 0, vslot } = opts;
    const existing = this.layers.get(z);

    if (textureKey == null) {
      existing?.display.destroy();
      this.layers.delete(z);
      this.refreshLocks();
      return;
    }

    if (existing && existing.display instanceof Phaser.GameObjects.Sprite) {
      existing.display.setTexture(textureKey).setPosition(x, y).setVisible(true);
      existing.vslot = vslot;
      this.refreshLocks();
      return;
    }

    const sprite = this.scene.add.sprite(x, y, textureKey);
    this.addLayer(z, sprite, vslot);
    this.sortLayers();
    this.refreshLocks();
  }

  /** Swap the held weapon sprite (stays inside the swinging arm group). */
  setWeapon(textureKey: string | null): void {
    if (textureKey == null) {
      this.weapon.setVisible(false);
      return;
    }
    this.weapon.setTexture(textureKey).setVisible(true);
  }

  private addLayer(z: string, display: LayerDisplay, vslot?: string[]): void {
    this.add(display);
    this.layers.set(z, { z, zIndex: this.zmap.resolve(z), display, vslot });
  }

  /** Reorder children back-to-front by resolved z-index. */
  private sortLayers(): void {
    [...this.layers.values()]
      .sort((a, b) => a.zIndex - b.zIndex)
      .forEach((layer) => this.bringToTop(layer.display));
  }

  /**
   * Slot-lock visibility (port of MapleSalon2's buildLock / refreshLock).
   * Walk layers back-to-front so the topmost item claims each visible slot,
   * then hide any clothing layer that no longer owns all of its own slots —
   * e.g. an overall (`Ma`+`Pn`) takes the `Pn` lock from the separate pants,
   * hiding them.
   */
  private refreshLocks(): void {
    const owner = new Map<string, string>();
    const ordered = [...this.layers.values()].sort((a, b) => a.zIndex - b.zIndex);
    for (const layer of ordered) {
      if (!layer.vslot) continue;
      for (const code of layer.vslot) owner.set(code, layer.z);
    }
    for (const layer of this.layers.values()) {
      if (!layer.vslot) continue; // structural layers are always visible
      layer.display.setVisible(layer.vslot.every((code) => owner.get(code) === layer.z));
    }
  }
}
