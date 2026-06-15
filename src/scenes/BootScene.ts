import Phaser from 'phaser';
import { Scenes } from '../config';

/**
 * Minimal boot scene. In a larger project this is where you'd load a tiny
 * loading-bar asset; here we just hand off to the texture-generating preload.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(Scenes.Boot);
  }

  create(): void {
    this.scene.start(Scenes.Preload);
  }
}
