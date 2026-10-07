import { PixelCanvas } from './PixelCanvas';
import { P } from './palette';

// Procedural 32x32 humanoid rig. Every pose is described by a few joint
// positions, so one function draws the player, troopers, and hostages.
// Figures face right; the game flips them for left.

export const HF = 32; // frame size

export interface HumanStyle {
  skin: string;
  skinShade: string;
  hair: string;
  head: 'bandana' | 'helmet' | 'gasmask' | 'hardhat' | 'goggles';
  beard?: string;
  gear: string;
  gearShade: string;
  gearLight: string;
  shirt: string;
  shirtShade: string;
  vest?: string;
  vestShade?: string;
  vestLight?: string;
  pants: string;
  pantsShade: string;
  boots: string;
  bootsLight: string;
  belt: string;
  bulky?: boolean;
  backpack?: string;
  backpackShade?: string;
  emblem?: string;
  heldGun?: 'rifle' | 'launcher';
}

interface Pt {
  x: number;
  y: number;
}

export type ArmMode =
  | 'gun'
  | 'gunHigh'
  | 'knife'
  | 'throwBack'
  | 'throwFwd'
  | 'flail'
  | 'tied'
  | 'wave'
  | 'waveB'
  | 'eat'
  | 'none'
  | 'runA'
  | 'runB'
  | 'hammerUp'
  | 'hammerDown';

export interface Pose {
  drop?: number; // lowers upper body (crouch)
  lean?: number; // shifts upper body forward
  bob?: number; // small vertical offset (breathing, run bob)
  front: { knee: Pt; foot: Pt };
  back: { knee: Pt; foot: Pt };
  arms: ArmMode;
  tail?: number; // bandana flutter phase 0..2
  headBack?: number;
}

export interface HumanFrame {
  pc: PixelCanvas;
  /** Pixel where a separately-drawn gun's grip attaches. */
  anchor: Pt;
}

export const STYLE_ROOK: HumanStyle = {
  skin: P.skin,
  skinShade: P.skinShade,
  hair: P.hair,
  head: 'bandana',
  gear: P.red,
  gearShade: P.redShade,
  gearLight: P.redLight,
  shirt: P.shirt,
  shirtShade: '#1e1e2a',
  vest: P.olive,
  vestShade: P.oliveShade,
  vestLight: P.oliveLight,
  pants: P.khaki,
  pantsShade: P.khakiShade,
  boots: P.boot,
  bootsLight: P.bootLight,
  belt: P.belt,
};

export const STYLE_GRUNT: HumanStyle = {
  skin: P.skin,
  skinShade: P.skinShade,
  hair: P.hair,
  head: 'helmet',
  gear: P.hexArmor,
  gearShade: P.hexArmorShade,
  gearLight: P.hexArmorLight,
  shirt: P.hexSuit,
  shirtShade: P.hexSuitShade,
  vest: P.hexArmor,
  vestShade: P.hexArmorShade,
  vestLight: P.hexArmorLight,
  pants: P.hexSuit,
  pantsShade: P.hexSuitShade,
  boots: P.black,
  bootsLight: P.inkSoft,
  belt: P.inkSoft,
  emblem: P.hexAccent,
  heldGun: 'rifle',
};

export const STYLE_GRENADIER: HumanStyle = {
  ...STYLE_GRUNT,
  head: 'gasmask',
  gear: '#5c6a4e',
  gearShade: '#424e38',
  gearLight: '#7a8a66',
  vest: '#5c6a4e',
  vestShade: '#424e38',
  vestLight: '#7a8a66',
  bulky: true,
  backpack: '#4a4664',
  backpackShade: '#33304a',
  heldGun: 'launcher',
};

/** Brass, the camp gunsmith. */
export const STYLE_BRASS: HumanStyle = {
  skin: '#c8865a',
  skinShade: '#9a6040',
  hair: '#b8b4ac',
  head: 'goggles',
  beard: '#d0ccc4',
  gear: '#5a4a3a',
  gearShade: '#3e3226',
  gearLight: '#7a6650',
  shirt: '#d8cfc0',
  shirtShade: '#aaa094',
  vest: '#7a4e2e',
  vestShade: '#5a3620',
  vestLight: '#9a6a42',
  pants: '#4a4e5e',
  pantsShade: '#34384a',
  boots: '#2e2420',
  bootsLight: '#4a3a32',
  belt: '#3e2a1e',
  bulky: true,
};

export const STYLE_HOSTAGE: HumanStyle = {
  skin: '#c88a5e',
  skinShade: '#9a6440',
  hair: '#1e1610',
  head: 'hardhat',
  gear: P.hardhat,
  gearShade: '#c09a20',
  gearLight: '#fff090',
  shirt: '#e8e0d0',
  shirtShade: '#b8b0a0',
  vest: P.overall,
  vestShade: P.overallShade,
  vestLight: '#5a8ad8',
  pants: P.overall,
  pantsShade: P.overallShade,
  boots: '#5a3a24',
  bootsLight: '#7a5434',
  belt: P.overallShade,
};

const leg = (kx: number, ky: number, fx: number, fy: number) => ({ knee: { x: kx, y: ky }, foot: { x: fx, y: fy } });

export const POSE_STAND: Pose = {
  front: leg(17, 25, 18, 29),
  back: leg(15, 25, 14, 29),
  arms: 'gun',
};

/** Run-cycle legs at phase 0..1. */
export function runLegs(phase: number): Pick<Pose, 'front' | 'back' | 'bob'> {
  const one = (p: number, hipX: number) => {
    const a = p * Math.PI * 2;
    const sw = Math.cos(a);
    const lift = Math.sin(a) < 0 ? -Math.sin(a) : 0;
    const fx = hipX + Math.round(sw * 5);
    const fy = 29 - Math.round(lift * 3.2);
    const kx = Math.round((hipX + fx) / 2 + 1 + lift * 1.5);
    const ky = Math.round(25 - lift * 1.6);
    return { knee: { x: kx, y: ky }, foot: { x: fx, y: fy } };
  };
  const bob = -Math.round(Math.abs(Math.sin(phase * Math.PI * 2)));
  return { front: one(phase, 17), back: one(phase + 0.5, 15), bob };
}

export function drawHuman(style: HumanStyle, pose: Pose): HumanFrame {
  const pc = new PixelCanvas(HF, HF);
  const drop = pose.drop ?? 0;
  const lean = pose.lean ?? 0;
  const bob = pose.bob ?? 0;
  const hipY = 21 + drop + bob;
  const torsoTop = 13 + drop + bob;
  const headTop = 5 + drop + bob + (pose.headBack ? 1 : 0);
  const headX = 13 + lean - (pose.headBack ?? 0);
  const tl = (style.bulky ? 12 : 13) + lean;
  const tr = (style.bulky ? 19 : 18) + lean;
  const shoulderF = { x: 16 + lean, y: torsoTop + 1 };
  const shoulderB = { x: 14 + lean, y: torsoTop + 1 };
  let anchor = pose.arms === 'gunHigh' ? { x: 19 + lean, y: torsoTop } : { x: 19 + lean, y: torsoTop + 4 };

  const sleeve = style.vest ? style.shirt : style.shirt;

  // ---- back arm (behind body)
  const backArm = (hx: number, hy: number, ex?: number, ey?: number) => {
    if (ex !== undefined && ey !== undefined) {
      pc.line(shoulderB.x, shoulderB.y, ex, ey, style.shirtShade, 2);
      pc.line(ex, ey, hx, hy, style.skinShade, 2);
    } else {
      pc.line(shoulderB.x, shoulderB.y, hx, hy, style.shirtShade, 2);
    }
    pc.rect(hx, hy, 2, 2, style.skinShade);
  };
  switch (pose.arms) {
    case 'gun':
      backArm(18 + lean, torsoTop + 3);
      break;
    case 'gunHigh':
      backArm(18 + lean, torsoTop, 16 + lean, torsoTop + 3);
      break;
    case 'flail':
      backArm(11 + lean, torsoTop - 5, 12 + lean, torsoTop - 1);
      break;
    case 'runA':
      backArm(12 + lean, torsoTop + 6, 13 + lean, torsoTop + 4);
      break;
    case 'runB':
      backArm(18 + lean, torsoTop + 5, 16 + lean, torsoTop + 5);
      break;
    case 'none':
    case 'wave':
    case 'waveB':
      backArm(14 + lean, torsoTop + 6);
      break;
    default:
      break;
  }

  // ---- back leg
  const drawLeg = (hipX: number, l: { knee: Pt; foot: Pt }, pants: string, boots: string, bootLight: string) => {
    pc.line(hipX, hipY, l.knee.x, l.knee.y, pants, 3);
    pc.line(l.knee.x, l.knee.y, l.foot.x, l.foot.y, pants, 3);
    pc.rect(l.foot.x - 1, l.foot.y + 1, 4, 2, boots);
    pc.hline(l.foot.x - 1, l.foot.x + 1, l.foot.y + 1, bootLight);
  };
  drawLeg(15 + lean, pose.back, style.pantsShade, style.boots, style.boots);

  // ---- backpack
  if (style.backpack) {
    pc.rect(tl - 4, torsoTop + 1, 4, 7, style.backpack);
    pc.vline(tl - 4, torsoTop + 1, torsoTop + 7, style.backpackShade!);
    pc.rect(tl - 3, torsoTop - 1, 2, 2, P.metalShade);
    // strapped grenades
    pc.set(tl - 3, torsoTop + 3, '#4c6a3a').set(tl - 3, torsoTop + 5, '#4c6a3a');
  }

  // ---- torso
  pc.rect(tl, torsoTop, tr - tl + 1, hipY - torsoTop, style.shirt);
  pc.vline(tl, torsoTop, hipY - 1, style.shirtShade);
  if (style.vest) {
    pc.rect(tl, torsoTop + 1, tr - tl + 1, hipY - torsoTop - 2, style.vest);
    pc.vline(tl, torsoTop + 1, hipY - 2, style.vestShade!);
    pc.hline(tl + 1, tr, torsoTop + 1, style.vestLight!);
    pc.rect(tr - 2, torsoTop + 4, 2, 2, style.vestShade!);
    if (style.head === 'hardhat') {
      // overall straps
      pc.vline(tl + 2, torsoTop, torsoTop + 2, style.vestShade!);
      pc.vline(tr - 1, torsoTop, torsoTop + 2, style.vestShade!);
    }
  }
  if (style.emblem) {
    const cx = Math.round((tl + tr) / 2);
    pc.set(cx, torsoTop + 3, style.emblem).set(cx - 1, torsoTop + 4, style.emblem).set(cx + 1, torsoTop + 4, style.emblem);
    pc.set(cx, torsoTop + 5, style.emblem);
  }
  pc.hline(tl, tr, hipY - 1, style.belt);
  if (!style.emblem && style.head !== 'hardhat') pc.set(tr - 1, hipY - 1, P.brass);

  // ---- front leg
  drawLeg(17 + lean, pose.front, style.pants, style.boots, style.bootsLight);
  // hip joint cover so legs blend into torso
  pc.hline(tl + 1, tr - 1, hipY, style.pants);

  // ---- neck + head
  pc.rect(15 + lean, torsoTop - 1, 2, 1, style.skinShade);
  drawHead(pc, style, headX, headTop, pose.tail ?? 0);

  // ---- front arm
  const frontArm = (ex: number, ey: number, hx: number, hy: number) => {
    pc.line(shoulderF.x, shoulderF.y, ex, ey, sleeve, 2);
    pc.line(ex, ey, hx, hy, style.skin, 2);
    pc.rect(hx, hy, 2, 2, style.skin);
  };
  switch (pose.arms) {
    case 'gun':
      frontArm(16 + lean, torsoTop + 4, anchor.x - 1, anchor.y);
      if (style.heldGun) drawHeldGun(pc, style.heldGun, anchor.x, anchor.y);
      break;
    case 'gunHigh':
      frontArm(17 + lean, torsoTop + 3, anchor.x - 1, anchor.y);
      if (style.heldGun) drawHeldGun(pc, style.heldGun, anchor.x, anchor.y);
      break;
    case 'knife': {
      const hy = torsoTop + 2;
      frontArm(20 + lean, torsoTop + 2, 23 + lean, hy);
      pc.rect(25 + lean, hy, 5, 1, P.metalLight);
      pc.rect(25 + lean, hy + 1, 4, 1, P.metal);
      pc.set(30 + lean, hy, P.white);
      break;
    }
    case 'throwBack':
      frontArm(13 + lean, torsoTop - 1, 10 + lean, torsoTop - 4);
      pc.rect(9 + lean, torsoTop - 6, 3, 3, '#4c6a3a');
      pc.set(10 + lean, torsoTop - 7, P.metalLight);
      break;
    case 'throwFwd':
      frontArm(20 + lean, torsoTop, 23 + lean, torsoTop - 2);
      break;
    case 'flail':
      frontArm(18 + lean, torsoTop - 1, 20 + lean, torsoTop - 5);
      break;
    case 'tied':
      pc.hline(tl - 1, tr + 1, torsoTop + 2, P.rope);
      pc.hline(tl - 1, tr + 1, torsoTop + 5, P.rope);
      pc.set(tl - 2, torsoTop + 3, P.rope).set(tl - 2, torsoTop + 4, P.rope);
      break;
    case 'wave':
      frontArm(19 + lean, torsoTop, 19 + lean, torsoTop - 5);
      break;
    case 'waveB':
      frontArm(19 + lean, torsoTop, 21 + lean, torsoTop - 4);
      break;
    case 'eat':
      frontArm(18 + lean, torsoTop + 5, 18 + lean, headTop + 5);
      pc.rect(19 + lean, headTop + 4, 3, 3, P.metalLight);
      pc.hline(19 + lean, 21 + lean, headTop + 4, P.red);
      break;
    case 'runA':
      frontArm(18 + lean, torsoTop + 4, 20 + lean, torsoTop + 4);
      break;
    case 'runB':
      frontArm(15 + lean, torsoTop + 5, 13 + lean, torsoTop + 6);
      break;
    case 'none':
      frontArm(16 + lean, torsoTop + 4, 17 + lean, torsoTop + 6);
      break;
    case 'hammerUp': {
      frontArm(19 + lean, torsoTop, 20 + lean, torsoTop - 4);
      pc.vline(21 + lean, torsoTop - 8, torsoTop - 3, P.trunk);
      pc.rect(19 + lean, torsoTop - 10, 5, 3, P.metal);
      pc.hline(19 + lean, 23 + lean, torsoTop - 10, P.metalLight);
      break;
    }
    case 'hammerDown': {
      frontArm(19 + lean, torsoTop + 3, 22 + lean, torsoTop + 5);
      pc.hline(23 + lean, 27 + lean, torsoTop + 5, P.trunk);
      pc.rect(27 + lean, torsoTop + 3, 3, 5, P.metal);
      pc.vline(27 + lean, torsoTop + 3, torsoTop + 7, P.metalLight);
      break;
    }
  }

  pc.outline(P.ink);
  anchor = { x: anchor.x, y: anchor.y };
  return { pc, anchor };
}

function drawHead(pc: PixelCanvas, s: HumanStyle, x: number, top: number, tail: number) {
  // base skull
  pc.rect(x, top, 7, 7, s.skin);
  pc.rect(x, top, 2, 6, s.hair); // back of head
  pc.hline(x + 2, x + 6, top + 6, s.skinShade); // jaw
  pc.set(x + 3, top + 3, s.skinShade); // ear
  pc.set(x + 5, top + 3, P.ink); // eye
  pc.set(x + 6, top + 4, s.skinShade); // nose shade

  switch (s.head) {
    case 'bandana': {
      pc.hline(x, x + 6, top, s.hair);
      pc.hline(x, x + 6, top + 1, s.gear);
      pc.hline(x, x + 6, top + 2, s.gear);
      pc.hline(x + 1, x + 5, top + 1, s.gearLight);
      pc.set(x - 1, top + 2, s.gearShade);
      // fluttering tails
      const f = tail % 2;
      pc.line(x - 1, top + 2, x - 4, top + 2 + f, s.gear);
      pc.line(x - 1, top + 3, x - 3, top + 4 + (1 - f), s.gearShade);
      pc.set(x + 6, top + 6, s.skinShade); // stubble
      break;
    }
    case 'helmet': {
      pc.ellipse(x + 3, top + 1, 4, 3, s.gear);
      pc.hline(x - 1, x + 7, top + 3, s.gearShade);
      pc.hline(x + 1, x + 4, top - 1, s.gearLight);
      // visor
      pc.hline(x + 3, x + 7, top + 3, P.visor);
      pc.set(x + 6, top + 3, P.visorGlow);
      // balaclava
      pc.rect(x + 1, top + 4, 6, 3, s.shirt);
      pc.rect(x, top + 4, 1, 3, s.shirtShade);
      // antenna
      pc.line(x, top - 1, x - 2, top - 4, P.metalShade);
      pc.set(x - 2, top - 5, P.visor);
      break;
    }
    case 'gasmask': {
      pc.ellipse(x + 3, top + 1, 4, 3, s.gear);
      pc.hline(x - 1, x + 7, top + 3, s.gearShade);
      pc.hline(x + 1, x + 4, top - 1, s.gearLight);
      pc.rect(x + 1, top + 4, 6, 3, P.metalDark);
      pc.set(x + 5, top + 4, P.visor).set(x + 6, top + 4, P.visorGlow);
      pc.rect(x + 6, top + 5, 2, 2, P.metal);
      pc.set(x + 7, top + 6, P.metalShade);
      break;
    }
    case 'goggles': {
      pc.hline(x, x + 6, top, s.hair);
      pc.rect(x, top - 1, 6, 1, s.hair);
      pc.hline(x, x + 6, top + 1, s.gear);
      pc.rect(x + 4, top, 3, 2, P.metalDark);
      pc.set(x + 5, top + 1, P.glass).set(x + 6, top + 1, P.glassShade);
      if (s.beard) {
        pc.rect(x + 3, top + 5, 4, 2, s.beard);
        pc.set(x + 6, top + 4, s.beard).set(x + 4, top + 7, s.beard).set(x + 5, top + 7, s.beard);
        pc.set(x + 6, top + 5, s.skinShade); // mouth
      }
      pc.set(x + 5, top + 2, s.hair); // bushy brow
      break;
    }
    case 'hardhat': {
      pc.ellipse(x + 3, top, 4, 2, s.gear);
      pc.hline(x - 1, x + 8, top + 2, s.gearShade);
      pc.hline(x + 2, x + 4, top - 1, s.gearLight);
      pc.set(x + 6, top + 6, s.skinShade);
      break;
    }
  }
}

/** Small enemy weapons baked into trooper sprites. */
function drawHeldGun(pc: PixelCanvas, kind: 'rifle' | 'launcher', ax: number, ay: number) {
  if (kind === 'rifle') {
    pc.rect(ax - 3, ay - 1, 9, 3, P.metalDark);
    pc.hline(ax - 3, ax + 5, ay - 1, P.metalShade);
    pc.rect(ax + 6, ay, 5, 1, P.metalShade);
    pc.rect(ax + 1, ay + 2, 2, 3, P.metalDark); // mag
    pc.rect(ax - 6, ay, 3, 2, P.hexArmorShade); // stock
    pc.set(ax + 2, ay - 2, P.visor);
    pc.rect(ax, ay + 1, 2, 2, P.skin);
  } else {
    pc.rect(ax - 4, ay - 2, 12, 4, '#4c5a40');
    pc.hline(ax - 4, ax + 7, ay - 2, '#6a7a58');
    pc.rect(ax + 8, ay - 3, 2, 6, P.metalDark);
    pc.rect(ax - 1, ay + 2, 2, 3, P.metalDark);
    pc.rect(ax, ay + 1, 2, 2, P.skin);
  }
}

/** A lying-down version of a figure, for death frames. */
export function drawDowned(style: HumanStyle): PixelCanvas {
  const stand = drawHuman(style, { ...POSE_STAND, arms: 'flail', headBack: 1 }).pc;
  const rot = stand.rotateCCW();
  // find bounds and drop the figure onto the floor of the frame
  let minX = HF;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < HF; y++)
    for (let x = 0; x < HF; x++)
      if (rot.get(x, y) !== null) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
  const dx = Math.round((HF - (maxX - minX + 1)) / 2) - minX;
  return rot.shifted(dx, HF - 1 - maxY);
}
