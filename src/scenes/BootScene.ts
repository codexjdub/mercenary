import Phaser from 'phaser';
import { buildFont } from '../art/font';
import { buildTiles } from '../art/tiles';
import { buildBackgrounds } from '../art/backgrounds';
import { buildSprites } from '../art/sprites';
import { ensureGunTexture } from '../art/guns';
import { buildSfx } from '../audio/sfx';
import { buildCampArt } from '../art/camp';
import { PRESET_BUILDS } from '../data/gunParts';

/** Generates every asset procedurally, then hands off to the title screen. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    buildFont(this);
    buildTiles(this);
    buildBackgrounds(this);
    buildSprites(this);
    buildCampArt(this);
    for (const b of PRESET_BUILDS) ensureGunTexture(this, b);
    buildSfx(this);

    const params = new URLSearchParams(location.search);
    if (params.has('art')) this.scene.start('Art');
    else if (params.has('camp')) this.scene.start('Camp');
    else if (params.has('play')) {
      const i = Number(params.get('play')) || 0;
      this.scene.start('Game', { build: PRESET_BUILDS[i % PRESET_BUILDS.length] });
    } else this.scene.start('Title');
  }
}
