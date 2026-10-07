import Phaser from 'phaser';
import { P, hex } from '../art/palette';
import { text } from './text';
import { GunStats, statProfile, Cost } from '../data/gunParts';
import type { Material } from '../game/Mission';

export const MATERIALS: Material[] = ['scrap', 'wire', 'alloy'];
export const MAT_NAME: Record<Material, string> = { scrap: 'SCRAP', wire: 'WIRING', alloy: 'HEX ALLOY' };

/** Bordered menu panel with a lighter top edge. */
export function panel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, accent = false): void {
  g.fillStyle(hex(P.ink), 0.92).fillRect(x, y, w, h);
  g.lineStyle(1, hex(accent ? P.hazard : '#3c3250'), 1).strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  g.fillStyle(hex(accent ? P.hazard : '#3c3250'), 1).fillRect(x + 1, y + 1, w - 2, 1);
}

/** Splits text into lines of at most `max` characters. */
export function wrap(str: string, max: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of str.split(' ')) {
    if ((line + ' ' + word).trim().length > max) {
      out.push(line.trim());
      line = word;
    } else line += ' ' + word;
  }
  if (line.trim()) out.push(line.trim());
  return out;
}

/** A row of material icons with counts. Returns the count labels for updating. */
export function materialStrip(scene: Phaser.Scene, x: number, y: number, gap = 40, depth = 0, fixed = false): Phaser.GameObjects.BitmapText[] {
  return MATERIALS.map((m, i) => {
    const icon = scene.add.image(x + i * gap, y + 4, `pk_${m}`).setOrigin(0, 0.5).setDepth(depth);
    if (fixed) icon.setScrollFactor(0);
    return text(scene, x + i * gap + 13, y, '0', { depth, fixed });
  });
}

/** Draws a crafting cost; red numbers where the player is short. */
export class CostView {
  private icons: Phaser.GameObjects.Image[];
  private nums: Phaser.GameObjects.BitmapText[];

  private gap: number;

  constructor(scene: Phaser.Scene, x: number, y: number, gap = 34) {
    this.gap = gap;
    this.icons = MATERIALS.map((m, i) => scene.add.image(x + i * gap, y + 4, `pk_${m}`).setOrigin(0, 0.5));
    this.nums = MATERIALS.map((_, i) => text(scene, x + i * gap + 12, y, ''));
  }

  objects(): Phaser.GameObjects.GameObject[] {
    return [...this.icons, ...this.nums];
  }

  set(cost: Cost | undefined, have: Record<Material, number> | null): void {
    let col = 0;
    MATERIALS.forEach((m, i) => {
      const need = cost?.[m] ?? 0;
      const show = need > 0;
      this.icons[i].setVisible(show);
      this.nums[i].setVisible(show);
      if (!show) return;
      this.icons[i].x = this.icons[0].x + col * this.gap;
      this.nums[i].x = this.icons[i].x + 12;
      col++;
      this.nums[i].setText(String(need)).setTint(hex(have && have[m] < need ? P.hpLow : P.ui));
    });
  }

  setVisible(v: boolean): void {
    this.icons.forEach((o) => o.setVisible(v));
    this.nums.forEach((o) => o.setVisible(v));
  }
}

/** Stat bars for a gun; when `base` is given, shows gains in green and losses in red. */
export class StatPanel {
  private labels: Phaser.GameObjects.BitmapText[] = [];
  private values: Phaser.GameObjects.BitmapText[] = [];
  private x: number;
  private y: number;
  private w: number;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number) {
    this.x = x;
    this.y = y;
    this.w = w;
    for (let i = 0; i < 7; i++) {
      this.labels.push(text(scene, x, y + i * 11, '', { color: P.uiDim }));
      this.values.push(text(scene, x + w, y + i * 11, '', { ox: 1 }));
    }
  }

  draw(g: Phaser.GameObjects.Graphics, s: GunStats, base?: GunStats): void {
    const prof = statProfile(s);
    const old = base ? statProfile(base) : null;
    const bx = this.x + 66;
    const bw = this.w - 66 - 40;
    prof.forEach((row, i) => {
      const y = this.y + i * 11 + 1;
      this.labels[i].setText(row.label);
      const was = old ? old[i].v : row.v;
      const better = row.v > was + 0.001;
      const worse = row.v < was - 0.001;
      this.values[i].setText(row.text).setTint(hex(better ? P.hpGood : worse ? P.hpLow : P.ui));
      g.fillStyle(hex(P.inkSoft), 1).fillRect(bx, y, bw, 5);
      const common = Math.min(row.v, was);
      g.fillStyle(hex('#c8c0d8'), 1).fillRect(bx, y, Math.round(bw * common), 5);
      if (better) g.fillStyle(hex(P.hpGood), 1).fillRect(bx + Math.round(bw * was), y, Math.max(1, Math.round(bw * (row.v - was))), 5);
      if (worse) g.fillStyle(hex(P.hpLow), 1).fillRect(bx + Math.round(bw * row.v), y, Math.max(1, Math.round(bw * (was - row.v))), 5);
    });
  }

  setVisible(v: boolean): void {
    this.labels.forEach((o) => o.setVisible(v));
    this.values.forEach((o) => o.setVisible(v));
  }

  objects(): Phaser.GameObjects.GameObject[] {
    return [...this.labels, ...this.values];
  }
}
