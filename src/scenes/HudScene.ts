import Phaser from 'phaser';
import type { GameScene } from './GameScene';
import { GAME_H, GAME_W, PLAYER } from '../constants';
import { P, hex } from '../art/palette';
import { fmtTime, text } from '../ui/text';
import { THORNBACK_MISSION } from '../levels/thornback';

/** Heads-up display, rendered in its own scene on top of the game. */
export class HudScene extends Phaser.Scene {
  private gs!: GameScene;
  private g!: Phaser.GameObjects.Graphics;
  private lives!: Phaser.GameObjects.BitmapText;
  private rations!: Phaser.GameObjects.BitmapText;
  private ammo!: Phaser.GameObjects.BitmapText;
  private gunName!: Phaser.GameObjects.BitmapText;
  private timer!: Phaser.GameObjects.BitmapText;
  private obj: { box: Phaser.GameObjects.Image; label: Phaser.GameObjects.BitmapText }[] = [];
  private mats!: Phaser.GameObjects.BitmapText[];
  private bossLabel!: Phaser.GameObjects.BitmapText;
  private bannerText: Phaser.GameObjects.BitmapText | null = null;
  private bannerQueue: { msg: string; color: string; big: boolean }[] = [];
  private bannerBusy = false;
  private bossShown = 0;

  constructor() {
    super('Hud');
  }

  create(): void {
    this.gs = this.scene.get('Game') as GameScene;
    this.bannerQueue = [];
    this.bannerBusy = false;
    this.bannerText = null;
    this.bossShown = 0;
    this.g = this.add.graphics();

    // top-left: lives, health, rations, weapon
    this.add.image(8, 6, 'i_life').setOrigin(0);
    this.lives = text(this, 21, 8, 'x3');
    this.add.image(8, 29, 'pk_ration').setOrigin(0);
    this.rations = text(this, 21, 31, 'x2');
    this.gunName = text(this, 44, 31, '', { color: P.uiDim });
    this.ammo = text(this, 8, 44, '');

    // top-center: timer
    this.timer = text(this, GAME_W / 2, 6, '08:00', { ox: 0.5, scale: 2 });

    // top-right: objectives
    this.obj = THORNBACK_MISSION.objectives.map((o, i) => ({
      box: this.add.image(GAME_W - 8, 7 + i * 12, 'i_check', 0).setOrigin(1, 0),
      label: text(this, GAME_W - 20, 8 + i * 12, o, { ox: 1 }),
    }));

    // bottom-left: materials
    const matKeys = ['pk_scrap', 'pk_wire', 'pk_alloy'];
    this.mats = matKeys.map((k, i) => {
      this.add.image(8 + i * 36, GAME_H - 8, k).setOrigin(0, 1);
      return text(this, 21 + i * 36, GAME_H - 15, '0');
    });

    this.bossLabel = text(this, GAME_W / 2, GAME_H - 26, 'THE FOREMAN', { ox: 0.5, color: P.hpLow }).setVisible(false);

    this.gs.events.on('banner', this.onBanner, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.gs.events.off('banner', this.onBanner, this));
  }

  private onBanner(msg: string, color: string, big: boolean) {
    this.bannerQueue.push({ msg, color, big });
    if (!this.bannerBusy) this.nextBanner();
  }

  private nextBanner() {
    const b = this.bannerQueue.shift();
    if (!b) {
      this.bannerBusy = false;
      return;
    }
    this.bannerBusy = true;
    this.bannerText?.destroy();
    const y = b.big ? 92 : 104;
    const t = text(this, GAME_W / 2, y, b.msg, { ox: 0.5, oy: 0.5, color: b.color, scale: b.big ? 2 : 1 });
    this.bannerText = t;
    t.setScale(t.scaleX, 0);
    this.tweens.add({ targets: t, scaleY: b.big ? 2 : 1, duration: 140, ease: 'Back.easeOut' });
    this.time.delayedCall(b.big ? 1700 : 1400, () => {
      this.tweens.add({
        targets: t,
        alpha: 0,
        duration: 200,
        onComplete: () => {
          t.destroy();
          if (this.bannerText === t) this.bannerText = null;
          this.nextBanner();
        },
      });
    });
  }

  update(): void {
    const gs = this.gs;
    if (!gs.player || !gs.mission) return;
    const p = gs.player;
    const w = p.weapon;
    const g = this.g;
    g.clear();

    // health bar (segmented)
    const segs = 20;
    const hpFrac = Math.max(0, p.hp) / PLAYER.maxHp;
    const col = hpFrac > 0.5 ? P.hpGood : hpFrac > 0.25 ? P.hpMid : P.hpLow;
    g.fillStyle(hex(P.ink), 1).fillRect(7, 19, segs * 4 + 3, 8);
    for (let i = 0; i < segs; i++) {
      const on = i < Math.ceil(hpFrac * segs);
      g.fillStyle(on ? hex(col) : hex(P.inkSoft), 1).fillRect(9 + i * 4, 21, 3, 4);
    }

    this.lives.setText(`x${Math.max(0, p.lives)}`);
    this.rations.setText(`x${p.rations}`);
    this.gunName.setText(p.build.name);

    // ammo pips
    const cap = w.stats.capacity;
    const label = w.state === 'jam' ? 'JAMMED!' : w.state === 'reload' ? 'RELOAD' : `${w.ammo}/${cap}`;
    this.ammo.setText(label).setTint(hex(w.state === 'jam' ? P.hpLow : w.state === 'reload' ? P.hazard : w.perfectMag ? P.hazard : P.ui));
    const pipW = cap > 30 ? 1 : 2;
    const perRow = cap > 30 ? 50 : 24;
    for (let i = 0; i < cap; i++) {
      const x = 8 + (i % perRow) * (pipW + 1);
      const y = 56 + Math.floor(i / perRow) * 5;
      const on = w.state === 'ready' && i < w.ammo;
      g.fillStyle(on ? hex(w.perfectMag ? P.hazard : P.brass) : hex(P.inkSoft), 1).fillRect(x, y, pipW, 4);
    }

    // timer
    const tl = gs.mission.timeLeft;
    this.timer.setText(fmtTime(tl));
    this.timer.setTint(hex(tl < 60 ? (Math.floor(tl * 2) % 2 ? P.hpLow : P.ui) : P.ui));

    // objectives
    const m = gs.mission;
    const done = [m.hostages >= m.hostagesTotal, m.bossDown];
    this.obj[0].label.setText(`${THORNBACK_MISSION.objectives[0]} ${m.hostages}/${m.hostagesTotal}`);
    this.obj.forEach((o, i) => {
      o.box.setFrame(done[i] ? 1 : 0);
      o.label.setTint(hex(done[i] ? P.hpGood : P.ui));
    });

    this.mats[0].setText(String(m.materials.scrap));
    this.mats[1].setText(String(m.materials.wire));
    this.mats[2].setText(String(m.materials.alloy));

    // boss bar
    const boss = gs.boss;
    if (gs.bossActive && boss && !boss.dead) {
      this.bossShown = Math.min(1, this.bossShown + 0.03);
      const bw = Math.round(200 * this.bossShown);
      const x = GAME_W / 2 - 100;
      const y = GAME_H - 16;
      this.bossLabel.setVisible(true);
      g.fillStyle(hex(P.ink), 1).fillRect(x - 2, y - 2, bw + 4, 9);
      g.fillStyle(hex(P.redShade), 1).fillRect(x, y, bw, 5);
      g.fillStyle(hex(boss.phase2 ? P.hazard : P.hpLow), 1).fillRect(x, y, Math.round(bw * Math.max(0, boss.hp / boss.maxHp)), 5);
      g.fillStyle(hex(P.white), 0.3).fillRect(x, y, Math.round(bw * Math.max(0, boss.hp / boss.maxHp)), 1);
    } else {
      this.bossLabel.setVisible(false);
    }
  }
}
