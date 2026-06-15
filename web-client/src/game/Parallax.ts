import { Container, TilingSprite } from 'pixi.js';
import { VIEW } from '../constants';
import type { TextureSet } from './textures';

/**
 * Multi-layer parallax using TilingSprites. Each layer scrolls its tilePosition
 * at a fraction of the camera, giving depth (distant hills creep, near trees
 * rush). Lives in screen space (added straight to the stage), not the world
 * container, so the tiling does the scrolling.
 */
export class Parallax extends Container {
  private readonly layers: { sprite: TilingSprite; factor: number }[] = [];

  constructor(tex: TextureSet) {
    super();
    this.addLayer(tex, 'hills', 0.3);
    this.addLayer(tex, 'trees', 0.55);
  }

  private addLayer(tex: TextureSet, key: string, factor: number): void {
    const texture = tex[key];
    // Match the layer height to the texture so it only tiles horizontally.
    const height = texture.height;
    const sprite = new TilingSprite({ texture, width: VIEW.width, height });
    sprite.y = VIEW.height - height;
    this.addChild(sprite);
    this.layers.push({ sprite, factor });
  }

  update(cameraX: number): void {
    for (const layer of this.layers) layer.sprite.tilePosition.x = -cameraX * layer.factor;
  }
}
