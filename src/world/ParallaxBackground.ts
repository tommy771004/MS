import Phaser from 'phaser';
import { GAME_WIDTH, Depth } from '../config';

interface Layer {
  sprite: Phaser.GameObjects.TileSprite;
  factor: number;
}

/**
 * Multi-layer parallax scrolling (design.md §2.2). Each layer is a screen-fixed
 * TileSprite whose tilePosition tracks the camera at a different weight, giving
 * a sense of depth: distant mountains creep, near trees rush by.
 */
export class ParallaxBackground {
  private readonly layers: Layer[] = [];

  constructor(scene: Phaser.Scene) {
    // Static sky fills the viewport.
    scene.add
      .image(0, 0, 'bg_sky')
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(Depth.ParallaxFar - 1);

    this.addLayer(scene, 'bg_mountains', 470, 220, 0.12, Depth.ParallaxFar);
    this.addLayer(scene, 'bg_hills', 520, 180, 0.32, Depth.ParallaxMid);
    this.addLayer(scene, 'bg_trees', 576, 150, 0.55, Depth.ParallaxNear);
  }

  private addLayer(scene: Phaser.Scene, key: string, bottomY: number, height: number, factor: number, depth: number): void {
    const sprite = scene.add
      .tileSprite(0, bottomY, GAME_WIDTH, height, key)
      .setOrigin(0, 1)
      .setScrollFactor(0)
      .setDepth(depth);
    this.layers.push({ sprite, factor });
  }

  update(camera: Phaser.Cameras.Scene2D.Camera): void {
    for (const layer of this.layers) {
      layer.sprite.tilePositionX = camera.scrollX * layer.factor;
    }
  }
}
