import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../constants';
import { Controls } from '../input/Controls';
import { P, hex } from '../art/palette';
import { fmtTime, text } from '../ui/text';
import { panel } from '../ui/panel';
import { sfx } from '../audio/sfx';
import { getSave } from '../data/save';
import { THORNBACK_MISSION } from '../levels/thornback';

interface Contract {
  id: string;
  name: string;
  area: string;
  summary: string;
  available: boolean;
}

const CONTRACTS: Contract[] = [
  { id: THORNBACK_MISSION.id, name: THORNBACK_MISSION.name, area: THORNBACK_MISSION.area, summary: 'RESCUE 3 ENGINEERS. DESTROY THE FOREMAN.', available: true },
  { id: 'deepwell', name: 'OPERATION DEEP WELL', area: 'SALTPAN REFINERY', summary: 'INTEL PENDING.', available: false },
  { id: 'irontide', name: 'OPERATION IRON TIDE', area: 'GREYWATER DOCKS', summary: 'INTEL PENDING.', available: false },
];

/** Contract selection. Accepting a contract leaves camp for the briefing. */
export class MissionBoardScene extends Phaser.Scene {
  private c!: Controls;
  private sel = 0;
  private g!: Phaser.GameObjects.Graphics;
  private rows: { name: Phaser.GameObjects.BitmapText; sub: Phaser.GameObjects.BitmapText; rec: Phaser.GameObjects.BitmapText }[] = [];
  private leaving = false;

  constructor() {
    super('Board');
  }

  create(): void {
    this.c = new Controls(this);
    this.c.swallow();
    this.sel = 0;
    this.rows = [];
    this.leaving = false;
    this.add.rectangle(0, 0, GAME_W, GAME_H, hex(P.black), 0.85).setOrigin(0);
    const frame = this.add.graphics();
    panel(frame, 40, 24, 400, 214, true);
    this.g = this.add.graphics();
    text(this, GAME_W / 2, 32, 'CONTRACT BOARD', { ox: 0.5, color: P.hazard });

    const save = getSave();
    CONTRACTS.forEach((ct, i) => {
      const y = 54 + i * 54;
      const rec = save.missions[ct.id];
      const recText = ct.available
        ? rec
          ? `RUNS ${rec.runs}  CLEARS ${rec.clears}  BEST ${rec.bestRank ?? '-'}  ${rec.bestTime !== null ? fmtTime(rec.bestTime) : '--:--'}`
          : 'NEW CONTRACT'
        : 'LOCKED';
      text(this, 428, y, ct.area, { ox: 1, color: P.uiDim });
      this.rows.push({
        name: text(this, 58, y, ct.name),
        sub: text(this, 58, y + 12, ct.summary, { color: ct.available ? '#c8c0d8' : P.uiDim }),
        rec: text(this, 58, y + 26, recText, { color: ct.available ? (rec?.clears ? P.hpGood : P.uiDim) : P.uiDim }),
      });
    });
    text(this, GAME_W / 2, 224, 'UP/DOWN SELECT   ENTER ACCEPT   ESC BACK', { ox: 0.5, color: P.uiDim });
    this.draw();
  }

  private draw() {
    this.g.clear();
    this.g.fillStyle(hex('#2a2238'), 1).fillRect(46, 50 + this.sel * 54, 388, 44);
    this.g.fillStyle(hex(P.hazard), 1).fillRect(46, 50 + this.sel * 54, 2, 44);
    this.rows.forEach((r, i) => {
      const ct = CONTRACTS[i];
      r.name.setTint(hex(!ct.available ? P.uiDim : i === this.sel ? P.hazard : P.ui));
    });
  }

  update(): void {
    const c = this.c;
    c.update();
    if (this.leaving) return;
    if (c.justDown('up') || c.justDown('down')) {
      this.sel = (this.sel + (c.justDown('up') ? -1 : 1) + CONTRACTS.length) % CONTRACTS.length;
      sfx(this, 'ui_move');
      this.draw();
    }
    if (c.justDown('back')) {
      this.scene.resume('Camp');
      this.scene.stop();
      return;
    }
    if (c.justDown('confirm')) {
      const ct = CONTRACTS[this.sel];
      if (!ct.available) {
        sfx(this, 'dry');
        return;
      }
      this.leaving = true;
      sfx(this, 'ui_ok');
      this.cameras.main.fadeOut(300, 14, 11, 20);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.stop('Camp');
        this.scene.start('Briefing', { missionId: ct.id });
      });
    }
  }
}
