import { Graphics, type Renderer, type Texture } from 'pixi.js';
import { COLORS, VIEW } from '../constants';

/**
 * Generates all placeholder textures at runtime via PIXI.Graphics → Texture
 * (no copyrighted assets). Sprites built from these batch-render efficiently —
 * one of the reasons to use PixiJS over raw Canvas for a MapleStory-scale scene.
 */
export type TextureSet = Record<string, Texture>;

export function buildTextures(renderer: Renderer): TextureSet {
  const out: TextureSet = {};
  const bake = (key: string, draw: (g: Graphics) => void): void => {
    const g = new Graphics();
    draw(g);
    out[key] = renderer.generateTexture(g);
    g.destroy();
  };

  // ---- Paper-doll parts (anchored bottom-center when placed) ----
  bake('pants', (g) => {
    g.roundRect(0, 0, 22, 20, 4).fill(COLORS.pants);
    g.rect(10, 0, 2, 20).fill({ color: 0x1d2840 });
  });
  bake('coat', (g) => {
    g.roundRect(0, 0, 28, 26, 6).fill(COLORS.coat);
    g.rect(0, 18, 28, 5).fill({ color: 0x2f86e0 });
  });
  bake('head', (g) => {
    g.circle(14, 14, 13).fill(COLORS.skin);
    g.rect(8, 13, 3, 4).fill({ color: 0x202028 });
    g.rect(17, 13, 3, 4).fill({ color: 0x202028 });
    g.circle(7, 18, 2).fill({ color: 0xff9e9e, alpha: 0.6 });
    g.circle(21, 18, 2).fill({ color: 0xff9e9e, alpha: 0.6 });
  });
  bake('hair', (g) => {
    g.roundRect(0, 0, 30, 14, 6).fill(COLORS.hair);
    g.rect(0, 8, 5, 12).fill(COLORS.hair);
    g.rect(25, 8, 5, 12).fill(COLORS.hair);
  });
  bake('arm', (g) => {
    g.roundRect(0, 0, 8, 10, 3).fill(COLORS.coat);
    g.roundRect(0, 8, 8, 14, 3).fill(COLORS.skin);
  });
  bake('weapon', (g) => {
    g.rect(4, 0, 4, 30).fill(COLORS.weapon);
    g.rect(1, 28, 10, 4).fill({ color: 0xc9a23a });
    g.rect(4, 32, 4, 8).fill({ color: 0x6a4a2a });
  });

  // ---- Monsters ----
  bake('slime', (g) => {
    g.ellipse(22, 20, 21, 15).fill(COLORS.monster2);
    g.ellipse(15, 14, 6, 4).fill({ color: 0x7ee0a0, alpha: 0.6 });
    g.circle(15, 20, 3).fill({ color: 0x14361f });
    g.circle(29, 20, 3).fill({ color: 0x14361f });
  });
  bake('mushroom', (g) => {
    g.roundRect(12, 18, 20, 20, 5).fill({ color: 0xf2e2c4 });
    g.rect(17, 26, 4, 6).fill({ color: 0x202028 });
    g.rect(24, 26, 4, 6).fill({ color: 0x202028 });
    g.ellipse(22, 16, 20, 13).fill(COLORS.monster);
    g.circle(13, 12, 4).fill({ color: 0xd9a7f0 });
    g.circle(30, 11, 5).fill({ color: 0xd9a7f0 });
  });

  // ---- Terrain tile (batched along footholds) ----
  bake('tile', (g) => {
    g.rect(0, 0, 40, 40).fill(COLORS.dirt);
    g.rect(0, 0, 40, 8).fill(COLORS.grassTop);
    g.rect(0, 7, 40, 3).fill({ color: 0x2f7d3a });
  });

  // ---- Parallax layers (used as TilingSprites) ----
  bake('hills', (g) => ridge(g, VIEW.width, 200, 0x2f5d3a, 6, 60, 170));
  bake('trees', (g) => ridge(g, VIEW.width, 160, 0x1d3a26, 12, 30, 130));

  return out;
}

/** Jagged silhouette that roughly tiles horizontally. */
function ridge(g: Graphics, width: number, height: number, color: number, peaks: number, minP: number, maxP: number): void {
  const step = width / peaks;
  const pts: number[] = [0, height];
  for (let i = 0; i <= peaks; i++) {
    const x = i * step;
    const h = i === 0 || i === peaks ? minP + 18 : minP + Math.random() * (maxP - minP);
    pts.push(x - step / 2, height - h * 0.6, x, height - h);
  }
  pts.push(width, height);
  g.poly(pts).fill(color);
}
