import Phaser from 'phaser';
import { PixelCanvas, rng } from './PixelCanvas';
import { P } from './palette';
import { HF, POSE_STAND, STYLE_BRASS, drawHuman } from './humanoid';
import { GAME_H, GAME_W } from '../constants';

// Art for the mercenary base camp hub.

function sheet(scene: Phaser.Scene, key: string, frames: PixelCanvas[]): void {
  const fw = frames[0].w;
  const fh = frames[0].h;
  const tex = scene.textures.createCanvas(key, fw * frames.length, fh)!;
  const ctx = tex.getContext();
  frames.forEach((f, i) => {
    f.draw(ctx, i * fw, 0);
    tex.add(i, 0, i * fw, 0, fw, fh);
  });
  tex.refresh();
}

const CANVAS = '#6a7448';
const CANVAS_SHADE = '#4e5634';
const CANVAS_LIGHT = '#8a945c';

function tent(): PixelCanvas {
  const pc = new PixelCanvas(92, 62);
  // body: A-frame with a sloped roof
  for (let y = 4; y < 61; y++) {
    const half = Math.min(44, 6 + (y - 4) * 1.1);
    pc.hline(46 - half, 46 + half, y, y < 30 ? CANVAS : CANVAS_SHADE);
  }
  for (let y = 4; y < 61; y++) {
    const half = Math.min(44, 6 + (y - 4) * 1.1);
    pc.set(46 - half, y, CANVAS_SHADE);
    pc.set(46 + half, y, CANVAS_LIGHT);
  }
  pc.line(46, 4, 46, 60, CANVAS_LIGHT);
  // open flap showing the dark interior + a cot
  for (let y = 26; y < 61; y++) {
    const half = (y - 26) * 0.55;
    pc.hline(46 - half, 46 + half, y, '#1e2018');
  }
  pc.rect(38, 52, 16, 3, '#5a4a3a').hline(38, 53, 52, '#7a6650');
  pc.line(46, 26, 30, 60, CANVAS_LIGHT);
  pc.line(46, 26, 62, 60, CANVAS_SHADE);
  // patches + stencil
  pc.rect(16, 46, 6, 5, '#5c6640').rect(70, 40, 5, 4, '#7c8650');
  pc.rect(66, 50, 10, 3, P.hazard);
  // ropes and pegs
  pc.line(4, 60, 22, 36, '#c8b48a').line(88, 60, 70, 36, '#c8b48a');
  pc.rect(3, 59, 2, 2, P.trunk).rect(87, 59, 2, 2, P.trunk);
  pc.rect(45, 0, 2, 5, P.metalShade);
  pc.outline(P.ink);
  return pc;
}

function missionBoard(): PixelCanvas {
  const pc = new PixelCanvas(58, 52);
  pc.rect(6, 10, 3, 42, P.trunk).rect(49, 10, 3, 42, P.trunk);
  pc.rect(2, 8, 54, 30, P.woodShade);
  pc.rect(3, 9, 52, 28, P.wood);
  for (let y = 15; y < 37; y += 7) pc.hline(3, 54, y, P.woodShade);
  // header plank
  pc.rect(10, 2, 38, 7, P.woodLight).hline(10, 47, 8, P.woodShade);
  for (const x of [14, 19, 24, 29, 34, 39, 43]) pc.rect(x, 4, 3, 3, P.ink);
  // pinned contracts
  const R = rng(5);
  const papers: [number, number, number, number, string][] = [
    [6, 12, 11, 13, '#ece2c8'],
    [20, 11, 12, 15, '#f4ecd8'],
    [35, 13, 9, 11, '#e4d8b8'],
    [46, 12, 7, 9, '#ece2c8'],
    [8, 27, 10, 8, '#f4ecd8'],
  ];
  for (const [x, y, w, h, c] of papers) {
    pc.rect(x, y, w, h, c);
    for (let ly = y + 3; ly < y + h - 1; ly += 2) pc.hline(x + 1, x + Math.floor(1 + R() * (w - 3)), ly, '#9a8e78');
    pc.set(x + Math.floor(w / 2), y, P.red);
  }
  // hexcorp target poster
  pc.rect(22, 27, 22, 9, '#f4ecd8');
  pc.rect(24, 28, 5, 5, P.hexAccent).set(26, 30, '#f4ecd8');
  pc.hline(31, 41, 29, P.ink).hline(31, 38, 31, '#9a8e78').hline(31, 40, 33, '#9a8e78');
  pc.line(23, 27, 28, 34, P.red).line(28, 27, 23, 34, P.red);
  // lantern
  pc.rect(53, 4, 4, 5, P.metalDark).rect(54, 5, 2, 3, P.flash);
  pc.outline(P.ink);
  return pc;
}

function campfire(frame: number): PixelCanvas {
  const pc = new PixelCanvas(26, 30);
  // stones + logs
  for (const x of [2, 7, 17, 22]) pc.ellipse(x, 27, 2, 1.5, x % 2 ? P.rockShade : P.rock);
  pc.line(4, 27, 20, 23, P.trunk, 3).line(4, 23, 21, 27, P.trunkShade, 3);
  pc.set(12, 25, P.fireDark).set(9, 24, P.fire);
  // flames
  const R = rng(100 + frame);
  const h = [18, 21, 16][frame];
  for (let y = 0; y < h; y++) {
    const t = y / h;
    const w = (1 - t) * 6 + Math.sin((y + frame * 3) * 0.7) * 1.5;
    const cx = 13 + Math.sin((y + frame * 5) * 0.45) * (t * 2.5);
    const yy = 24 - y;
    pc.hline(Math.round(cx - w), Math.round(cx + w), yy, t < 0.35 ? P.fire : t < 0.7 ? P.flashOut : P.flashMid);
    if (t < 0.6) pc.hline(Math.round(cx - w * 0.45), Math.round(cx + w * 0.45), yy, t < 0.3 ? P.flashMid : P.flash);
  }
  for (let i = 0; i < 3; i++) pc.set(8 + Math.floor(R() * 10), 2 + Math.floor(R() * 6), P.flashMid);
  return pc;
}

function logSeat(): PixelCanvas {
  const pc = new PixelCanvas(30, 9);
  pc.rect(1, 2, 28, 6, P.trunk).hline(1, 28, 2, '#7a5640').hline(1, 28, 7, P.trunkShade);
  pc.ellipse(28, 5, 1.5, 3, '#a87a52').set(28, 5, P.trunkShade);
  pc.outline(P.ink);
  return pc;
}

function workshopBack(): PixelCanvas {
  const pc = new PixelCanvas(116, 80);
  // poles
  pc.rect(6, 12, 3, 68, P.metalShade).rect(106, 12, 3, 68, P.metalShade);
  // striped awning
  for (let x = 0; x < 116; x++) {
    const stripe = Math.floor(x / 8) % 2 === 0;
    pc.vline(x, 4, 13, stripe ? P.red : '#e8dcc0');
    pc.set(x, 14 + (x % 8 < 4 ? 0 : 1), stripe ? P.redShade : '#c8bca0');
  }
  pc.hline(0, 115, 4, P.redShade);
  // pegboard with tool silhouettes
  pc.rect(16, 20, 84, 30, '#a07850');
  for (let y = 22; y < 50; y += 4) for (let x = 18; x < 100; x += 4) pc.set(x, y, '#7a5838');
  // wrench
  pc.line(24, 26, 24, 42, P.metalLight, 2).ring(24, 25, 2, P.metalLight).set(24, 24, '#a07850');
  // hammer
  pc.vline(34, 28, 44, P.trunk).rect(31, 26, 7, 3, P.metal);
  // saw
  pc.rect(44, 28, 14, 5, P.metalLight).rect(58, 27, 4, 7, P.wood);
  for (let x = 44; x < 58; x += 2) pc.set(x, 33, P.metalShade);
  // gun parts hung up: a barrel and a receiver
  pc.rect(68, 26, 18, 2, P.metalDark).rect(68, 32, 10, 5, '#4a5260').hline(68, 77, 32, '#6e7888');
  pc.ellipse(92, 40, 4, 4, P.metalDark).ring(92, 40, 2, P.metal);
  // hanging work lamp
  pc.vline(58, 14, 18, P.metalDark).rect(55, 18, 7, 3, P.metalShade).hline(56, 60, 21, P.flash);
  pc.outline(P.ink);
  return pc;
}

function workshopBench(): PixelCanvas {
  const pc = new PixelCanvas(116, 80);
  // workbench
  pc.rect(10, 54, 96, 6, P.wood).hline(10, 105, 54, P.woodLight).hline(10, 105, 59, P.woodShade);
  pc.rect(14, 60, 4, 20, P.woodShade).rect(98, 60, 4, 20, P.woodShade);
  pc.rect(14, 70, 88, 3, P.woodShade);
  // vise
  pc.rect(86, 47, 12, 7, P.metalShade).rect(84, 49, 3, 3, P.metalDark).hline(86, 97, 47, P.metalLight);
  // parts & ammo on the bench
  pc.rect(22, 50, 8, 4, P.metalDark).rect(34, 51, 3, 3, P.brass).rect(38, 51, 3, 3, P.brass).rect(62, 49, 12, 5, '#4c5a40');
  pc.rect(48, 48, 6, 6, P.red).hline(48, 53, 48, P.redLight);
  pc.outline(P.ink);
  return pc;
}

function radioTable(): PixelCanvas {
  const pc = new PixelCanvas(66, 64);
  // antenna
  pc.vline(56, 0, 40, P.metalShade);
  pc.line(56, 4, 52, 0, P.metalShade).line(56, 4, 60, 0, P.metalShade);
  pc.set(56, 0, P.visor);
  // table
  pc.rect(4, 42, 58, 4, P.wood).hline(4, 61, 42, P.woodLight);
  pc.rect(7, 46, 3, 18, P.woodShade).rect(56, 46, 3, 18, P.woodShade);
  // radio set
  pc.rect(10, 26, 30, 16, '#4c5a40').hline(10, 39, 26, '#6a7a58').vline(10, 26, 41, '#3a4630');
  pc.rect(13, 29, 12, 6, '#2a2e24');
  pc.hline(14, 23, 32, P.hpGood).set(19, 31, P.hpGood).set(21, 33, P.hpGood);
  for (const x of [29, 34]) pc.circle(x, 32, 2, P.metalLight);
  pc.rect(13, 37, 24, 2, P.metalShade);
  pc.line(40, 34, 48, 40, P.ink); // handset cord
  pc.rect(44, 38, 8, 4, P.ink);
  // mug + papers + map
  pc.rect(48, 34, 4, 5, '#e8dcc0').set(52, 36, '#e8dcc0');
  pc.rect(24, 40, 14, 2, '#f4ecd8');
  // stool
  pc.rect(16, 52, 12, 3, P.woodShade).rect(18, 55, 2, 9, P.trunk).rect(24, 55, 2, 9, P.trunk);
  pc.outline(P.ink);
  return pc;
}

function crates(): PixelCanvas {
  const pc = new PixelCanvas(52, 40);
  const crate = (x: number, y: number, w: number, h: number) => {
    pc.rect(x, y, w, h, P.wood).rect(x, y, w, 1, P.woodLight).rect(x, y + h - 1, w, 1, P.woodShade);
    pc.vline(x, y, y + h - 1, P.woodShade).vline(x + w - 1, y, y + h - 1, P.woodShade);
    pc.line(x + 1, y + h - 2, x + w - 2, y + 1, P.woodShade);
  };
  crate(2, 18, 20, 22);
  crate(22, 24, 18, 16);
  crate(8, 2, 16, 16);
  // ammo can
  pc.rect(40, 30, 11, 10, '#4c5a40').hline(40, 50, 30, '#6a7a58').rect(43, 28, 5, 2, P.metalShade);
  pc.rect(12, 26, 6, 3, P.hazard);
  pc.outline(P.ink);
  return pc;
}

/** Company banner: original gear-and-blade emblem. */
function flag(frame: number): PixelCanvas {
  const pc = new PixelCanvas(40, 70);
  pc.rect(2, 2, 2, 68, P.metalShade).rect(1, 0, 4, 3, P.brass);
  for (let x = 0; x < 30; x++) {
    const wave = Math.round(Math.sin(x * 0.28 + frame * 2.1) * 1.6 * (x / 30));
    pc.vline(4 + x, 5 + wave, 24 + wave, x % 10 < 1 ? P.redShade : P.red);
    pc.set(4 + x, 5 + wave, P.redLight);
  }
  // emblem: gear with a blade through it
  const cx = 19;
  const cy = 14 + Math.round(Math.sin(15 * 0.28 + frame * 2.1) * 0.8);
  pc.ring(cx, cy, 5, '#f4ecd8', 2);
  for (const [dx, dy] of [
    [0, -7],
    [0, 7],
    [-7, 0],
    [7, 0],
  ])
    pc.rect(cx + dx - 1, cy + dy - 1, 2, 2, '#f4ecd8');
  pc.line(cx - 6, cy + 6, cx + 6, cy - 6, P.metalLight, 2);
  pc.outline(P.ink);
  return pc;
}

function bulb(on: boolean): PixelCanvas {
  const pc = new PixelCanvas(3, 4);
  pc.set(1, 0, P.ink).rect(0, 1, 3, 3, on ? P.flash : P.flashOut).set(1, 2, on ? P.white : P.flashMid);
  return pc;
}

function duskSky(scene: Phaser.Scene) {
  const tex = scene.textures.createCanvas('bg_dusk', GAME_W, GAME_H)!;
  const ctx = tex.getContext();
  const bands = ['#1c1838', '#2a2048', '#3e2a58', '#5a3462', '#7c4266', '#a45a66', '#cc7a62', '#e8a070'];
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
  const R = rng(77);
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(R() * GAME_W);
    const y = Math.floor(R() * 110);
    ctx.fillStyle = R() < 0.2 ? '#fff4c0' : '#c8c0e0';
    ctx.fillRect(x, y, 1, 1);
  }
  // a low moon
  const moon = new PixelCanvas(20, 20);
  moon.circle(10, 10, 8, '#f4ecd8').circle(13, 8, 7, null).circle(7, 12, 1.5, '#d8d0bc');
  moon.draw(ctx, 380, 30);
  tex.refresh();
}

export function buildCampArt(scene: Phaser.Scene): void {
  duskSky(scene);
  sheet(scene, 'c_tent', [tent()]);
  sheet(scene, 'c_board', [missionBoard()]);
  sheet(scene, 'c_fire', [0, 1, 2].map(campfire));
  scene.anims.create({ key: 'c_fire', frames: [0, 1, 2].map((f) => ({ key: 'c_fire', frame: f })), frameRate: 9, repeat: -1 });
  sheet(scene, 'c_log', [logSeat()]);
  sheet(scene, 'c_workshop', [workshopBack()]);
  sheet(scene, 'c_bench', [workshopBench()]);

  // soft firelight glow (smooth gradient on purpose)
  const glow = scene.textures.createCanvas('c_glow', 128, 128)!;
  const gctx = glow.getContext();
  const grad = gctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,170,80,0.55)');
  grad.addColorStop(0.5, 'rgba(255,120,50,0.18)');
  grad.addColorStop(1, 'rgba(255,90,40,0)');
  gctx.fillStyle = grad;
  gctx.fillRect(0, 0, 128, 128);
  glow.refresh();
  sheet(scene, 'c_radio', [radioTable()]);
  sheet(scene, 'c_crates', [crates()]);
  sheet(scene, 'c_flag', [0, 1, 2].map(flag));
  scene.anims.create({ key: 'c_flag', frames: [0, 1, 2].map((f) => ({ key: 'c_flag', frame: f })), frameRate: 5, repeat: -1 });
  sheet(scene, 'c_bulb', [bulb(true), bulb(false)]);

  // Brass, the gunsmith
  const frames = [
    drawHuman(STYLE_BRASS, { ...POSE_STAND, arms: 'hammerUp', lean: 1 }).pc,
    drawHuman(STYLE_BRASS, { ...POSE_STAND, arms: 'hammerDown', lean: 1, bob: 1 }).pc,
    drawHuman(STYLE_BRASS, { ...POSE_STAND, arms: 'none' }).pc,
    drawHuman(STYLE_BRASS, { ...POSE_STAND, arms: 'wave' }).pc,
  ];
  const tex = scene.textures.createCanvas('brass', HF * frames.length, HF)!;
  frames.forEach((f, i) => {
    f.draw(tex.getContext(), i * HF, 0);
    tex.add(i, 0, i * HF, 0, HF, HF);
  });
  tex.refresh();
  scene.anims.create({
    key: 'brass-work',
    frames: [0, 0, 1, 1, 0, 0, 1, 1, 2, 2, 2, 2].map((f) => ({ key: 'brass', frame: f })),
    frameRate: 5,
    repeat: -1,
  });
  scene.anims.create({ key: 'brass-wave', frames: [3, 2].map((f) => ({ key: 'brass', frame: f })), frameRate: 4, repeat: -1 });
}
