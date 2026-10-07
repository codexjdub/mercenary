import Phaser from 'phaser';
import { PixelCanvas, rng } from './PixelCanvas';
import { P } from './palette';
import {
  HF,
  HumanFrame,
  HumanStyle,
  POSE_STAND,
  Pose,
  STYLE_GRENADIER,
  STYLE_GRUNT,
  STYLE_HOSTAGE,
  STYLE_ROOK,
  drawDowned,
  drawHuman,
  runLegs,
} from './humanoid';

// Generates every sprite texture and animation at boot.

type Anchor = { x: number; y: number };
export const ANCHORS: Record<string, Anchor[]> = {};

function sheet(scene: Phaser.Scene, key: string, frames: PixelCanvas[], fw: number, fh: number): void {
  const tex = scene.textures.createCanvas(key, fw * frames.length, fh)!;
  const ctx = tex.getContext();
  frames.forEach((f, i) => {
    f.draw(ctx, i * fw, 0);
    tex.add(i, 0, i * fw, 0, fw, fh);
  });
  tex.refresh();
}

function image(scene: Phaser.Scene, key: string, pc: PixelCanvas): void {
  sheet(scene, key, [pc], pc.w, pc.h);
}

function anim(scene: Phaser.Scene, key: string, tex: string, frames: number[], fps: number, repeat = -1): void {
  scene.anims.create({
    key,
    frames: frames.map((f) => ({ key: tex, frame: f })),
    frameRate: fps,
    repeat,
  });
}

const L = (kx: number, ky: number, fx: number, fy: number) => ({ knee: { x: kx, y: ky }, foot: { x: fx, y: fy } });

const CROUCH_LEGS = { drop: 7, front: L(21, 27, 21, 29), back: L(14, 30, 10, 29) };

// ---------------------------------------------------------------- humans

function humanSheet(scene: Phaser.Scene, key: string, style: HumanStyle, poses: (Pose | 'dead')[]): void {
  const frames: HumanFrame[] = poses.map((p) =>
    p === 'dead' ? { pc: drawDowned(style), anchor: { x: 19, y: 17 } } : drawHuman(style, p),
  );
  ANCHORS[key] = frames.map((f) => f.anchor);
  sheet(
    scene,
    key,
    frames.map((f) => f.pc),
    HF,
    HF,
  );
}

function buildHumans(scene: Phaser.Scene): void {
  const run = (i: number, n = 6): Pose => ({ ...runLegs(i / n), arms: 'gun', lean: 1, tail: i % 2 });

  // Player: Rook
  humanSheet(scene, 'rook', STYLE_ROOK, [
    { ...POSE_STAND, tail: 0 }, // 0 idle
    { ...POSE_STAND, bob: 1, tail: 1 }, // 1 idle
    run(0),
    run(1),
    run(2),
    run(3),
    run(4),
    run(5), // 2-7 run
    { front: L(20, 23, 19, 27), back: L(14, 24, 12, 27), arms: 'gun', tail: 1 }, // 8 jump
    { front: L(18, 24, 18, 28), back: L(14, 25, 13, 29), arms: 'gun', tail: 0 }, // 9 fall
    { ...CROUCH_LEGS, arms: 'gun', tail: 0 }, // 10 crouch
    { front: L(19, 25, 21, 29), back: L(14, 25, 11, 29), arms: 'knife', lean: 1, tail: 1 }, // 11 melee
    { ...POSE_STAND, arms: 'flail', lean: -1, headBack: 1, tail: 1 }, // 12 hurt
    'dead', // 13
    { ...POSE_STAND, arms: 'eat', tail: 0 }, // 14 eat
    { ...CROUCH_LEGS, arms: 'knife', tail: 1 }, // 15 crouch melee
  ]);
  anim(scene, 'rook-idle', 'rook', [0, 1], 2.5);
  anim(scene, 'rook-run', 'rook', [2, 3, 4, 5, 6, 7], 13);
  anim(scene, 'rook-jump', 'rook', [8], 1);
  anim(scene, 'rook-fall', 'rook', [9], 1);
  anim(scene, 'rook-crouch', 'rook', [10], 1);
  anim(scene, 'rook-melee', 'rook', [11], 1);
  anim(scene, 'rook-cmelee', 'rook', [15], 1);
  anim(scene, 'rook-hurt', 'rook', [12], 1);
  anim(scene, 'rook-dead', 'rook', [13], 1);
  anim(scene, 'rook-eat', 'rook', [14, 1], 6);

  // Hexcorp rifle trooper
  humanSheet(scene, 'grunt', STYLE_GRUNT, [
    POSE_STAND,
    { ...POSE_STAND, bob: 1 },
    ...[0, 1, 2, 3, 4, 5].map((i) => ({ ...runLegs(i / 6), arms: 'gun' as const })),
    { ...CROUCH_LEGS, arms: 'gun' }, // 8 crouch
    { ...POSE_STAND, arms: 'flail', lean: -1, headBack: 1 }, // 9 hurt
    'dead', // 10
    { ...POSE_STAND, arms: 'gunHigh' }, // 11 aim (shoulder height)
  ]);
  anim(scene, 'grunt-idle', 'grunt', [0, 1], 2);
  anim(scene, 'grunt-walk', 'grunt', [2, 3, 4, 5, 6, 7], 8);
  anim(scene, 'grunt-run', 'grunt', [2, 3, 4, 5, 6, 7], 12);
  anim(scene, 'grunt-crouch', 'grunt', [8], 1);
  anim(scene, 'grunt-hurt', 'grunt', [9], 1);
  anim(scene, 'grunt-dead', 'grunt', [10], 1);
  anim(scene, 'grunt-aim', 'grunt', [11], 1);

  // Hexcorp grenadier
  humanSheet(scene, 'grenadier', STYLE_GRENADIER, [
    POSE_STAND,
    { ...POSE_STAND, bob: 1 },
    ...[0, 1, 2, 3, 4, 5].map((i) => ({ ...runLegs(i / 6), arms: 'gun' as const })),
    { ...POSE_STAND, arms: 'throwBack', lean: -1 }, // 8
    { front: L(19, 25, 21, 29), back: L(14, 25, 12, 29), arms: 'throwFwd', lean: 1 }, // 9
    { ...POSE_STAND, arms: 'flail', lean: -1, headBack: 1 }, // 10
    'dead', // 11
  ]);
  anim(scene, 'gren-idle', 'grenadier', [0, 1], 2);
  anim(scene, 'gren-walk', 'grenadier', [2, 3, 4, 5, 6, 7], 7);
  anim(scene, 'gren-hurt', 'grenadier', [10], 1);
  anim(scene, 'gren-dead', 'grenadier', [11], 1);

  // Captured engineer
  humanSheet(scene, 'hostage', STYLE_HOSTAGE, [
    { ...CROUCH_LEGS, arms: 'tied' },
    { ...CROUCH_LEGS, arms: 'tied', bob: 1 },
    { ...POSE_STAND, arms: 'wave' },
    { ...POSE_STAND, arms: 'waveB' },
    { ...runLegs(0), arms: 'runA', lean: 1 },
    { ...runLegs(0.33), arms: 'runB', lean: 1 },
    { ...runLegs(0.5), arms: 'runB', lean: 1 },
    { ...runLegs(0.83), arms: 'runA', lean: 1 },
  ]);
  anim(scene, 'hostage-tied', 'hostage', [0, 0, 0, 1], 3);
  anim(scene, 'hostage-wave', 'hostage', [2, 3], 6);
  anim(scene, 'hostage-run', 'hostage', [4, 5, 6, 7], 10);
}

// ---------------------------------------------------------------- drone

function drawDrone(frame: number): PixelCanvas {
  const pc = new PixelCanvas(24, 20);
  const charge = frame === 2;
  // rotor
  pc.vline(12, 3, 6, P.metalDark);
  if (frame === 1) pc.hline(7, 17, 3, P.metalLight);
  else {
    pc.hline(2, 22, 3, P.metalLight);
    pc.set(2, 3, P.metal).set(22, 3, P.metal);
  }
  // fins
  pc.rect(3, 10, 3, 4, P.metalShade);
  pc.rect(18, 10, 3, 4, P.metalShade);
  // hull
  pc.ellipse(12, 11, 7, 5, P.metal);
  for (let x = 4; x <= 20; x++) for (let y = 12; y <= 16; y++) pc.over(x, y, P.metalShade);
  pc.hline(8, 14, 7, P.metalLight);
  pc.hline(6, 18, 13, P.hazard);
  pc.set(7, 13, P.ink).set(10, 13, P.ink).set(13, 13, P.ink).set(16, 13, P.ink);
  // eye
  pc.circle(15, 10, 2, P.ink);
  pc.set(15, 10, charge ? P.white : P.visor);
  pc.set(16, 10, charge ? P.visorGlow : P.visor);
  // under-gun
  pc.rect(11, 16, 3, 2, P.metalDark);
  pc.outline(P.ink);
  return pc;
}

// ---------------------------------------------------------------- foreman

export const FOREMAN_W = 64;
export const FOREMAN_H = 56;

function drawForeman(phase: number, o: { lean?: number; drop?: number; recoil?: number; stunned?: boolean; steam?: boolean } = {}): PixelCanvas {
  const pc = new PixelCanvas(FOREMAN_W, FOREMAN_H);
  const lean = o.lean ?? 0;
  const drop = o.drop ?? 0;
  const hipX = 28 + lean;
  const hipY = 34 + drop;

  const legAt = (p: number) => {
    const a = p * Math.PI * 2;
    const lift = Math.sin(a) < 0 ? -Math.sin(a) : 0;
    const fx = 28 + Math.round(Math.cos(a) * 7);
    const fy = 50 - Math.round(lift * 4);
    const kx = Math.round((hipX + fx) / 2) - 6;
    const ky = Math.round((hipY + fy) / 2) - 1;
    return { fx, fy, kx, ky };
  };
  const drawLeg = (p: number, dark: boolean) => {
    const { fx, fy, kx, ky } = legAt(p);
    const c = dark ? P.metalShade : P.metal;
    const cd = dark ? P.metalDark : P.metalShade;
    pc.line(hipX, hipY, kx, ky, c, 5);
    pc.line(kx, ky, fx, fy, cd, 4);
    pc.circle(kx, ky, 2, dark ? P.metalDark : P.metalLight);
    pc.rect(fx - 6, fy + 1, 13, 4, dark ? P.hazardShade : P.hazard);
    pc.rect(fx + 5, fy + 2, 2, 3, P.metalDark);
    pc.hline(fx - 6, fx + 6, fy + 4, P.metalDark);
  };

  drawLeg(phase + 0.5, true);

  // mortar pod + exhausts behind hull
  pc.rect(15 + lean, 4 + drop, 13, 9, '#4c5a40');
  pc.hline(15 + lean, 27 + lean, 4 + drop, '#6a7a58');
  pc.rect(17 + lean, 2 + drop, 3, 3, P.metalDark);
  pc.rect(22 + lean, 2 + drop, 3, 3, P.metalDark);
  pc.rect(8 + lean, 17 + drop, 7, 3, P.metalDark);
  pc.rect(8 + lean, 22 + drop, 7, 3, P.metalDark);
  pc.set(8 + lean, 17 + drop, P.fireDark).set(8 + lean, 22 + drop, P.fireDark);

  // hull
  const hx = 13 + lean;
  const hy = 11 + drop;
  pc.rect(hx, hy, 31, 23, P.hazard);
  pc.rect(hx, hy, 2, 23, P.hazardShade);
  pc.hline(hx + 2, hx + 30, hy, '#ffe070');
  pc.rect(hx, hy + 18, 31, 5, P.metalDark);
  for (let i = 0; i < 31; i += 4) pc.line(hx + i, hy + 22, hx + i + 2, hy + 18, P.hazard, 1);
  // rivets
  for (const [rx, ry] of [
    [3, 3],
    [3, 15],
    [14, 3],
    [27, 15],
  ])
    pc.set(hx + rx, hy + ry, P.hazardShade);
  // emblem
  const ex = hx + 8;
  const ey = hy + 9;
  pc.rect(ex - 2, ey - 1, 5, 3, P.hexAccent);
  pc.hline(ex - 1, ex + 1, ey - 2, P.hexAccent);
  pc.hline(ex - 1, ex + 1, ey + 2, P.hexAccent);
  pc.set(ex, ey, P.hazard);

  // canopy
  const cx = hx + 17;
  const cy = hy + 3;
  pc.rect(cx - 1, cy - 1, 14, 12, P.metalDark);
  pc.rect(cx, cy, 12, 10, P.glass);
  pc.rect(cx, cy + 6, 12, 4, P.glassShade);
  // pilot
  pc.circle(cx + 6, cy + 5, 3, P.hexArmor);
  pc.hline(cx + 7, cx + 9, cy + 5, P.visor);
  pc.set(cx + 3, cy + 1, P.white).set(cx + 4, cy + 1, P.white).set(cx + 2, cy + 2, P.white);
  if (o.stunned) {
    pc.line(cx + 2, cy + 8, cx + 8, cy + 2, P.white);
    pc.line(cx + 8, cy + 2, cx + 10, cy + 5, P.white);
  }

  // gatling arm
  const r = o.recoil ?? 0;
  const gx = hx + 30 - r;
  const gy = hy + 22;
  pc.circle(gx, gy + 3, 4, P.metal);
  pc.rect(gx + 2, gy, 10, 7, P.metalDark);
  pc.hline(gx + 2, gx + 11, gy, P.metalShade);
  for (const by of [1, 3, 5]) {
    pc.hline(gx + 12, gx + 19, gy + by, P.metal);
  }
  pc.hline(gx + 12, gx + 19, gy + 1, P.metalLight);
  pc.rect(gx + 18, gy, 2, 7, P.metalShade);

  drawLeg(phase, false);
  // hip joint
  pc.circle(hipX, hipY, 3, P.metalShade);
  pc.circle(hipX, hipY, 1, P.metalLight);

  pc.outline(P.ink);

  if (o.steam) {
    pc.set(6 + lean, 16 + drop, P.white).set(5 + lean, 15 + drop, P.white).set(4 + lean, 21 + drop, P.white);
  }
  if (o.stunned) {
    pc.set(hx + 20, hy - 2, P.flash).set(hx + 22, hy - 4, P.flashMid).set(hx + 5, hy - 3, P.flash);
  }
  return pc;
}

/** Gatling muzzle offset within a Foreman frame (facing right). */
export const FOREMAN_MUZZLE = { x: 13 + 30 + 20, y: 11 + 22 + 3 };

// ---------------------------------------------------------------- effects

function buildEffects(scene: Phaser.Scene): void {
  // muzzle flash (points right)
  const flash = [0, 1, 2].map((i) => {
    const pc = new PixelCanvas(16, 12);
    const s = [1, 0.7, 0.4][i];
    pc.ellipse(4, 6, 4 * s + 1, 3 * s + 0.5, P.flashOut);
    pc.hline(0, Math.round(15 * s), 6, P.flashMid);
    pc.line(2, 6, Math.round(2 + 6 * s), Math.round(6 - 4 * s), P.flashMid);
    pc.line(2, 6, Math.round(2 + 6 * s), Math.round(6 + 4 * s), P.flashMid);
    pc.ellipse(3, 6, 2 * s + 0.5, 1.5 * s, P.flash);
    pc.hline(0, Math.round(8 * s), 6, P.white);
    return pc;
  });
  sheet(scene, 'muzzle', flash, 16, 12);
  anim(scene, 'muzzle', 'muzzle', [0, 1, 2], 40, 0);

  const tracer = new PixelCanvas(9, 3);
  tracer.hline(4, 8, 0, P.flashOut).hline(0, 8, 1, P.flashMid).hline(4, 8, 1, P.white).hline(4, 8, 2, P.flashOut);
  image(scene, 'b_tracer', tracer);
  const slug = new PixelCanvas(12, 3);
  slug.hline(0, 11, 1, P.flashOut).hline(4, 11, 1, P.flashMid).hline(7, 11, 0, P.flashMid).hline(7, 11, 2, P.flashMid).hline(8, 11, 1, P.white);
  image(scene, 'b_slug', slug);
  const pellet = new PixelCanvas(3, 3);
  pellet.set(1, 0, P.flashMid).set(0, 1, P.flashMid).set(2, 1, P.flashMid).set(1, 2, P.flashMid).set(1, 1, P.white);
  image(scene, 'b_pellet', pellet);
  const needle = new PixelCanvas(7, 1);
  needle.hline(0, 2, 0, P.flashOut).hline(3, 6, 0, P.white);
  image(scene, 'b_needle', needle);
  const eb = new PixelCanvas(6, 6);
  eb.circle(2.5, 2.5, 2.5, P.visor).circle(2.5, 2.5, 1.5, P.flashOut).rect(2, 2, 2, 2, P.white);
  image(scene, 'b_enemy', eb);
  const bb = new PixelCanvas(10, 5);
  bb.ellipse(5, 2, 4.5, 2, P.visor).ellipse(6, 2, 3, 1, P.flashOut).hline(5, 8, 2, P.white);
  image(scene, 'b_boss', bb);

  // sparks
  const sparks = [0, 1, 2, 3].map((i) => {
    const pc = new PixelCanvas(11, 11);
    const len = [4, 5, 4, 2][i];
    const c = [P.white, P.flash, P.flashMid, P.flashOut][i];
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ])
      pc.line(5 + dx * (i > 1 ? 2 : 0), 5 + dy * (i > 1 ? 2 : 0), 5 + dx * len, 5 + dy * len, c);
    if (i < 2)
      for (const [dx, dy] of [
        [1, 1],
        [-1, 1],
        [1, -1],
        [-1, -1],
      ])
        pc.line(5, 5, 5 + dx * (len - 2), 5 + dy * (len - 2), P.flashMid);
    return pc;
  });
  sheet(scene, 'spark', sparks, 11, 11);
  anim(scene, 'spark', 'spark', [0, 1, 2, 3], 30, 0);

  // explosion
  const R = rng(42);
  const boom = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
    const pc = new PixelCanvas(48, 48);
    const t = i / 7;
    const rad = 6 + Math.sin(Math.min(1, t * 1.6) * Math.PI * 0.5) * 16;
    const cols = [P.white, P.flash, P.flashMid, P.fire, P.fireDark, P.smoke, P.smokeDark, P.smokeDark];
    const blobs = 7;
    for (let b = 0; b < blobs; b++) {
      const a = (b / blobs) * Math.PI * 2 + R();
      const d = rad * 0.45;
      const br = rad * (0.45 + R() * 0.25);
      const outer = i < 5 ? cols[Math.min(7, i + 2)] : cols[Math.min(7, i)];
      pc.circle(24 + Math.cos(a) * d, 24 + Math.sin(a) * d - t * 4, br, outer);
    }
    if (i < 5) pc.circle(24, 24 - t * 4, rad * 0.55, cols[Math.min(7, i + 1)]);
    if (i < 3) pc.circle(24, 24, rad * 0.3, cols[i]);
    if (i >= 5) {
      // dissolve
      for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) if (R() < (i - 4) * 0.22) pc.set(x, y, null);
    }
    return pc;
  });
  sheet(scene, 'boom', boom, 48, 48);
  anim(scene, 'boom', 'boom', [0, 1, 2, 3, 4, 5, 6, 7], 18, 0);

  const smoke = [0, 1, 2, 3].map((i) => {
    const pc = new PixelCanvas(12, 12);
    pc.circle(6, 6, 5 - i, i < 2 ? P.smoke : P.smokeDark);
    pc.circle(5, 5, 2 - i * 0.5, P.metalLight);
    return pc;
  });
  sheet(scene, 'smoke', smoke, 12, 12);
  anim(scene, 'smoke', 'smoke', [0, 1, 2, 3], 8, 0);

  const dust = [0, 1, 2, 3].map((i) => {
    const pc = new PixelCanvas(14, 7);
    const c = i < 2 ? '#c8b090' : '#a08a70';
    pc.ellipse(4 - i * 0.5, 4, 2.5 - i * 0.4, 2 - i * 0.3, c);
    pc.ellipse(9 + i * 0.5, 4, 2.5 - i * 0.4, 2 - i * 0.3, c);
    return pc;
  });
  sheet(scene, 'dust', dust, 14, 7);
  anim(scene, 'dust', 'dust', [0, 1, 2, 3], 14, 0);

  const casing = new PixelCanvas(3, 2);
  casing.rect(0, 0, 3, 2, P.brass).set(2, 0, P.flash).set(0, 1, P.brassShade);
  image(scene, 'casing', casing);
  const shell = new PixelCanvas(4, 2);
  shell.rect(0, 0, 3, 2, P.red).rect(3, 0, 1, 2, P.brass);
  image(scene, 'shell', shell);

  // knife slash arc
  const slash = [0, 1, 2].map((i) => {
    const pc = new PixelCanvas(26, 26);
    const r = 10 + i;
    for (let a = -70; a <= 70; a += 2) {
      const rad = (a * Math.PI) / 180;
      const thick = i === 2 ? 1 : Math.round(3 * Math.cos(rad));
      for (let k = 0; k < Math.max(1, thick); k++) {
        pc.set(3 + Math.cos(rad) * (r - k), 13 + Math.sin(rad) * (r - k), k === 0 ? P.white : '#a8e0ff');
      }
    }
    return pc;
  });
  sheet(scene, 'slash', slash, 26, 26);
  anim(scene, 'slash', 'slash', [0, 1, 2], 24, 0);

  const nade = new PixelCanvas(6, 6);
  nade.circle(2.5, 3, 2.3, '#4c6a3a').set(1, 2, '#7a9a5a').rect(2, 0, 2, 1, P.metalLight);
  nade.outline(P.ink);
  const nadeHot = nade.clone().replace('#4c6a3a', P.visor).replace('#7a9a5a', P.flashOut);
  sheet(scene, 'grenade', [nade, nadeHot], 6, 6);

  const shellM = new PixelCanvas(7, 11);
  shellM.rect(2, 0, 3, 7, '#4c5a40').set(3, 0, '#6a7a58').rect(1, 0, 5, 2, P.metalShade).line(2, 7, 3, 9, P.metalDark).line(4, 7, 3, 9, P.metalDark).set(3, 8, P.metalDark);
  shellM.outline(P.ink);
  image(scene, 'mortar', shellM);

  const mark = [0, 1].map((i) => {
    const pc = new PixelCanvas(20, 6);
    const c = i ? P.visor : P.flashOut;
    pc.hline(0, 4, 5, c).vline(0, 3, 5, c).hline(15, 19, 5, c).vline(19, 3, 5, c);
    pc.rect(9, 2, 2, 2, c);
    return pc;
  });
  sheet(scene, 'target', mark, 20, 6);
  anim(scene, 'target', 'target', [0, 1], 10);

  const wave = [0, 1].map((i) => {
    const pc = new PixelCanvas(16, 14);
    pc.ellipse(8, 10, 7, 4 + i, '#c8b090').ellipse(8, 9, 5, 3 + i, P.flashMid).ellipse(8, 9, 2, 2, P.white);
    for (let x = 0; x < 16; x++) pc.set(x, 13, null);
    pc.outline(P.ink);
    return pc;
  });
  sheet(scene, 'shockwave', wave, 16, 14);
  anim(scene, 'shockwave', 'shockwave', [0, 1], 16);

  const alert = new PixelCanvas(5, 11);
  alert.rect(1, 0, 3, 6, P.hazard).rect(1, 8, 3, 2, P.hazard).hline(1, 3, 0, '#fff090');
  alert.outline(P.ink);
  image(scene, 'alert', alert);

  const debris = [P.wood, P.metalShade, P.red].map((c) => {
    const pc = new PixelCanvas(5, 2);
    pc.rect(0, 0, 5, 2, c).set(0, 0, P.ink);
    return pc;
  });
  sheet(scene, 'debris', debris, 5, 2);
}

// ---------------------------------------------------------------- pickups & props & decor

function buildPickups(scene: Phaser.Scene): void {
  const scrap = new PixelCanvas(11, 11);
  scrap.circle(5, 5, 4, P.metal).circle(5, 5, 1.5, P.metalDark);
  for (const [x, y] of [
    [5, 0],
    [5, 10],
    [0, 5],
    [10, 5],
    [1, 1],
    [9, 9],
    [1, 9],
    [9, 1],
  ])
    scrap.set(x, y, P.metal);
  scrap.set(3, 3, P.metalLight).outline(P.ink);
  image(scene, 'pk_scrap', scrap);

  const wire = new PixelCanvas(11, 11);
  wire.ring(5, 5, 4, '#d07a3a', 2).ring(5, 5, 2, '#a8582a').set(2, 2, '#f0a060').hline(7, 10, 8, '#d07a3a');
  wire.outline(P.ink);
  image(scene, 'pk_wire', wire);

  const alloy = new PixelCanvas(11, 12);
  alloy.pattern(1, 0, ['...##...', '..#aa#..', '.#aaab#.', '#aaabbb#', '#aabbbb#', '.#abbb#.', '..#bb#..', '...##...'], {
    '#': P.hexAccent,
    a: '#e8a0ff',
    b: '#9a40c8',
  });
  alloy.outline(P.ink);
  image(scene, 'pk_alloy', alloy);

  const ration = new PixelCanvas(10, 10);
  ration.rect(1, 2, 8, 7, P.metalLight).rect(1, 4, 8, 3, P.red).hline(1, 8, 2, P.white).rect(4, 5, 2, 1, P.white);
  ration.vline(1, 2, 8, P.metal).outline(P.ink);
  image(scene, 'pk_ration', ration);

  // explosive barrel
  const barrel = new PixelCanvas(14, 18);
  barrel.rect(1, 1, 12, 17, P.red).vline(1, 1, 17, P.redShade).vline(2, 1, 17, P.redShade).vline(10, 1, 17, P.redLight);
  barrel.hline(1, 12, 4, P.redShade).hline(1, 12, 13, P.redShade).hline(1, 12, 1, P.metalShade);
  barrel.rect(5, 7, 5, 4, P.hazard).set(7, 8, P.ink).set(7, 9, P.ink);
  barrel.outline(P.ink);
  image(scene, 'barrel', barrel);

  // hexcorp supply crate
  const crate = new PixelCanvas(18, 15);
  crate.rect(1, 1, 16, 14, P.hexArmor).rect(1, 1, 16, 2, P.hexArmorLight).vline(1, 1, 14, P.hexArmorShade);
  crate.rect(1, 13, 16, 2, P.hexArmorShade).rect(3, 4, 12, 7, P.hexSuit);
  crate.pattern(6, 5, ['.##.', '#..#', '#..#', '.##.'], { '#': P.hexAccent });
  crate.set(1, 1, P.metalLight).set(16, 1, P.metalLight).outline(P.ink);
  image(scene, 'supply', crate);
}

function buildDecor(scene: Phaser.Scene): void {
  const R = rng(7);

  // jungle tree
  const tree = new PixelCanvas(60, 90);
  tree.rect(27, 30, 7, 60, P.trunk).rect(27, 30, 2, 60, P.trunkShade).vline(32, 32, 88, '#7a5640');
  tree.line(27, 89, 20, 89, P.trunk, 2).line(33, 89, 40, 89, P.trunk, 2).line(29, 60, 22, 48, P.trunk, 2);
  for (let y = 34; y < 88; y += 7) tree.set(30 + (y % 3), y, P.trunkShade);
  const blobs: [number, number, number, number][] = [
    [30, 24, 23, 14],
    [15, 32, 13, 9],
    [45, 30, 13, 9],
    [30, 12, 15, 10],
    [21, 48, 7, 5],
  ];
  for (const [x, y, rx, ry] of blobs) tree.ellipse(x, y, rx, ry, P.leafShade);
  for (const [x, y, rx, ry] of blobs) tree.ellipse(x - 2, y - 2, rx - 3, ry - 3, P.leaf);
  for (const [x, y, rx, ry] of blobs) tree.ellipse(x - 4, y - 4, rx * 0.4, ry * 0.35, P.leafLight);
  for (let i = 0; i < 60; i++) {
    const x = Math.floor(R() * 60);
    const y = Math.floor(R() * 50);
    if (tree.get(x, y) === P.leaf) tree.set(x, y, P.leafShade);
  }
  tree.outline(P.ink);
  image(scene, 'd_tree', tree);

  const bush = new PixelCanvas(26, 14);
  bush.ellipse(13, 10, 12, 6, P.leafShade).ellipse(10, 8, 8, 5, P.leaf).ellipse(18, 9, 6, 4, P.leaf).ellipse(8, 6, 3, 2, P.leafLight).ellipse(17, 7, 2, 1, P.leafLight);
  for (let x = 0; x < 26; x++) bush.set(x, 13, null);
  bush.outline(P.ink);
  image(scene, 'd_bush', bush);

  const fern = new PixelCanvas(20, 14);
  for (const [ex, ey, c] of [
    [1, 4, P.leafShade],
    [5, 0, P.leaf],
    [10, 0, P.leafLight],
    [15, 1, P.leaf],
    [19, 5, P.leafShade],
  ] as [number, number, string][]) {
    fern.line(10, 13, ex, ey, c);
    fern.line(10, 12, ex + (ex < 10 ? 1 : -1), ey + 1, c);
  }
  fern.outline(P.ink);
  image(scene, 'd_fern', fern);

  const bags = new PixelCanvas(28, 13);
  const bag = (x: number, y: number) => {
    bags.rect(x, y, 9, 5, '#b09a6a').hline(x, x + 8, y, '#c8b484').hline(x, x + 8, y + 4, '#8a7650').set(x, y, null).set(x + 8, y, null);
  };
  bag(1, 8);
  bag(10, 8);
  bag(19, 8);
  bag(5, 3);
  bag(14, 3);
  bags.outline(P.ink);
  image(scene, 'd_sandbags', bags);

  const lamp = new PixelCanvas(12, 44);
  lamp.rect(5, 6, 2, 38, P.metalDark).rect(3, 42, 6, 2, P.metalDark).rect(2, 3, 8, 3, P.metalShade).hline(3, 8, 6, P.flash).hline(4, 7, 7, P.flashMid);
  lamp.outline(P.ink);
  image(scene, 'd_lamp', lamp);

  const sign = new PixelCanvas(16, 22);
  sign.rect(7, 10, 2, 12, P.trunk).rect(1, 1, 14, 10, P.hazard).rect(1, 1, 14, 1, '#fff090').rect(7, 3, 2, 4, P.ink).rect(7, 8, 2, 1, P.ink);
  sign.outline(P.ink);
  image(scene, 'd_sign', sign);

  const wire = new PixelCanvas(28, 12);
  wire.rect(1, 2, 2, 10, P.trunk).rect(25, 2, 2, 10, P.trunk);
  for (let x = 2; x < 26; x += 2) {
    wire.set(x, 3 + ((x / 2) % 2), P.metalLight).set(x + 1, 4 - ((x / 2) % 2), P.metal);
    wire.set(x, 7 + ((x / 2) % 2), P.metalLight).set(x + 1, 8 - ((x / 2) % 2), P.metal);
  }
  wire.outline(P.ink);
  image(scene, 'd_wire', wire);

  const rock = new PixelCanvas(16, 10);
  rock.ellipse(8, 6, 7, 4, P.rockShade).ellipse(7, 5, 5, 3, P.rock).set(5, 3, P.concreteLight);
  for (let x = 0; x < 16; x++) rock.set(x, 9, null);
  rock.outline(P.ink);
  image(scene, 'd_rock', rock);

  // checkpoint beacon
  const beacon = [0, 1].map((on) => {
    const pc = new PixelCanvas(14, 30);
    pc.rect(2, 2, 2, 28, P.metalShade).rect(1, 27, 4, 3, P.metalDark);
    const c = on ? P.hpGood : P.smoke;
    pc.rect(4, 3, 9, 6, c).hline(4, 12, 3, on ? '#a8f080' : P.metalLight);
    pc.rect(7, 5, 3, 2, on ? P.white : P.smokeDark);
    pc.rect(1, 0, 4, 2, on ? P.flash : P.smokeDark);
    pc.outline(P.ink);
    return pc;
  });
  sheet(scene, 'beacon', beacon, 14, 30);
}

function buildIcons(scene: Phaser.Scene): void {
  const life = new PixelCanvas(11, 11);
  life.rect(2, 2, 7, 7, P.skin).rect(2, 2, 2, 6, P.hair).hline(2, 8, 3, P.red).hline(2, 8, 4, P.red).set(7, 6, P.ink).set(1, 4, P.redShade).set(0, 5, P.red);
  life.outline(P.ink);
  image(scene, 'i_life', life);

  const check = [0, 1].map((on) => {
    const pc = new PixelCanvas(9, 9);
    pc.rect(1, 1, 7, 7, P.inkSoft).outline(P.uiDim);
    if (on) pc.line(2, 4, 4, 6, P.hpGood).line(4, 6, 8, 1, P.hpGood);
    return pc;
  });
  sheet(scene, 'i_check', check, 9, 9);

  const px = new PixelCanvas(1, 1);
  px.set(0, 0, '#ffffff');
  image(scene, 'px', px);
}

export function buildSprites(scene: Phaser.Scene): void {
  buildHumans(scene);

  sheet(scene, 'drone', [0, 1, 2].map(drawDrone), 24, 20);
  anim(scene, 'drone-fly', 'drone', [0, 1], 20);
  anim(scene, 'drone-charge', 'drone', [2, 1], 20);

  sheet(
    scene,
    'foreman',
    [
      drawForeman(0),
      drawForeman(0.25),
      drawForeman(0.5),
      drawForeman(0.75),
      drawForeman(0, { lean: 3, drop: 3, steam: true }), // 4 windup
      drawForeman(0.1, { lean: -2, drop: 4, stunned: true }), // 5 stunned
      drawForeman(0, { recoil: 2 }), // 6 fire
      drawForeman(0.6, { lean: 4, drop: 1 }), // 7 charge
    ],
    FOREMAN_W,
    FOREMAN_H,
  );
  anim(scene, 'foreman-walk', 'foreman', [0, 1, 2, 3], 6);
  anim(scene, 'foreman-idle', 'foreman', [0], 1);
  anim(scene, 'foreman-windup', 'foreman', [4], 1);
  anim(scene, 'foreman-stun', 'foreman', [5], 1);
  anim(scene, 'foreman-fire', 'foreman', [6, 0], 24);
  anim(scene, 'foreman-charge', 'foreman', [7, 1, 7, 3], 14);

  buildEffects(scene);
  buildPickups(scene);
  buildDecor(scene);
  buildIcons(scene);
}
