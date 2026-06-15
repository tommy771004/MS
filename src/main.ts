import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, Scenes } from './config';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game',
  backgroundColor: '#1b2733',
  pixelArt: true,
  roundPixels: true,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 }, // per-body gravity set on the player instead
      debug: false,
    },
  },
  scene: [BootScene, PreloadScene, GameScene, UIScene],
};

// eslint-disable-next-line no-new
new Phaser.Game(config);

// Expose scene keys for quick debugging in the browser console.
(window as unknown as { Scenes: typeof Scenes }).Scenes = Scenes;
