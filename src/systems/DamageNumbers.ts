import Phaser from 'phaser';
import { Depth, Palette } from '../config';

/**
 * Object-pooled floating damage numbers (design.md §2.3). Reusing a fixed set
 * of Text objects avoids the GC churn of Instantiate/Destroy on every hit.
 */
export class DamageNumbers {
  private readonly pool: Phaser.GameObjects.Text[] = [];
  private readonly active: Phaser.GameObjects.Text[] = [];

  constructor(private readonly scene: Phaser.Scene, prewarm = 32) {
    for (let i = 0; i < prewarm; i++) this.pool.push(this.create());
  }

  private create(): Phaser.GameObjects.Text {
    const t = this.scene.add
      .text(0, 0, '', {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '22px',
        color: '#ffffff',
        stroke: '#3a1500',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 1)
      .setDepth(Depth.DamageNumber)
      .setActive(false)
      .setVisible(false);
    return t;
  }

  /**
   * Pop a damage number above (x, y). Crits are larger and orange; the digits
   * "scatter" upward like MapleStory by spawning each call slightly offset.
   */
  pop(x: number, y: number, amount: number, opts: { crit?: boolean; color?: number } = {}): void {
    const t = this.pool.pop() ?? this.create();
    this.active.push(t);

    const crit = !!opts.crit;
    const color = opts.color ?? (crit ? Palette.damageCrit : Palette.damagePlayer);

    t.setText(crit ? `${amount}!` : `${amount}`)
      .setColor(Phaser.Display.Color.IntegerToColor(color).rgba)
      .setFontSize(crit ? 30 : 22)
      .setOrigin(0.5, 1)
      .setActive(true)
      .setVisible(true)
      .setAlpha(1)
      .setScale(0.4);
    t.setPosition(x + Phaser.Math.Between(-8, 8), y);

    // Pop in, drift up, fade out — then recycle.
    this.scene.tweens.add({
      targets: t,
      scale: crit ? 1.25 : 1,
      duration: 120,
      ease: 'Back.out',
    });
    this.scene.tweens.add({
      targets: t,
      y: y - Phaser.Math.Between(46, 64),
      alpha: 0,
      duration: 700,
      delay: 160,
      ease: 'Quad.in',
      onComplete: () => this.recycle(t),
    });
  }

  private recycle(t: Phaser.GameObjects.Text): void {
    const idx = this.active.indexOf(t);
    if (idx !== -1) this.active.splice(idx, 1);
    t.setActive(false).setVisible(false);
    this.pool.push(t);
  }
}
