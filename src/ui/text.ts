import Phaser from 'phaser';
import { FONT_KEY } from '../art/font';
import { hex } from '../art/palette';

export interface TextOpts {
  color?: string;
  scale?: number;
  ox?: number;
  oy?: number;
  depth?: number;
  fixed?: boolean;
}

/** Bitmap text in the game font. Coordinates are rounded to keep pixels crisp. */
export function text(scene: Phaser.Scene, x: number, y: number, str: string, o: TextOpts = {}): Phaser.GameObjects.BitmapText {
  const t = scene.add.bitmapText(Math.round(x), Math.round(y), FONT_KEY, str.toUpperCase());
  t.setOrigin(o.ox ?? 0, o.oy ?? 0);
  if (o.scale) t.setScale(o.scale);
  if (o.color) t.setTint(hex(o.color));
  if (o.depth !== undefined) t.setDepth(o.depth);
  if (o.fixed) t.setScrollFactor(0);
  return t;
}

export function fmtTime(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
