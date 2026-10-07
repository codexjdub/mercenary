// Modular gun parts. A gun is one part from each slot; final stats are derived
// from the combination. Parts with a `cost` must be crafted at the gunsmith.

import type { Material } from '../game/Mission';
import { PLAYER } from '../constants';

export type FireMode = 'auto' | 'semi';
export type BulletKind = 'tracer' | 'pellet' | 'needle' | 'slug';
export type Slot = 'receiver' | 'barrel' | 'magazine' | 'stock' | 'sight';
export type Cost = Partial<Record<Material, number>>;

interface PartBase {
  id: string;
  name: string;
  desc: string;
  cost?: Cost;
}

export interface Receiver extends PartBase {
  callsign: string;
  mode: FireMode;
  damage: number;
  rate: number; // shots per second
  pellets: number;
  spread: number; // degrees
  speed: number; // px/s
  range: number; // px
  bullet: BulletKind;
  pierce: number; // extra targets a bullet passes through
  weight: number;
  shake: number;
}

export interface Barrel extends PartBase {
  tag: string;
  damageMul: number;
  spreadAdd: number;
  rangeMul: number;
  speedMul: number;
  length: number; // art length in px
  weight: number;
}

export interface Magazine extends PartBase {
  tag: string;
  capacity: number;
  capacityShotgun: number;
  reload: number; // seconds
  sweetStart: number; // 0..1 along the reload bar
  sweetWidth: number;
  weight: number;
}

export interface Stock extends PartBase {
  spreadMul: number;
  weight: number;
}

export interface Sight extends PartBase {
  spreadMul: number;
  rangeMul: number;
  weight: number;
}

export const RECEIVERS: Record<string, Receiver> = {
  mutt: { id: 'mutt', name: 'MUTT-7', callsign: 'WORKHORSE', desc: 'RELIABLE AUTO RIFLE. DOES EVERYTHING OKAY.', mode: 'auto', damage: 12, rate: 8, pellets: 1, spread: 3, speed: 430, range: 260, bullet: 'tracer', pierce: 0, weight: 3, shake: 0.6 },
  brick: { id: 'brick', name: 'BRICK-12', callsign: 'DOORKICKER', desc: 'PUMP SHOTGUN. SIX PELLETS OF BAD NEWS UP CLOSE.', mode: 'semi', damage: 9, rate: 1.7, pellets: 6, spread: 15, speed: 380, range: 140, bullet: 'pellet', pierce: 0, weight: 4, shake: 2.2 },
  hornet: { id: 'hornet', name: 'HORNET', callsign: 'BUZZSAW', desc: 'BUZZING SMG. WEAK HITS, ENDLESS STREAM.', mode: 'auto', damage: 6.5, rate: 14, pellets: 1, spread: 7, speed: 400, range: 200, bullet: 'needle', pierce: 0, weight: 2, shake: 0.35 },
  warden: { id: 'warden', name: 'WARDEN', callsign: 'WARDEN', desc: 'MARKSMAN ACTION. SLUGS PUNCH THROUGH A TARGET.', mode: 'semi', damage: 34, rate: 2.6, pellets: 1, spread: 0.8, speed: 600, range: 400, bullet: 'slug', pierce: 1, weight: 3.5, shake: 1.4, cost: { scrap: 14, wire: 6, alloy: 2 } },
  riveter: { id: 'riveter', name: 'RIVETER', callsign: 'RIVETER', desc: 'HEAVY BELT GUN. HOSES LEAD, SLOWS YOU DOWN.', mode: 'auto', damage: 10, rate: 10.5, pellets: 1, spread: 6, speed: 420, range: 250, bullet: 'tracer', pierce: 0, weight: 5.5, shake: 0.8, cost: { scrap: 16, wire: 8, alloy: 3 } },
};

export const BARRELS: Record<string, Barrel> = {
  stub: { id: 'stub', name: 'STUB BARREL', tag: 'CQ', desc: 'SHORT AND LIGHT. LOOSER GROUPING.', damageMul: 0.92, spreadAdd: 2, rangeMul: 0.8, speedMul: 0.95, length: 5, weight: 0 },
  field: { id: 'field', name: 'FIELD BARREL', tag: '', desc: 'STANDARD ISSUE. NO SURPRISES.', damageMul: 1, spreadAdd: 0, rangeMul: 1, speedMul: 1, length: 9, weight: 1 },
  longshot: { id: 'longshot', name: 'LONGSHOT', tag: 'LR', desc: 'LONG BARREL. HITS HARDER AND FARTHER.', damageMul: 1.15, spreadAdd: -1.5, rangeMul: 1.35, speedMul: 1.2, length: 13, weight: 2, cost: { scrap: 8, wire: 3 } },
  ported: { id: 'ported', name: 'PORTED BARREL', tag: 'P', desc: 'VENTED TO TAME MUZZLE CLIMB. TIGHT SPREAD.', damageMul: 1.05, spreadAdd: -2.5, rangeMul: 1.1, speedMul: 1.05, length: 11, weight: 1.5, cost: { scrap: 10, wire: 4, alloy: 1 } },
};

export const MAGAZINES: Record<string, Magazine> = {
  box: { id: 'box', name: 'BOX MAG', tag: '', desc: 'BALANCED CAPACITY AND RELOAD.', capacity: 24, capacityShotgun: 6, reload: 1.4, sweetStart: 0.42, sweetWidth: 0.16, weight: 1 },
  tube: { id: 'tube', name: 'TUBE MAG', tag: '', desc: 'FORGIVING RELOAD WINDOW.', capacity: 16, capacityShotgun: 7, reload: 1.6, sweetStart: 0.55, sweetWidth: 0.17, weight: 1 },
  drum: { id: 'drum', name: 'DRUM MAG', tag: 'D', desc: 'HUGE CAPACITY. SLOW, TIGHT RELOAD.', capacity: 50, capacityShotgun: 12, reload: 2.2, sweetStart: 0.62, sweetWidth: 0.09, weight: 3 },
  quick: { id: 'quick', name: 'QUICK MAG', tag: 'Q', desc: 'PULL-TAB MAG. FAST RELOAD, WIDE SWEET SPOT.', capacity: 18, capacityShotgun: 5, reload: 0.9, sweetStart: 0.32, sweetWidth: 0.22, weight: 0.5, cost: { scrap: 6, wire: 5 } },
  extended: { id: 'extended', name: 'EXTENDED MAG', tag: 'X', desc: 'MORE ROUNDS WITHOUT A DRUM\'S BULK.', capacity: 36, capacityShotgun: 9, reload: 1.7, sweetStart: 0.5, sweetWidth: 0.12, weight: 1.5, cost: { scrap: 9, wire: 3 } },
};

export const STOCKS: Record<string, Stock> = {
  none: { id: 'none', name: 'NO STOCK', desc: 'LIGHTEST OPTION. HARD TO CONTROL.', spreadMul: 1.15, weight: 0 },
  wire: { id: 'wire', name: 'WIRE STOCK', desc: 'FOLDING FRAME. A LITTLE STEADIER.', spreadMul: 0.9, weight: 0.5 },
  brace: { id: 'brace', name: 'BRACE STOCK', desc: 'SOLID SHOULDER STOCK.', spreadMul: 0.72, weight: 1.5 },
  recoil: { id: 'recoil', name: 'BUFFER STOCK', desc: 'SPRING BUFFER SOAKS RECOIL. HEAVY.', spreadMul: 0.55, weight: 2.2, cost: { scrap: 10, wire: 2, alloy: 1 } },
};

export const SIGHTS: Record<string, Sight> = {
  iron: { id: 'iron', name: 'IRON SIGHT', desc: 'BASIC POSTS.', spreadMul: 1, rangeMul: 1, weight: 0 },
  dot: { id: 'dot', name: 'RED DOT', desc: 'QUICK TARGET PICKUP.', spreadMul: 0.85, rangeMul: 1.1, weight: 0.3 },
  laser: { id: 'laser', name: 'LASER', desc: 'PAINTS A BEAM WHERE YOU AIM.', spreadMul: 0.78, rangeMul: 1, weight: 0.2, cost: { scrap: 4, wire: 7 } },
  scope: { id: 'scope', name: 'SCOPE', desc: 'MAGNIFIED OPTIC. LONG REACH.', spreadMul: 0.7, rangeMul: 1.3, weight: 1, cost: { scrap: 6, wire: 5, alloy: 1 } },
};

export const SLOTS: Slot[] = ['receiver', 'barrel', 'magazine', 'stock', 'sight'];

export const CATALOG: Record<Slot, Record<string, PartBase>> = {
  receiver: RECEIVERS,
  barrel: BARRELS,
  magazine: MAGAZINES,
  stock: STOCKS,
  sight: SIGHTS,
};

export const SLOT_LABEL: Record<Slot, string> = {
  receiver: 'RECEIVER',
  barrel: 'BARREL',
  magazine: 'MAGAZINE',
  stock: 'STOCK',
  sight: 'SIGHT',
};

export function part(slot: Slot, id: string): PartBase {
  return CATALOG[slot][id];
}

export interface GunBuild {
  name: string;
  receiver: string;
  barrel: string;
  magazine: string;
  stock: string;
  sight: string;
}

export interface GunStats {
  mode: FireMode;
  damage: number;
  rate: number;
  pellets: number;
  spread: number;
  speed: number;
  range: number;
  capacity: number;
  reload: number;
  sweetStart: number;
  sweetWidth: number;
  weight: number;
  bullet: BulletKind;
  pierce: number;
  shake: number;
  laser: boolean;
}

export function computeStats(b: GunBuild): GunStats {
  const r = RECEIVERS[b.receiver];
  const ba = BARRELS[b.barrel];
  const m = MAGAZINES[b.magazine];
  const s = STOCKS[b.stock];
  const si = SIGHTS[b.sight];
  const shotgun = r.pellets > 1;
  return {
    mode: r.mode,
    damage: r.damage * ba.damageMul,
    rate: r.rate,
    pellets: r.pellets,
    spread: Math.max(0.5, (r.spread + ba.spreadAdd) * s.spreadMul * si.spreadMul),
    speed: r.speed * ba.speedMul,
    range: r.range * ba.rangeMul * si.rangeMul,
    capacity: shotgun ? m.capacityShotgun : m.capacity,
    reload: m.reload,
    sweetStart: m.sweetStart,
    sweetWidth: m.sweetWidth,
    weight: r.weight + ba.weight + m.weight + s.weight + si.weight,
    bullet: r.bullet,
    pierce: r.pierce,
    shake: r.shake,
    laser: b.sight === 'laser',
  };
}

export function moveSpeed(s: GunStats): number {
  return PLAYER.runSpeed - s.weight * 1.8;
}

/** Normalized 0..1 stat bars (higher is always better) plus display values. */
export function statProfile(s: GunStats): { label: string; v: number; text: string }[] {
  const clamp = (n: number) => Math.max(0.03, Math.min(1, n));
  return [
    { label: 'DAMAGE', v: clamp((s.damage * s.pellets) / 60), text: s.pellets > 1 ? `${Math.round(s.damage)}X${s.pellets}` : `${Math.round(s.damage)}` },
    { label: 'FIRE RATE', v: clamp(s.rate / 15), text: `${s.rate.toFixed(1)}/S` },
    { label: 'ACCURACY', v: clamp(1 - s.spread / 18), text: `${Math.round(clamp(1 - s.spread / 18) * 100)}` },
    { label: 'RANGE', v: clamp(s.range / 520), text: `${Math.round(s.range)}` },
    { label: 'MAGAZINE', v: clamp(s.capacity / 50), text: `${s.capacity}` },
    { label: 'RELOAD', v: clamp(1 - (s.reload - 0.7) / 1.7), text: `${s.reload.toFixed(1)}S` },
    { label: 'MOBILITY', v: clamp((moveSpeed(s) - 82) / 24), text: `${Math.round(moveSpeed(s))}` },
  ];
}

/** Generated callsign, e.g. "WORKHORSE LR-Q". */
export function nameBuild(b: Omit<GunBuild, 'name'>): string {
  const preset = PRESET_BUILDS.find((p) => SLOTS.every((s) => p[s] === b[s]));
  if (preset) return preset.name;
  const tags = [BARRELS[b.barrel].tag, MAGAZINES[b.magazine].tag].filter(Boolean);
  return `${RECEIVERS[b.receiver].callsign}${tags.length ? ' ' + tags.join('-') : ''}`;
}

export const PRESET_BUILDS: GunBuild[] = [
  { name: 'WORKHORSE', receiver: 'mutt', barrel: 'field', magazine: 'box', stock: 'brace', sight: 'iron' },
  { name: 'DOORKICKER', receiver: 'brick', barrel: 'stub', magazine: 'tube', stock: 'wire', sight: 'iron' },
  { name: 'BUZZSAW', receiver: 'hornet', barrel: 'stub', magazine: 'drum', stock: 'wire', sight: 'dot' },
];

export function buildKey(b: GunBuild): string {
  return `gun_${b.receiver}_${b.barrel}_${b.magazine}_${b.stock}_${b.sight}`;
}
