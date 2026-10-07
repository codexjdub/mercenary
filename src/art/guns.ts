import Phaser from 'phaser';
import { PixelCanvas } from './PixelCanvas';
import { P } from './palette';
import { BARRELS, GunBuild, RECEIVERS, buildKey } from '../data/gunParts';

// Composes a gun sprite from its parts. Each part is drawn relative to fixed
// mount points on the receiver, so any combination lines up.

export interface GunArt {
  key: string;
  w: number;
  h: number;
  grip: { x: number; y: number };
  muzzle: { x: number; y: number };
  eject: { x: number; y: number };
}

const W = 46;
const H = 18;
const GRIP = { x: 14, y: 10 };

const GM = '#4a5260'; // gunmetal
const GM_L = '#6e7888';
const GM_D = '#2e3440';
const POLY = '#2e2c34';
const POLY_L = '#46424e';
const WOOD = '#8a5a34';
const WOOD_L = '#aa7444';

const cache = new Map<string, GunArt>();

export function drawGun(b: GunBuild, hands = true): { pc: PixelCanvas; art: Omit<GunArt, 'key'> } {
  const pc = new PixelCanvas(W, H);
  const rec = RECEIVERS[b.receiver];
  const bar = BARRELS[b.barrel];
  const shotgun = rec.pellets > 1;
  const front = 23; // barrel mount x
  const L = bar.length + (shotgun ? 2 : 0);
  const muzzleX = front + L;
  const muzzleY = 7;

  // ---- stock (drawn first, sits behind receiver)
  switch (b.stock) {
    case 'wire':
      pc.line(10, 6, 4, 6, GM_D);
      pc.line(10, 9, 4, 8, GM_D);
      pc.rect(2, 5, 2, 5, POLY);
      break;
    case 'recoil':
      pc.rect(5, 6, 6, 2, GM_D);
      pc.rect(6, 8, 4, 1, GM);
      pc.rect(3, 5, 3, 6, POLY);
      pc.rect(2, 5, 1, 6, '#8a3a2a');
      pc.hline(3, 5, 5, POLY_L);
      break;
    case 'brace':
      pc.rect(4, 6, 7, 3, shotgun ? WOOD : POLY);
      pc.line(4, 9, 10, 9, shotgun ? WOOD : POLY);
      pc.rect(2, 5, 2, 6, POLY_L);
      pc.hline(4, 9, 6, shotgun ? WOOD_L : POLY_L);
      break;
    default:
      pc.rect(9, 6, 2, 3, GM_D);
  }

  // ---- barrel
  if (shotgun) {
    pc.rect(front, 6, L, 2, GM);
    pc.hline(front, front + L - 1, 6, GM_L);
  } else {
    const guard = Math.min(L, 6);
    pc.rect(front, 6, guard, 3, b.receiver === 'hornet' ? POLY : GM_D);
    pc.hline(front, front + guard - 1, 6, POLY_L);
    pc.rect(front + guard, 7, L - guard, 1, GM);
    pc.rect(front + guard, 6, L - guard, 1, GM_L);
    if (bar.id === 'longshot') pc.rect(muzzleX - 3, 5, 3, 4, GM_D); // muzzle brake
    if (bar.id === 'ported') {
      pc.rect(front + guard, 6, L - guard, 2, GM);
      for (let x = front + guard; x < muzzleX - 1; x += 2) pc.set(x, 6, GM_D);
      pc.hline(front + guard, muzzleX - 1, 8, GM_D);
    }
  }
  pc.set(muzzleX - 1, 7, GM_L);

  // ---- magazine
  if (shotgun) {
    const tubeLen = b.magazine === 'drum' ? L : Math.max(4, L - 2);
    pc.rect(front, 8, tubeLen, 2, GM_D);
    // pump grip
    pc.rect(front + 1, 8, 5, 3, WOOD);
    pc.hline(front + 1, front + 5, 8, WOOD_L);
    if (b.magazine === 'drum') pc.ellipse(19, 12, 3, 3, GM_D);
  } else {
    switch (b.magazine) {
      case 'box':
        pc.rect(18, 10, 3, 2, GM_D);
        pc.rect(19, 12, 3, 2, GM_D);
        pc.rect(20, 14, 3, 1, GM_D);
        pc.vline(18, 10, 11, GM);
        break;
      case 'tube':
        pc.rect(18, 10, 2, 5, GM_D);
        pc.set(18, 14, GM);
        break;
      case 'drum':
        pc.ellipse(19, 12, 3, 3, GM_D);
        pc.ring(19, 12, 2, GM);
        pc.set(19, 12, GM_L);
        break;
      case 'quick':
        pc.rect(18, 10, 3, 3, GM_D);
        pc.vline(18, 10, 12, GM);
        pc.set(20, 13, P.red).set(21, 13, P.red);
        break;
      case 'extended':
        pc.rect(18, 10, 3, 8, GM_D);
        pc.vline(18, 10, 17, GM);
        pc.hline(18, 20, 17, GM_L);
        break;
    }
  }

  // ---- receiver
  switch (b.receiver) {
    case 'mutt':
      pc.rect(11, 5, 12, 5, GM);
      pc.hline(11, 22, 5, GM_L);
      pc.hline(11, 22, 9, GM_D);
      pc.rect(16, 6, 3, 1, GM_D); // ejection port
      pc.rect(11, 7, 3, 1, P.olive);
      break;
    case 'brick':
      pc.rect(10, 5, 13, 5, GM);
      pc.hline(10, 22, 5, GM_L);
      pc.hline(10, 22, 9, GM_D);
      pc.rect(15, 6, 3, 2, GM_D);
      pc.set(21, 7, P.brass);
      break;
    case 'warden':
      pc.rect(10, 5, 13, 4, '#4e5a4a');
      pc.hline(10, 22, 5, '#6e7c66');
      pc.hline(10, 22, 8, GM_D);
      pc.rect(16, 4, 2, 1, GM_D); // bolt
      pc.set(17, 3, GM_L).set(18, 3, GM_L);
      pc.set(12, 6, P.brass);
      break;
    case 'riveter':
      pc.rect(9, 4, 15, 6, GM);
      pc.hline(9, 23, 4, GM_L);
      pc.hline(9, 23, 9, GM_D);
      pc.rect(13, 2, 7, 1, GM_D); // carry handle
      pc.vline(13, 2, 3, GM_D).vline(19, 2, 3, GM_D);
      pc.rect(15, 5, 5, 2, GM_D); // feed cover
      pc.set(22, 6, P.hazard).set(22, 7, P.hazard);
      break;
    case 'hornet':
      pc.rect(12, 5, 11, 4, GM);
      pc.hline(12, 22, 5, GM_L);
      pc.hline(12, 22, 8, GM_D);
      pc.hline(13, 21, 7, P.hazard);
      pc.rect(16, 6, 2, 1, GM_D);
      break;
  }
  // trigger guard
  pc.hline(15, 18, 11, GM_D);
  pc.set(18, 10, GM_D);

  // ---- grip
  const gripColor = b.receiver === 'brick' ? WOOD : POLY;
  if (b.receiver === 'hornet') {
    pc.rect(13, 9, 2, 5, gripColor);
  } else {
    pc.line(14, 10, 12, 14, gripColor, 2);
  }

  // ---- sight
  switch (b.sight) {
    case 'iron':
      pc.set(13, 4, GM_D).set(14, 4, GM_D);
      pc.set(muzzleX - 2, 5, GM_D);
      break;
    case 'dot':
      pc.rect(14, 3, 4, 2, GM_D);
      pc.set(17, 3, P.glass);
      pc.set(15, 4, P.visor);
      break;
    case 'laser':
      pc.rect(15, 3, 4, 2, GM_D);
      pc.set(18, 3, P.visor).set(18, 4, P.visorGlow);
      pc.set(13, 4, GM_D);
      break;
    case 'scope':
      pc.rect(12, 2, 8, 2, GM_D);
      pc.set(19, 2, P.glass).set(19, 3, P.glassShade);
      pc.set(12, 2, P.glassShade);
      pc.rect(15, 4, 2, 1, GM);
      break;
  }

  // ---- hands
  if (hands) {
  pc.rect(GRIP.x - 1, GRIP.y, 3, 3, P.skin);
  pc.set(GRIP.x - 1, GRIP.y + 2, P.skinShade);
  const supportX = shotgun ? front + 2 : front + 1;
  const supportY = shotgun ? 10 : 9;
  pc.rect(supportX, supportY, 3, 2, P.skin);
  pc.set(supportX, supportY + 1, P.skinShade);
  }

  pc.outline(P.ink);

  return {
    pc,
    art: { w: W, h: H, grip: GRIP, muzzle: { x: muzzleX, y: muzzleY }, eject: { x: 17, y: 6 } },
  };
}

/** Gun texture for a build. `hands: false` gives a clean version for menu previews. */
export function ensureGunTexture(scene: Phaser.Scene, b: GunBuild, hands = true): GunArt {
  const key = buildKey(b) + (hands ? '' : '_bare');
  const hit = cache.get(key);
  if (hit && scene.textures.exists(key)) return hit;
  const { pc, art } = drawGun(b, hands);
  if (!scene.textures.exists(key)) {
    const tex = scene.textures.createCanvas(key, W, H)!;
    pc.draw(tex.getContext(), 0, 0);
    tex.refresh();
  }
  const out = { key, ...art };
  cache.set(key, out);
  return out;
}

/**
 * Places a held gun so its grip sits on a humanoid frame's anchor pixel.
 * `left`/`top` are the 32x32 frame's top-left in world space. Mirrors the
 * origin when facing left so 90-degree aim rotations stay pixel-exact.
 */
export function attachGun(
  gun: Phaser.GameObjects.Image,
  art: GunArt,
  left: number,
  top: number,
  anchor: { x: number; y: number },
  facingRight: boolean,
): void {
  gun.setFlipX(!facingRight);
  gun.setOrigin(facingRight ? art.grip.x / art.w : (art.w - art.grip.x) / art.w, art.grip.y / art.h);
  gun.setPosition(left + (facingRight ? anchor.x : 32 - anchor.x), top + anchor.y);
}
