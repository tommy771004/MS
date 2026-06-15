import Phaser from 'phaser';
import { Depth } from '../config';

/**
 * A stationary shopkeeper NPC (docs/phase5.md 階段六). It carries the `shopId`
 * its catalogue lives under and shows a floating prompt while the player is in
 * range. It has no physics body — proximity is a simple distance check in
 * GameScene — so the player walks freely past it.
 */
export class Npc extends Phaser.GameObjects.Sprite {
  readonly shopId: number;

  private readonly nameLabel: Phaser.GameObjects.Text;
  private readonly prompt: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, surfaceY: number, shopId: number, name: string) {
    super(scene, x, surfaceY, 'npc_shop');
    this.shopId = shopId;

    // Anchor the feet on the surface.
    this.setOrigin(0.5, 1).setDepth(Depth.Monster);
    scene.add.existing(this);

    const topY = surfaceY - this.height;
    this.nameLabel = scene.add
      .text(x, topY - 6, name, {
        fontFamily: 'Microsoft JhengHei, sans-serif',
        fontSize: '13px',
        color: '#ffe9a6',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 1)
      .setDepth(Depth.Monster + 1);

    this.prompt = scene.add
      .text(x, topY - 26, 'Z 對話', {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '12px',
        color: '#1b2230',
        backgroundColor: '#ffe45e',
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0.5, 1)
      .setDepth(Depth.Monster + 2)
      .setVisible(false);

    // Bob the prompt so it reads as an interactable cue.
    scene.tweens.add({
      targets: this.prompt,
      y: this.prompt.y - 5,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
  }

  setPromptVisible(visible: boolean): void {
    this.prompt.setVisible(visible);
  }

  destroy(fromScene?: boolean): void {
    this.nameLabel.destroy();
    this.prompt.destroy();
    super.destroy(fromScene);
  }
}
