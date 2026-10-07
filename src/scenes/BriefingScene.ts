import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../constants';
import { Controls } from '../input/Controls';
import { P, hex } from '../art/palette';
import { text } from '../ui/text';
import { sfx } from '../audio/sfx';
import { BARRELS, GunBuild, MAGAZINES, RECEIVERS, SIGHTS, STOCKS, computeStats, moveSpeed } from '../data/gunParts';
import { commit, getSave } from '../data/save';
import { ensureGunTexture } from '../art/guns';
import { THORNBACK_MISSION } from '../levels/thornback';

/** Mission briefing + loadout pick. The loadout cards preview the part-based gun system. */
export class BriefingScene extends Phaser.Scene {
  private controls!: Controls;
  private sel = 0;
  private cards: Phaser.GameObjects.Container[] = [];
  private g!: Phaser.GameObjects.Graphics;
  private parts!: Phaser.GameObjects.BitmapText;
  private leaving = false;

  constructor() {
    super('Briefing');
  }

  create(): void {
    this.leaving = false;
    this.controls = new Controls(this);
    this.controls.swallow();
    this.sel = getSave().equipped;

    this.add.rectangle(0, 0, GAME_W, GAME_H, hex('#14101e')).setOrigin(0);
    // scanline stripes for a tactical-screen feel
    const stripes = this.add.graphics();
    stripes.fillStyle(hex('#1c1628'), 1);
    for (let y = 0; y < GAME_H; y += 4) stripes.fillRect(0, y, GAME_W, 2);

    const m = THORNBACK_MISSION;
    text(this, 12, 10, 'CONTRACT BRIEFING', { color: P.uiDim });
    text(this, 12, 22, m.name, { scale: 2, color: P.hazard });
    text(this, 12, 44, `AREA: ${m.area}    TIME LIMIT: 08:00`, { color: P.ui });
    m.brief.forEach((l, i) => text(this, 12, 60 + i * 10, l, { color: '#c8c0d8' }));
    text(this, 270, 60, 'OBJECTIVES', { color: P.uiDim });
    m.objectives.forEach((o, i) => text(this, 270, 72 + i * 11, `- ${o}${i === 0 ? ' (3)' : ''}`, { color: P.ui }));
    text(this, 270, 100, 'REWARD: MATERIALS FOR GUNSMITHING', { color: P.uiDim });

    text(this, 12, 128, 'SELECT LOADOUT', { color: P.uiDim });
    this.g = this.add.graphics();
    this.cards = getSave().loadouts.map((b, i) => this.makeCard(b, 12 + i * 156, 140, 'ABC'[i]));
    this.parts = text(this, 12, GAME_H - 26, '', { color: P.uiDim });
    text(this, GAME_W - 12, GAME_H - 12, '< >  CHOOSE   ENTER  DEPLOY   ESC  CAMP', { ox: 1, color: P.ui });

    this.refresh();
    this.cameras.main.fadeIn(300, 14, 11, 20);
  }

  private makeCard(b: GunBuild, x: number, y: number, letter: string): Phaser.GameObjects.Container {
    const s = computeStats(b);
    const art = ensureGunTexture(this, b, false);
    const c = this.add.container(x, y);
    c.add(text(this, 6, 5, `${letter}: ${b.name}`, { color: P.hazard }));
    c.add(text(this, 144, 5, s.mode === 'auto' ? 'AUTO' : 'SEMI', { ox: 1, color: P.uiDim }));
    c.add(this.add.image(74, 30, art.key).setScale(2));
    const stats: [string, number][] = [
      ['DMG', Math.min(1, (s.damage * s.pellets) / 60)],
      ['RATE', Math.min(1, s.rate / 15)],
      ['MAG', Math.min(1, s.capacity / 50)],
      ['RELOAD', 1 - Math.min(1, (s.reload - 1) / 1.5)],
      ['RANGE', Math.min(1, s.range / 360)],
      ['MOBILITY', Math.min(1, (moveSpeed(s) - 82) / 24)],
    ];
    stats.forEach(([label, v], i) => {
      c.add(text(this, 6, 52 + i * 9, label, { color: P.uiDim }));
      const bar = this.add.graphics();
      bar.fillStyle(hex(P.inkSoft), 1).fillRect(62, 53 + i * 9, 80, 5);
      bar.fillStyle(hex(P.hpGood), 1).fillRect(62, 53 + i * 9, Math.max(2, Math.round(80 * v)), 5);
      c.add(bar);
    });
    return c;
  }

  private refresh() {
    this.g.clear();
    this.cards.forEach((c, i) => {
      const on = i === this.sel;
      this.g.fillStyle(hex(on ? '#2a2238' : '#1a1424'), 1).fillRect(c.x, c.y, 150, 108);
      this.g.lineStyle(1, hex(on ? P.hazard : P.inkSoft), 1).strokeRect(c.x + 0.5, c.y + 0.5, 149, 107);
      c.setAlpha(on ? 1 : 0.6);
    });
    this.g.setDepth(-1);
    const b = getSave().loadouts[this.sel];
    this.parts.setText(
      `${RECEIVERS[b.receiver].name} + ${BARRELS[b.barrel].name} + ${MAGAZINES[b.magazine].name} + ${STOCKS[b.stock].name} + ${SIGHTS[b.sight].name}`,
    );
  }

  update(): void {
    const c = this.controls;
    c.update();
    if (this.leaving) return;
    if (c.justDown('left') || c.justDown('right')) {
      this.sel = (this.sel + (c.justDown('left') ? -1 : 1) + 3) % 3;
      sfx(this, 'ui_move');
      this.refresh();
    }
    if (c.justDown('back')) {
      this.scene.start('Camp');
      return;
    }
    if (c.justDown('confirm')) {
      this.leaving = true;
      sfx(this, 'ui_ok');
      const save = getSave();
      save.equipped = this.sel;
      commit();
      const build = save.loadouts[this.sel];
      this.registry.set('build', build);
      this.cameras.main.fadeOut(300, 14, 11, 20);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Game', { build }));
    }
  }
}
