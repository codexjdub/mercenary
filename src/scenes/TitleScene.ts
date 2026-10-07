import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../constants';
import { Controls } from '../input/Controls';
import { P, hex } from '../art/palette';
import { text } from '../ui/text';
import { sfx } from '../audio/sfx';
import { buildGroundStrip } from '../art/tiles';
import { ANCHORS } from '../art/sprites';
import { GunArt, attachGun, ensureGunTexture } from '../art/guns';
import { PRESET_BUILDS } from '../data/gunParts';

export class TitleScene extends Phaser.Scene {
  private controls!: Controls;
  private far!: Phaser.GameObjects.TileSprite;
  private mid!: Phaser.GameObjects.TileSprite;
  private near!: Phaser.GameObjects.TileSprite;
  private ground!: Phaser.GameObjects.TileSprite;
  private prompt!: Phaser.GameObjects.BitmapText;
  private rook!: Phaser.GameObjects.Sprite;
  private gun!: Phaser.GameObjects.Image;
  private gunArt!: GunArt;
  private leaving = false;

  constructor() {
    super('Title');
  }

  create(): void {
    this.leaving = false;
    this.controls = new Controls(this);
    this.controls.swallow();
    this.add.image(0, 0, 'bg_sky').setOrigin(0);
    this.far = this.add.tileSprite(0, 80, GAME_W, 160, 'bg_far').setOrigin(0);
    this.mid = this.add.tileSprite(0, 110, GAME_W, 200, 'bg_mid').setOrigin(0);
    this.near = this.add.tileSprite(0, 150, GAME_W, 220, 'bg_near').setOrigin(0);

    // a strip of ground tiles to run along
    buildGroundStrip(this, 'title_ground');
    this.ground = this.add.tileSprite(0, GAME_H - 46, GAME_W, 64, 'title_ground').setOrigin(0);

    this.rook = this.add.sprite(150, GAME_H - 46 - 16, 'rook').play('rook-run');
    this.gunArt = ensureGunTexture(this, PRESET_BUILDS[0]);
    this.gun = this.add.image(0, 0, this.gunArt.key);

    const grunt = this.add.sprite(370, GAME_H - 46 - 16, 'grunt').play('grunt-run').setFlipX(true);
    this.tweens.add({ targets: grunt, x: 400, yoyo: true, repeat: -1, duration: 1400, ease: 'Sine.easeInOut' });

    // title card
    const t1 = text(this, GAME_W / 2, 34, 'MERCENARY', { ox: 0.5, scale: 4, color: P.hazard });
    text(this, GAME_W / 2, 74, 'A CONTRACT RUN-AND-GUN', { ox: 0.5, color: P.ui });
    this.tweens.add({ targets: t1, y: 30, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.prompt = text(this, GAME_W / 2, 118, 'PRESS ENTER OR START', { ox: 0.5, color: P.ui });
    text(this, GAME_W - 6, GAME_H - 11, 'V0.1 VERTICAL SLICE', { ox: 1, color: P.uiDim });

    this.cameras.main.fadeIn(500, 14, 11, 20);
  }

  update(time: number, delta: number): void {
    const c = this.controls;
    c.update();
    const dx = delta * 0.06;
    this.far.tilePositionX += dx * 0.1;
    this.mid.tilePositionX += dx * 0.25;
    this.near.tilePositionX += dx * 0.5;
    this.ground.tilePositionX += dx * 1.8;
    const anchor = ANCHORS['rook'][Number(this.rook.frame.name)] ?? { x: 19, y: 17 };
    attachGun(this.gun, this.gunArt, Math.round(this.rook.x) - 16, Math.round(this.rook.y) - 16, anchor, true);
    this.prompt.setVisible(Math.floor(time / 500) % 2 === 0);
    this.prompt.setTint(hex(P.ui));

    if (!this.leaving && (c.justDown('confirm') || c.justDown('pause'))) {
      this.leaving = true;
      sfx(this, 'ui_ok');
      this.cameras.main.fadeOut(300, 14, 11, 20);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Camp'));
    }
  }
}
