import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../constants';
import { Controls } from '../input/Controls';
import { P, hex } from '../art/palette';
import { fmtTime, text } from '../ui/text';
import { sfx } from '../audio/sfx';
import { MissionResult, rankFor } from '../game/Mission';
import type { GunBuild } from '../data/gunParts';
import { bankResult, getSave } from '../data/save';
import { THORNBACK_MISSION } from '../levels/thornback';

const OPTIONS = ['RETURN TO CAMP', 'RETRY MISSION'];

export class ResultsScene extends Phaser.Scene {
  private controls!: Controls;
  private sel = 0;
  private items: Phaser.GameObjects.BitmapText[] = [];
  private build!: GunBuild;
  private ready = false;

  constructor() {
    super('Results');
  }

  create(data: { result: MissionResult; build: GunBuild }): void {
    const r = data.result;
    this.build = data.build;
    this.sel = 0;
    this.ready = false;
    this.controls = new Controls(this);
    this.controls.swallow();

    this.add.rectangle(0, 0, GAME_W, GAME_H, hex('#14101e')).setOrigin(0);
    text(this, GAME_W / 2, 14, r.success ? 'MISSION COMPLETE' : 'MISSION FAILED', { ox: 0.5, scale: 2, color: r.success ? P.hpGood : P.hpLow });
    text(this, GAME_W / 2, 36, r.reason, { ox: 0.5, color: P.uiDim });

    const acc = r.shots ? Math.round((r.hits / r.shots) * 100) : 0;
    const rows: [string, string][] = [
      ['TIME', fmtTime(r.time)],
      ['ENGINEERS RESCUED', `${r.hostages}/${r.hostagesTotal}`],
      ['FOREMAN', r.bossDown ? 'DESTROYED' : 'ACTIVE'],
      ['HOSTILES DOWN', String(r.kills)],
      ['ACCURACY', `${acc}%`],
      ['PERFECT RELOADS', String(r.perfect)],
      ['JAMS', String(r.jams)],
      ['DAMAGE TAKEN', String(r.damageTaken)],
      ['LIVES LOST', String(r.deaths)],
      ['LOADOUT', r.build],
    ];
    rows.forEach(([k, v], i) => {
      const y = 56 + i * 12;
      const a = text(this, 40, y, k, { color: P.uiDim }).setAlpha(0);
      const b = text(this, 250, y, v, { ox: 1 }).setAlpha(0);
      this.tweens.add({ targets: [a, b], alpha: 1, delay: 150 + i * 90, duration: 120, onStart: () => sfx(this, 'ui_move', { volume: 0.4 }) });
    });

    // bank the haul into the save (failed runs salvage half)
    const receipt = bankResult(THORNBACK_MISSION.id, r);
    const totals = getSave().materials;
    text(this, 290, 56, receipt.salvage ? 'SALVAGED (50%)' : 'MATERIALS BANKED', { color: receipt.salvage ? P.hpLow : P.uiDim });
    (['scrap', 'wire', 'alloy'] as const).forEach((k, i) => {
      this.add.image(296, 72 + i * 16, `pk_${k}`);
      const t = text(this, 308, 68 + i * 16, `+${receipt.banked[k]}`, { color: receipt.banked[k] ? P.hpGood : P.uiDim });
      text(this, 340, 68 + i * 16, `TOTAL ${totals[k]}`, { color: P.uiDim });
      t.setAlpha(0);
      this.tweens.add({ targets: t, alpha: 1, delay: 900 + i * 120, duration: 100, onStart: () => receipt.banked[k] && sfx(this, 'pickup', { volume: 0.5 }) });
    });

    const rank = rankFor(r);
    text(this, 380, 126, 'RANK', { ox: 0.5, color: P.uiDim });
    if (receipt.newBestRank || receipt.newBestTime) {
      const nb = text(this, 380, 186, receipt.newBestRank ? 'NEW BEST RANK!' : 'NEW BEST TIME!', { ox: 0.5, color: P.hazard }).setAlpha(0);
      this.tweens.add({ targets: nb, alpha: 1, delay: 1500, duration: 100, yoyo: true, repeat: -1, hold: 500 });
    }
    const rt = text(this, 380, 156, rank, { ox: 0.5, oy: 0.5, scale: 5, color: rank === 'S' ? P.hazard : rank === 'A' ? P.hpGood : P.ui }).setScale(0);
    this.tweens.add({
      targets: rt,
      scale: 5,
      delay: 1200,
      duration: 300,
      ease: 'Back.easeOut',
      onStart: () => sfx(this, r.success ? 'perfect' : 'jam'),
      onComplete: () => (this.ready = true),
    });

    this.items = OPTIONS.map((o, i) => text(this, GAME_W / 2, 210 + i * 13, o, { ox: 0.5 }));
    this.refresh();
    this.cameras.main.fadeIn(400, 14, 11, 20);
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
    if (!this.ready) {
      if (c.justDown('confirm')) this.ready = true;
      return;
    }
    if (c.justDown('confirm')) {
      sfx(this, 'ui_ok');
      if (this.sel === 0) this.scene.start('Camp');
      else this.scene.start('Game', { build: this.build });
    }
  }
}
