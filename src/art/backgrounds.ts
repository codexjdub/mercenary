import Phaser from 'phaser';
import { PixelCanvas, rng } from './PixelCanvas';
import { GAME_H, GAME_W } from '../constants';

// Parallax backdrop layers for the jungle ridge. Each layer tiles horizontally.

function canvas(scene: Phaser.Scene, key: string, w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void) {
  const tex = scene.textures.createCanvas(key, w, h)!;
  paint(tex.getContext());
  tex.refresh();
}

function ridge(w: number, seed: number, base: number, amp: number, freqs: number[]): number[] {
  const R = rng(seed);
  const phases = freqs.map(() => R() * Math.PI * 2);
  const out: number[] = [];
  for (let x = 0; x < w; x++) {
    let y = base;
    freqs.forEach((f, i) => {
      // integer cycles over width so the layer tiles seamlessly
      y += Math.sin((x / w) * Math.PI * 2 * f + phases[i]) * (amp / (i + 1));
    });
    out.push(Math.round(y));
  }
  return out;
}

export function buildBackgrounds(scene: Phaser.Scene): void {
  // Sky: banded gradient with ordered dithering between bands.
  canvas(scene, 'bg_sky', GAME_W, GAME_H, (ctx) => {
    const bands = ['#2f5d9e', '#3a70b0', '#4c86c0', '#68a0cc', '#8cbcd6', '#b4d2d8', '#dcdcc8', '#f0d8a8'];
    const bh = GAME_H / bands.length;
    for (let y = 0; y < GAME_H; y++) {
      const b = Math.min(bands.length - 1, Math.floor(y / bh));
      const t = (y % bh) / bh;
      for (let x = 0; x < GAME_W; x++) {
        const dither = ((x + y) % 2 === 0 ? 0.25 : 0.75) < (t - 0.6) * 2.5;
        ctx.fillStyle = dither && b < bands.length - 1 ? bands[b + 1] : bands[b];
        ctx.fillRect(x, y, 1, 1);
      }
    }
    // a few soft clouds
    const R = rng(3);
    for (let c = 0; c < 6; c++) {
      const cx = R() * GAME_W;
      const cy = 30 + R() * 90;
      const pc = new PixelCanvas(80, 20);
      for (let k = 0; k < 5; k++) pc.ellipse(15 + k * 12, 12 - (k % 2) * 3, 10, 5, '#e8f0f0');
      for (let x = 0; x < 80; x++) for (let y = 14; y < 20; y++) pc.over(x, y, '#c8dce4');
      pc.draw(ctx, Math.round(cx), Math.round(cy));
    }
  });

  // Far mountains
  const MW = 480;
  canvas(scene, 'bg_far', MW, 160, (ctx) => {
    const r1 = ridge(MW, 11, 70, 34, [2, 5, 9]);
    const r2 = ridge(MW, 12, 100, 20, [3, 7, 13]);
    for (let x = 0; x < MW; x++) {
      ctx.fillStyle = '#7e9cbc';
      ctx.fillRect(x, r1[x], 1, 160 - r1[x]);
      ctx.fillStyle = '#a4bcd0';
      ctx.fillRect(x, r1[x], 1, 2);
      ctx.fillStyle = '#6a88aa';
      ctx.fillRect(x, r2[x], 1, 160 - r2[x]);
    }
  });

  // Mid jungle canopy
  canvas(scene, 'bg_mid', MW, 200, (ctx) => {
    const R = rng(21);
    const pc = new PixelCanvas(MW, 200);
    const base = ridge(MW, 22, 70, 16, [4, 9]);
    for (let x = 0; x < MW; x++) pc.vline(x, base[x], 199, '#3e7466');
    for (let i = 0; i < 46; i++) {
      const x = (i / 46) * MW + R() * 10;
      const y = base[Math.floor(x) % MW] + 4;
      const r = 8 + R() * 10;
      const col = R() < 0.5 ? '#4a8470' : '#3e7466';
      for (const dx of [-MW, 0, MW]) {
        pc.ellipse(x + dx, y, r, r * 0.7, col);
        pc.ellipse(x + dx - 3, y - 3, r * 0.4, r * 0.3, '#5c9a7e');
      }
    }
    // distant trunks
    for (let i = 0; i < 18; i++) {
      const x = Math.floor(R() * MW);
      pc.rect(x, base[x] + 14, 3, 200, '#2e5a50');
    }
    pc.draw(ctx, 0, 0);
  });

  // Near foliage silhouette
  canvas(scene, 'bg_near', MW, 220, (ctx) => {
    const R = rng(31);
    const pc = new PixelCanvas(MW, 220);
    const base = ridge(MW, 32, 120, 18, [3, 8]);
    for (let x = 0; x < MW; x++) pc.vline(x, base[x], 219, '#24463e');
    for (let i = 0; i < 9; i++) {
      const x = Math.floor((i / 9) * MW + R() * 30);
      pc.rect(x, 20 + R() * 40, 5, 220, '#1c3832');
      // hanging vines
      for (let v = 0; v < 3; v++) {
        const vx = x - 10 + Math.floor(R() * 24);
        const len = 20 + R() * 50;
        for (let y = 0; y < len; y++) pc.set(vx + Math.round(Math.sin(y / 6) * 1.2), y, '#2c5a44');
      }
      for (const dx of [-MW, 0, MW]) {
        pc.ellipse(x + dx + 2, 18 + R() * 20, 22 + R() * 10, 12, '#24463e');
      }
    }
    for (let i = 0; i < 40; i++) {
      const x = R() * MW;
      const y = base[Math.floor(x)] + 2;
      for (const dx of [-MW, 0, MW]) pc.ellipse(x + dx, y, 10 + R() * 8, 6, '#2c5248');
    }
    pc.draw(ctx, 0, 0);
  });
}
