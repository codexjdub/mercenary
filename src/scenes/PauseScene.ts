import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../constants';
import { Controls } from '../input/Controls';
import { P, hex } from '../art/palette';
import { text } from '../ui/text';
import { sfx } from '../audio/sfx';

const OPTIONS = ['RESUME', 'RESTART MISSION', 'ABORT TO CAMP'];

export class PauseScene extends Phaser.Scene {
  private controls!: Controls;
  private sel = 0;
  private items: Phaser.GameObjects.BitmapText[] = [];

  constructor() {
    super('Pause');
  }

  create(): void {
    this.sel = 0;
    this.controls = new Controls(this);
    this.controls.swallow();
    this.add.rectangle(0, 0, GAME_W, GAME_H, hex(P.black), 0.7).setOrigin(0);
    text(this, GAME_W / 2, 50, 'PAUSED', { ox: 0.5, scale: 2, color: P.hazard });
    this.items = OPTIONS.map((o, i) => text(this, GAME_W / 2, 92 + i * 16, o, { ox: 0.5 }));
    const help = [
      'MOVE  ARROWS / WASD',
      'JUMP  Z / SPACE / K      FIRE  X / J',
      'RELOAD  C / L   (TAP AGAIN IN THE GREEN ZONE)',
      'KNIFE  V / I   (SLASHES BULLETS)   RATION  Q / H',
      'AIM UP  HOLD UP     AIM DOWN  HOLD DOWN IN AIR',
      'DROP THROUGH  DOWN + JUMP',
    ];
    help.forEach((h, i) => text(this, GAME_W / 2, 160 + i * 12, h, { ox: 0.5, color: P.uiDim }));
    this.refresh();
  }

  private refresh() {
    this.items.forEach((t, i) => {
      t.setTint(hex(i === this.sel ? P.hazard : P.ui));
      t.setText((i === this.sel ? '> ' : '') + OPTIONS[i] + (i === this.sel ? ' <' : ''));
    });
  }

  update(): void {
    const c = this.controls;
    c.update();
    if (c.justDown('up') || c.justDown('down')) {
      this.sel = (this.sel + (c.justDown('up') ? -1 : 1) + OPTIONS.length) % OPTIONS.length;
      sfx(this, 'ui_move');
      this.refresh();
    }
    if (c.justDown('back') && !c.justDown('confirm')) return this.resume();
    if (c.justDown('confirm') || c.justDown('fire')) {
      sfx(this, 'ui_ok');
      if (this.sel === 0) this.resume();
      else if (this.sel === 1) {
        this.scene.stop('Hud');
        this.scene.stop();
        this.scene.start('Game');
      } else {
        this.scene.stop('Hud');
        this.scene.stop('Game');
        this.scene.start('Camp');
      }
    }
  }

  private resume() {
    this.scene.resume('Game');
    this.scene.resume('Hud');
    const game = this.scene.get('Game') as Phaser.Scene & { controls?: Controls };
    game.controls?.swallow();
    this.scene.stop();
  }
}
