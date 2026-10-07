import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../constants';
import { Controls } from '../input/Controls';
import { P, hex } from '../art/palette';
import { fmtTime, text } from '../ui/text';
import { MATERIALS, MAT_NAME, panel } from '../ui/panel';
import { sfx } from '../audio/sfx';
import { getSave, resetSave } from '../data/save';
import { CATALOG, SLOTS } from '../data/gunParts';
import { THORNBACK_MISSION } from '../levels/thornback';

/** Career stats from the camp radio table, plus a save wipe. */
export class RecordsScene extends Phaser.Scene {
  private c!: Controls;
  private confirmT = 0;
  private wipe!: Phaser.GameObjects.BitmapText;
  private rKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super('Records');
  }

  create(): void {
    this.c = new Controls(this);
    this.c.swallow();
    this.confirmT = 0;
    this.add.rectangle(0, 0, GAME_W, GAME_H, hex(P.black), 0.85).setOrigin(0);
    const g = this.add.graphics();
    panel(g, 40, 24, 400, 214, true);
    text(this, GAME_W / 2, 32, 'COMMS & RECORDS', { ox: 0.5, color: P.hazard });

    const s = getSave();
    const totalParts = SLOTS.reduce((n, sl) => n + Object.keys(CATALOG[sl]).length, 0);
    const rows: [string, string][] = [
      ['CONTRACTS RUN', String(s.career.runs)],
      ['CONTRACTS CLEARED', String(s.career.clears)],
      ['HOSTILES DOWN', String(s.career.kills)],
      ['PARTS OWNED', `${s.owned.length}/${totalParts}`],
    ];
    rows.forEach(([k, v], i) => {
      text(this, 58, 52 + i * 12, k, { color: P.uiDim });
      text(this, 228, 52 + i * 12, v, { ox: 1 });
    });

    text(this, 252, 52, 'LIFETIME HAUL', { color: P.uiDim });
    MATERIALS.forEach((m, i) => {
      this.add.image(258, 68 + i * 14, `pk_${m}`);
      text(this, 270, 64 + i * 14, `${MAT_NAME[m]}  ${s.career.banked[m]}`);
    });

    text(this, 58, 112, 'MISSION LOG', { color: P.uiDim });
    const rec = s.missions[THORNBACK_MISSION.id];
    text(this, 58, 126, THORNBACK_MISSION.name);
    text(this, 58, 138, rec ? `BEST RANK ${rec.bestRank ?? '-'}   BEST TIME ${rec.bestTime !== null ? fmtTime(rec.bestTime) : '--:--'}   CLEARS ${rec.clears}/${rec.runs}` : 'NO RUNS LOGGED YET', { color: '#c8c0d8' });

    text(this, 58, 162, 'RADIO CHATTER', { color: P.uiDim });
    const chatter = s.career.clears > 0 ? 'HEXCORP IS SCRAMBLING. MORE CONTRACTS SOON.' : 'HEXCORP HOLDS THORNBACK RIDGE. GO GET THEM.';
    text(this, 58, 174, chatter, { color: P.hpGood });

    this.wipe = text(this, GAME_W / 2, 206, '', { ox: 0.5, color: P.uiDim });
    text(this, GAME_W / 2, 224, 'ESC BACK   HOLD R FOR 2S TO WIPE SAVE', { ox: 0.5, color: P.uiDim });
    this.rKey = this.input.keyboard!.addKey('R');
  }

  update(_t: number, delta: number): void {
    const c = this.c;
    c.update();
    if (c.justDown('back')) {
      this.scene.resume('Camp');
      this.scene.stop();
      return;
    }
    if (this.rKey.isDown) {
      this.confirmT += delta / 1000;
      this.wipe.setText(`WIPING SAVE... ${Math.min(100, Math.round((this.confirmT / 2) * 100))}%`).setTint(hex(P.hpLow));
      if (this.confirmT >= 2) {
        resetSave();
        sfx(this, 'fail');
        this.scene.stop('Camp');
        this.scene.start('Title');
      }
    } else if (this.confirmT > 0) {
      this.confirmT = 0;
      this.wipe.setText('');
    }
  }
}
