import Phaser from 'phaser';
import { GAME_H, GAME_W, GRAVITY } from './constants';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { BriefingScene } from './scenes/BriefingScene';
import { GameScene } from './scenes/GameScene';
import { HudScene } from './scenes/HudScene';
import { PauseScene } from './scenes/PauseScene';
import { ResultsScene } from './scenes/ResultsScene';
import { ArtScene } from './scenes/ArtScene';
import { CampScene } from './scenes/CampScene';
import { GunsmithScene } from './scenes/GunsmithScene';
import { MissionBoardScene } from './scenes/MissionBoardScene';
import { RecordsScene } from './scenes/RecordsScene';

/** Largest whole-number zoom that fits the window, for crisp pixels. */
const zoomFor = () => Math.max(1, Math.floor(Math.min(window.innerWidth / GAME_W, window.innerHeight / GAME_H)));

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#0e0b14',
  pixelArt: true,
  roundPixels: true,
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: GRAVITY }, debug: false, tileBias: 20 },
  },
  input: { gamepad: true },
  scale: { mode: Phaser.Scale.NONE, zoom: zoomFor(), autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, TitleScene, CampScene, GunsmithScene, MissionBoardScene, RecordsScene, BriefingScene, GameScene, HudScene, PauseScene, ResultsScene, ArtScene],
});

window.addEventListener('resize', () => game.scale.setZoom(zoomFor()));

// handy for debugging from the console
(window as unknown as { game: Phaser.Game }).game = game;
