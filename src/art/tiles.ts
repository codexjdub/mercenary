import Phaser from 'phaser';
import { PixelCanvas, rng } from './PixelCanvas';
import { P } from './palette';
import { TILE } from '../constants';

// Tile indices in the generated tileset.
export const T = {
  TOP: 0,
  TOP_L: 1,
  TOP_R: 2,
  DIRT: 3,
  DIRT2: 4,
  DIRT_L: 5,
  DIRT_R: 6,
  CONC_TOP: 7,
  CONC: 8,
  CRATE: 9,
  PLANK: 10,
  GIRDER: 11,
  GATE: 12,
} as const;

export const TILE_COUNT = 13;
export const SOLID_TILES: number[] = [T.TOP, T.TOP_L, T.TOP_R, T.DIRT, T.DIRT2, T.DIRT_L, T.DIRT_R, T.CONC_TOP, T.CONC, T.CRATE, T.GATE];
export const ONE_WAY_TILES: number[] = [T.PLANK, T.GIRDER];

function dirt(pc: PixelCanvas, seed: number, from = 0) {
  const R = rng(seed);
  pc.rect(0, from, 16, 16 - from, P.dirt);
  for (let i = 0; i < 14; i++) {
    const x = Math.floor(R() * 16);
    const y = from + Math.floor(R() * (16 - from));
    pc.set(x, y, R() < 0.5 ? P.dirtShade : P.dirtLight);
  }
  // pebbles
  for (let i = 0; i < 2; i++) {
    const x = 2 + Math.floor(R() * 11);
    const y = from + 2 + Math.floor(R() * (12 - from));
    pc.rect(x, y, 2, 2, P.rock).set(x, y + 1, P.rockShade).set(x + 1, y + 1, P.rockShade);
  }
}

function grassTop(pc: PixelCanvas, seed: number) {
  const R = rng(seed + 100);
  dirt(pc, seed, 4);
  pc.rect(0, 0, 16, 4, P.grass);
  pc.hline(0, 15, 0, P.grassLight);
  for (let x = 0; x < 16; x++) {
    const h = 4 + Math.floor(R() * 3);
    pc.vline(x, 4, h, x % 3 === 0 ? P.grassShade : P.grass);
    if (R() < 0.3) pc.set(x, 1, P.grassLight);
  }
  pc.hline(0, 15, 3, P.grassShade);
}

function drawTile(i: number): PixelCanvas {
  const pc = new PixelCanvas(TILE, TILE);
  switch (i) {
    case T.TOP:
      grassTop(pc, 1);
      break;
    case T.TOP_L:
      grassTop(pc, 2);
      pc.vline(0, 1, 15, P.dirtDark);
      pc.set(0, 0, null).set(1, 0, P.grassShade);
      break;
    case T.TOP_R:
      grassTop(pc, 3);
      pc.vline(15, 1, 15, P.dirtDark);
      pc.set(15, 0, null).set(14, 0, P.grassShade);
      break;
    case T.DIRT:
      dirt(pc, 4);
      break;
    case T.DIRT2:
      dirt(pc, 5);
      pc.rect(4, 6, 6, 4, P.rockShade).rect(5, 6, 4, 3, P.rock).set(5, 6, P.concreteLight);
      break;
    case T.DIRT_L:
      dirt(pc, 6);
      pc.vline(0, 0, 15, P.dirtDark).vline(1, 0, 15, P.dirtShade);
      break;
    case T.DIRT_R:
      dirt(pc, 7);
      pc.vline(15, 0, 15, P.dirtDark).vline(14, 0, 15, P.dirtShade);
      break;
    case T.CONC_TOP:
    case T.CONC: {
      pc.rect(0, 0, 16, 16, P.concrete);
      pc.hline(0, 15, 7, P.concreteShade).hline(0, 15, 15, P.concreteShade);
      pc.vline(5, 0, 6, P.concreteShade).vline(11, 8, 14, P.concreteShade);
      pc.hline(0, 15, 8, P.concreteLight).hline(0, 15, 0, P.concreteLight);
      const R = rng(i * 13);
      for (let k = 0; k < 6; k++) pc.set(Math.floor(R() * 16), Math.floor(R() * 16), P.concreteShade);
      if (i === T.CONC_TOP) {
        pc.rect(0, 0, 16, 3, P.hazard);
        for (let x = -3; x < 16; x += 6) pc.line(x, 2, x + 2, 0, P.ink);
        pc.hline(0, 15, 3, P.concreteShade);
      }
      break;
    }
    case T.CRATE:
      pc.rect(0, 0, 16, 16, P.wood);
      pc.hline(0, 15, 5, P.woodShade).hline(0, 15, 10, P.woodShade);
      pc.hline(0, 15, 0, P.woodLight).hline(0, 15, 6, P.woodLight).hline(0, 15, 11, P.woodLight);
      pc.line(1, 14, 14, 1, P.woodShade, 2);
      pc.rect(0, 0, 16, 1, P.woodShade).rect(0, 15, 16, 1, P.trunkShade);
      pc.vline(0, 0, 15, P.trunkShade).vline(15, 0, 15, P.trunkShade);
      pc.rect(0, 0, 3, 3, P.metalShade).rect(13, 0, 3, 3, P.metalShade).rect(0, 13, 3, 3, P.metalShade).rect(13, 13, 3, 3, P.metalShade);
      break;
    case T.PLANK:
      pc.rect(0, 0, 16, 5, P.wood);
      pc.hline(0, 15, 0, P.woodLight).hline(0, 15, 4, P.woodShade);
      pc.vline(7, 0, 4, P.woodShade);
      pc.set(2, 2, P.trunkShade).set(12, 2, P.trunkShade);
      pc.line(3, 5, 6, 9, P.woodShade, 2).line(12, 5, 9, 9, P.woodShade, 2);
      pc.hline(0, 15, 5, P.ink);
      break;
    case T.GIRDER:
      pc.rect(0, 0, 16, 6, P.girder);
      pc.hline(0, 15, 0, P.girderLight).hline(0, 15, 5, P.girderShade);
      pc.rect(3, 2, 2, 2, P.girderShade).rect(11, 2, 2, 2, P.girderShade);
      pc.hline(0, 15, 6, P.ink);
      break;
    case T.GATE:
      pc.rect(0, 0, 16, 16, P.metalDark);
      pc.rect(2, 0, 3, 16, P.metal).rect(11, 0, 3, 16, P.metal);
      pc.vline(2, 0, 15, P.metalLight).vline(11, 0, 15, P.metalLight);
      pc.rect(0, 6, 16, 3, P.hazard);
      for (let x = -2; x < 16; x += 4) pc.line(x, 8, x + 2, 6, P.ink);
      break;
  }
  return pc;
}

export function buildTiles(scene: Phaser.Scene): void {
  const tex = scene.textures.createCanvas('tiles', TILE * TILE_COUNT, TILE)!;
  const ctx = tex.getContext();
  for (let i = 0; i < TILE_COUNT; i++) drawTile(i).draw(ctx, i * TILE, 0);
  tex.refresh();
}

/** A vertical strip (grass top + dirt) for TileSprite floors in menus and camp. */
export function buildGroundStrip(scene: Phaser.Scene, key: string, rows = 4): void {
  if (scene.textures.exists(key)) return;
  const strip = scene.textures.createCanvas(key, TILE, TILE * rows)!;
  const ctx = strip.getContext();
  drawTile(T.TOP).draw(ctx, 0, 0);
  for (let i = 1; i < rows; i++) drawTile(i % 3 === 2 ? T.DIRT2 : T.DIRT).draw(ctx, 0, i * TILE);
  strip.refresh();
}
