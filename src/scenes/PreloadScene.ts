import Phaser from 'phaser';
import { Scenes, Palette, GAME_WIDTH, GAME_HEIGHT } from '../config';

/**
 * Generates every texture the game needs at runtime using the Graphics API.
 *
 * This is deliberate: design.md forbids shipping copyrighted MapleStory art,
 * so we draw simple placeholder sprites in code. Swapping in real (free /
 * self-made) art later is just a matter of `this.load.image(...)` instead.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(Scenes.Preload);
  }

  create(): void {
    this.makePixel();
    this.makeParallax();
    this.makeTiles();
    this.makePlayerParts();
    this.makeWeapons();
    this.makeEquips();
    this.makeMonsters();
    this.makeNpc();
    this.makeDropIcons();
    this.makeSkillIcons();
    this.makeVfx();

    this.scene.start(Scenes.Game);
  }

  /** Draw with a throwaway Graphics, bake to a texture, then clean up. */
  private bake(key: string, width: number, height: number, draw: (g: Phaser.GameObjects.Graphics) => void): void {
    const g = this.add.graphics();
    draw(g);
    g.generateTexture(key, width, height);
    g.destroy();
  }

  private makePixel(): void {
    this.bake('pixel', 4, 4, (g) => {
      g.fillStyle(0xffffff, 1).fillRect(0, 0, 4, 4);
    });
  }

  // ---- Parallax background layers -----------------------------------------

  private makeParallax(): void {
    // Sky gradient (full viewport).
    this.bake('bg_sky', GAME_WIDTH, GAME_HEIGHT, (g) => {
      g.fillGradientStyle(0x16324f, 0x16324f, 0x4a90c4, 0x9fd0e8, 1);
      g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    });

    // Far mountains — tall, desaturated, tiles horizontally.
    const w = GAME_WIDTH;
    this.bake('bg_mountains', w, 220, (g) => {
      g.fillStyle(0x2c4a63, 1);
      this.ridge(g, w, 220, 7, 70, 200);
    });

    // Mid hills — closer, greener.
    this.bake('bg_hills', w, 180, (g) => {
      g.fillStyle(0x2f5d3a, 1);
      this.ridge(g, w, 180, 5, 60, 160);
    });

    // Near treeline — darkest, simple bumpy silhouette.
    this.bake('bg_trees', w, 150, (g) => {
      g.fillStyle(0x1d3a26, 1);
      this.ridge(g, w, 150, 14, 30, 130);
    });
  }

  /** Draws a jagged ridge silhouette that roughly tiles across `width`. */
  private ridge(g: Phaser.GameObjects.Graphics, width: number, height: number, peaks: number, minPeak: number, maxPeak: number): void {
    const step = width / peaks;
    g.beginPath();
    g.moveTo(0, height);
    for (let i = 0; i <= peaks; i++) {
      const x = i * step;
      // First and last peak share a height so the texture tiles cleanly.
      const peakH = i === 0 || i === peaks ? minPeak + 20 : Phaser.Math.Between(minPeak, maxPeak);
      g.lineTo(x - step / 2, height - peakH * 0.6);
      g.lineTo(x, height - peakH);
    }
    g.lineTo(width, height);
    g.closePath();
    g.fillPath();
  }

  // ---- Tiles & terrain -----------------------------------------------------

  private makeTiles(): void {
    // Solid ground tile: dirt body with a grass cap.
    this.bake('tile_ground', 40, 40, (g) => {
      g.fillStyle(0x5a3d28, 1).fillRect(0, 0, 40, 40);
      g.fillStyle(0x4a3020, 1).fillRect(0, 0, 40, 40);
      g.fillStyle(Palette.platformTop, 1).fillRect(0, 0, 40, 9);
      g.fillStyle(0x2f7d3a, 1).fillRect(0, 8, 40, 3);
      // speckles
      g.fillStyle(0x3a2616, 1);
      for (let i = 0; i < 6; i++) g.fillRect(Phaser.Math.Between(2, 36), Phaser.Math.Between(14, 36), 3, 3);
    });

    // One-way platform plank (tiled horizontally).
    this.bake('platform_plank', 40, 16, (g) => {
      g.fillStyle(Palette.platform, 1).fillRect(0, 0, 40, 16);
      g.fillStyle(0x533c25, 1).fillRect(0, 10, 40, 6);
      g.fillStyle(Palette.platformTop, 1).fillRect(0, 0, 40, 5);
      g.lineStyle(1, 0x3a2a19, 0.6).lineBetween(0, 5, 40, 5);
    });

    // Ladder / rope segment (tiled vertically).
    this.bake('ladder', 32, 32, (g) => {
      g.fillStyle(Palette.ladder, 1);
      g.fillRect(4, 0, 5, 32);
      g.fillRect(23, 0, 5, 32);
      g.fillRect(4, 6, 24, 5);
      g.fillRect(4, 22, 24, 5);
    });
  }

  // ---- Player paper-doll parts (design.md §2.2) ---------------------------

  private makePlayerParts(): void {
    // Bare body: skin torso, underwear, skin legs. Clothes are worn z-layers
    // (equip_shirt / equip_pants / equip_overall), composed by the Avatar.
    this.bake('player_body', 28, 32, (g) => {
      g.fillStyle(Palette.skin, 1).fillRoundedRect(2, 0, 24, 20, 5); // torso
      g.fillStyle(0xe6a878, 1).fillRect(2, 13, 24, 2); // waist shade
      g.fillStyle(0x42506e, 1).fillRect(5, 18, 18, 7); // shorts
      g.fillStyle(Palette.skin, 1).fillRect(6, 23, 6, 9).fillRect(16, 23, 6, 9); // legs
      g.fillStyle(0xe6a878, 1).fillRect(13, 23, 2, 9); // leg gap shade
    });

    // Head: skin with hair cap and two eyes.
    this.bake('player_head', 26, 26, (g) => {
      g.fillStyle(Palette.skin, 1).fillCircle(13, 14, 11);
      g.fillStyle(Palette.hair, 1);
      g.slice(13, 14, 12, Phaser.Math.DegToRad(180), Phaser.Math.DegToRad(360), true);
      g.fillPath();
      g.fillRect(1, 6, 24, 4);
      // eyes
      g.fillStyle(0x202028, 1).fillRect(8, 14, 3, 4).fillRect(15, 14, 3, 4);
      // cheeks
      g.fillStyle(0xff9e9e, 0.6).fillCircle(7, 18, 2).fillCircle(19, 18, 2);
    });

    // Arm: short skin-colored limb (the weapon attaches to its tip).
    this.bake('player_arm', 8, 22, (g) => {
      g.fillStyle(Palette.shirt, 1).fillRoundedRect(0, 0, 8, 10, 3);
      g.fillStyle(Palette.skin, 1).fillRoundedRect(0, 8, 8, 14, 3);
    });
  }

  private makeWeapons(): void {
    this.bake('weapon_sword', 14, 46, (g) => {
      // blade
      g.fillStyle(Palette.weapon, 1).fillRect(5, 0, 4, 34);
      g.fillStyle(0xffffff, 0.7).fillRect(5, 0, 2, 34);
      // guard
      g.fillStyle(0xc9a23a, 1).fillRect(1, 32, 12, 4);
      // handle
      g.fillStyle(0x6a4a2a, 1).fillRect(5, 36, 4, 10);
      g.lineStyle(1, Palette.weaponEdge, 1).strokeRect(5, 0, 4, 34);
    });
  }

  // ---- Worn equipment layers (paper-doll, see Avatar / zmap) --------------

  private makeEquips(): void {
    // A worn leather cap that sits on top of the head (layer "capOverHair").
    this.bake('equip_cap', 30, 18, (g) => {
      g.fillStyle(0x6a4a2a, 1).fillEllipse(15, 13, 30, 9); // brim
      g.fillStyle(0x8a5a30, 1).fillRoundedRect(6, 1, 18, 12, 5); // dome
      g.fillStyle(0x5a3a20, 1).fillRect(6, 10, 18, 3); // band
      g.fillStyle(0xa6713e, 1).fillRect(9, 3, 5, 4); // highlight
    });

    // Worn clothing — same 28x32 frame as the body, layered over it at (0,4).
    // Shirt (top, vslot Ma) covers the upper torso only...
    this.bake('equip_shirt', 28, 32, (g) => {
      g.fillStyle(Palette.shirt, 1).fillRoundedRect(2, 0, 24, 20, 5);
      g.fillStyle(0x2f86e0, 1).fillRect(2, 14, 24, 4);
      g.fillStyle(0x9cd2ff, 0.5).fillRect(5, 2, 4, 14);
    });
    // ...pants (bottom, vslot Pn) cover the hips and legs...
    this.bake('equip_pants', 28, 32, (g) => {
      g.fillStyle(Palette.pants, 1).fillRect(4, 18, 20, 7);
      g.fillStyle(Palette.pants, 1).fillRect(6, 23, 7, 9).fillRect(15, 23, 7, 9);
      g.fillStyle(0x202b40, 1).fillRect(13, 20, 2, 12);
    });
    // ...and the overall (top, vslot Ma+Pn) is one piece that covers both, so
    // the slot-lock hides the separate pants while it's worn.
    this.bake('equip_overall', 28, 32, (g) => {
      g.fillStyle(0x2f8f5a, 1).fillRoundedRect(2, 0, 24, 28, 5);
      g.fillStyle(0x247048, 1).fillRect(2, 14, 24, 4);
      g.fillStyle(0x9be0b8, 0.5).fillRect(5, 2, 4, 24);
      g.fillStyle(0xf2e2c4, 1).fillRect(11, 1, 6, 4);
      g.fillStyle(0x2f8f5a, 1).fillRect(6, 26, 7, 6).fillRect(15, 26, 7, 6);
    });

    // Steel blade variant — swapped onto the arm when the Steel Blade is equipped.
    this.bake('weapon_sword_steel', 14, 46, (g) => {
      g.fillStyle(0xbcd0ff, 1).fillRect(5, 0, 4, 34);
      g.fillStyle(0xffffff, 0.8).fillRect(5, 0, 2, 34);
      g.fillStyle(0xc9a23a, 1).fillRect(1, 32, 12, 4);
      g.fillStyle(0x6a4a2a, 1).fillRect(5, 36, 4, 10);
      g.lineStyle(1, 0x88a0d0, 1).strokeRect(5, 0, 4, 34);
    });
  }

  // ---- Monsters ------------------------------------------------------------

  private makeMonsters(): void {
    // Green slime blob.
    this.bake('mob_slime_green', 46, 38, (g) => {
      g.fillStyle(Palette.monsterBody2, 1);
      g.fillEllipse(23, 24, 44, 26);
      g.slice(23, 24, 22, Phaser.Math.DegToRad(180), Phaser.Math.DegToRad(360), true);
      g.fillPath();
      g.fillStyle(0x7ee0a0, 0.6).fillEllipse(16, 16, 14, 9);
      g.fillStyle(0x14361f, 1).fillCircle(16, 22, 3).fillCircle(30, 22, 3);
      g.fillStyle(0xffffff, 1).fillCircle(15, 21, 1).fillCircle(29, 21, 1);
      g.fillStyle(0x14361f, 1).fillRect(18, 30, 10, 2);
    });

    // Violet mushroom.
    this.bake('mob_mush_violet', 52, 48, (g) => {
      // stem
      g.fillStyle(0xf2e2c4, 1).fillRoundedRect(16, 24, 20, 22, 5);
      g.fillStyle(0x202028, 1).fillRect(21, 32, 4, 6).fillRect(28, 32, 4, 6);
      g.fillStyle(0x202028, 1).fillRect(22, 40, 8, 2);
      // cap
      g.fillStyle(Palette.monsterBody, 1);
      g.slice(26, 24, 25, Phaser.Math.DegToRad(180), Phaser.Math.DegToRad(360), true);
      g.fillPath();
      g.fillStyle(0xd9a7f0, 1).fillCircle(15, 14, 5).fillCircle(34, 12, 6).fillCircle(26, 8, 4);
    });
  }

  // ---- NPC -----------------------------------------------------------------

  private makeNpc(): void {
    // A round merchant in an apron and a wide-brim hat (docs/phase5.md 階段六).
    this.bake('npc_shop', 44, 64, (g) => {
      // legs
      g.fillStyle(0x3a2f4f, 1).fillRect(13, 44, 8, 20).fillRect(23, 44, 8, 20);
      // robe / body
      g.fillStyle(0x8a4a2b, 1).fillRoundedRect(8, 24, 28, 24, 7);
      // apron
      g.fillStyle(0xd8b87a, 1).fillRect(16, 26, 12, 20);
      g.fillStyle(0x9a6a3e, 1).fillRect(16, 26, 12, 3);
      // arms
      g.fillStyle(0x8a4a2b, 1).fillRoundedRect(4, 26, 7, 16, 3).fillRoundedRect(33, 26, 7, 16, 3);
      g.fillStyle(Palette.skin, 1).fillCircle(7, 42, 3).fillCircle(37, 42, 3);
      // head
      g.fillStyle(Palette.skin, 1).fillCircle(22, 16, 11);
      // hat
      g.fillStyle(0x5a3a20, 1).fillEllipse(22, 9, 30, 9);
      g.fillStyle(0x6b4a2a, 1).fillRoundedRect(13, 1, 18, 9, 3);
      // eyes + smile
      g.fillStyle(0x202028, 1).fillRect(17, 15, 3, 3).fillRect(25, 15, 3, 3);
      g.lineStyle(2, 0x202028, 1);
      g.beginPath();
      g.arc(22, 18, 4, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160), false);
      g.strokePath();
      // white beard
      g.fillStyle(0xeef0f4, 1).fillEllipse(22, 24, 16, 7);
    });
  }

  // ---- Item / drop icons ---------------------------------------------------

  private makeDropIcons(): void {
    const ICON = 28;

    this.bake('icon_coin', ICON, ICON, (g) => {
      g.fillStyle(0xb8860b, 1).fillCircle(14, 14, 11);
      g.fillStyle(Palette.coin, 1).fillCircle(14, 14, 9);
      g.fillStyle(0xffe9a0, 1).fillCircle(11, 11, 3);
      g.lineStyle(2, 0x9a6f08, 1).strokeCircle(14, 14, 9);
    });

    this.potion('icon_potion_hp', Palette.potionHp);
    this.potion('icon_potion_mp', Palette.potionMp);

    this.bake('icon_etc', ICON, ICON, (g) => {
      g.fillStyle(0x55c47a, 1).fillCircle(14, 15, 9);
      g.fillStyle(0xa6f0c2, 0.7).fillCircle(11, 12, 3);
    });

    this.sword('icon_sword', Palette.weapon);
    this.sword('icon_sword2', 0xa9d0ff);

    this.bake('icon_hat', ICON, ICON, (g) => {
      g.fillStyle(0x7a5230, 1).fillEllipse(14, 20, 24, 8);
      g.fillStyle(0x9a6a3e, 1).fillRoundedRect(6, 6, 16, 12, 4);
      g.fillStyle(0x5a3a20, 1).fillRect(6, 15, 16, 3);
    });

    this.bake('icon_shirt', ICON, ICON, (g) => {
      g.fillStyle(Palette.shirt, 1).fillRoundedRect(5, 6, 18, 15, 4);
      g.fillStyle(0x2f86e0, 1).fillRect(5, 16, 18, 5);
      g.fillStyle(0x9cd2ff, 0.6).fillRect(8, 8, 3, 9);
    });
    this.bake('icon_pants', ICON, ICON, (g) => {
      g.fillStyle(Palette.pants, 1).fillRect(7, 6, 14, 16);
      g.fillStyle(0x202b40, 1).fillRect(13, 8, 2, 14);
    });
    this.bake('icon_overall', ICON, ICON, (g) => {
      g.fillStyle(0x2f8f5a, 1).fillRoundedRect(6, 4, 16, 20, 4);
      g.fillStyle(0xf2e2c4, 1).fillRect(11, 4, 6, 3);
      g.fillStyle(0x247048, 1).fillRect(6, 14, 16, 3);
    });
  }

  private potion(key: string, color: number): void {
    this.bake(key, 28, 28, (g) => {
      g.fillStyle(0x9aa3b2, 1).fillRect(11, 2, 6, 4);
      g.fillStyle(color, 1).fillRoundedRect(7, 6, 14, 18, 5);
      g.fillStyle(0xffffff, 0.4).fillRoundedRect(9, 8, 3, 10, 2);
    });
  }

  private sword(key: string, blade: number): void {
    this.bake(key, 28, 28, (g) => {
      g.fillStyle(blade, 1).fillRect(12, 2, 4, 16);
      g.fillStyle(0xc9a23a, 1).fillRect(8, 17, 12, 3);
      g.fillStyle(0x6a4a2a, 1).fillRect(12, 20, 4, 6);
    });
  }

  // ---- Skill icons ---------------------------------------------------------

  private makeSkillIcons(): void {
    this.skillIcon('skill_power_strike', 0xff7b3d, 0xffd0a0);
    this.skillIcon('skill_slash_blast', 0xff4d6d, 0xffc2cf);
    this.skillIcon('skill_iron_body', 0x6fae6f, 0xd6f0d6);
    this.skillIcon('skill_rage', 0xd64545, 0xffb0b0);
  }

  private skillIcon(key: string, base: number, accent: number): void {
    this.bake(key, 32, 32, (g) => {
      g.fillStyle(base, 1).fillRoundedRect(0, 0, 32, 32, 6);
      g.fillStyle(0x000000, 0.18).fillRoundedRect(0, 20, 32, 12, 6);
      g.fillStyle(accent, 1).fillTriangle(8, 24, 16, 6, 24, 24);
      g.lineStyle(2, 0xffffff, 0.5).strokeRoundedRect(1, 1, 30, 30, 6);
    });
  }

  // ---- Combat VFX ----------------------------------------------------------

  private makeVfx(): void {
    // Slash crescent for the basic attack.
    this.bake('vfx_slash', 72, 72, (g) => {
      g.fillStyle(0xffffff, 0.9);
      g.slice(20, 36, 34, Phaser.Math.DegToRad(-60), Phaser.Math.DegToRad(60), false);
      g.fillPath();
      g.fillStyle(0x16324f, 1);
      g.slice(14, 36, 30, Phaser.Math.DegToRad(-60), Phaser.Math.DegToRad(60), false);
      g.fillPath();
    });

    // Small star/spark for hits and skill flashes.
    this.bake('vfx_spark', 24, 24, (g) => {
      g.fillStyle(0xffffff, 1);
      g.fillTriangle(12, 0, 9, 12, 15, 12);
      g.fillTriangle(12, 24, 9, 12, 15, 12);
      g.fillTriangle(0, 12, 12, 9, 12, 15);
      g.fillTriangle(24, 12, 12, 9, 12, 15);
      g.fillStyle(0xffe45e, 1).fillCircle(12, 12, 4);
    });
  }
}
