import Phaser from 'phaser';
import { DEPTH, TILE } from '../constants';
import { ONE_WAY_TILES, SOLID_TILES, T } from '../art/tiles';

export interface Spawn {
  kind: string;
  tx: number;
  ty: number;
  /** World x of the tile center. */
  x: number;
  /** World y of the tile's bottom edge (where feet go). */
  y: number;
}

const DECOR: Record<string, string> = {
  t: 'd_tree',
  b: 'd_bush',
  f: 'd_fern',
  s: 'd_sandbags',
  l: 'd_lamp',
  k: 'd_sign',
  w: 'd_wire',
  r: 'd_rock',
};

const ENTITY = new Set(['P', 'C', 'g', 'n', 'd', 'F', 'h', '$', 'o']);

// Collision kinds in the fast lookup grid
const EMPTY = 0;
const SOLID = 1;
const ONEWAY = 2;

export class Level {
  readonly rows: string[];
  readonly tw: number;
  readonly th: number;
  readonly width: number;
  readonly height: number;
  readonly map: Phaser.Tilemaps.Tilemap;
  readonly layer: Phaser.Tilemaps.TilemapLayer;
  readonly spawns: Spawn[] = [];
  readonly gate: { tx: number; ty: number }[] = [];
  triggerX: number | null = null;
  private grid: Uint8Array;

  constructor(scene: Phaser.Scene, rows: string[]) {
    this.rows = rows;
    this.th = rows.length;
    this.tw = rows[0].length;
    this.width = this.tw * TILE;
    this.height = this.th * TILE;
    this.grid = new Uint8Array(this.tw * this.th);

    const data: number[][] = [];
    for (let y = 0; y < this.th; y++) {
      const line: number[] = [];
      for (let x = 0; x < this.tw; x++) {
        const ch = rows[y][x];
        line.push(this.tileFor(ch, x, y));
        if (ch === 'G') this.gate.push({ tx: x, ty: y });
        if (ch === '!' && this.triggerX === null) this.triggerX = x * TILE;
        if (ENTITY.has(ch)) this.spawns.push({ kind: ch, tx: x, ty: y, x: x * TILE + TILE / 2, y: (y + 1) * TILE });
        if (DECOR[ch]) {
          scene.add
            .image(x * TILE + TILE / 2, (y + 1) * TILE + 1, DECOR[ch])
            .setOrigin(0.5, 1)
            .setDepth(DEPTH.decor);
        }
      }
      data.push(line);
    }

    for (let y = 0; y < this.th; y++)
      for (let x = 0; x < this.tw; x++) {
        const idx = data[y][x];
        this.grid[y * this.tw + x] = SOLID_TILES.includes(idx) ? SOLID : ONE_WAY_TILES.includes(idx) ? ONEWAY : EMPTY;
      }

    this.map = scene.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
    const tileset = this.map.addTilesetImage('tiles', 'tiles', TILE, TILE, 0, 0)!;
    this.layer = this.map.createLayer(0, tileset, 0, 0) as Phaser.Tilemaps.TilemapLayer;
    this.layer.setDepth(DEPTH.tiles);
    this.layer.setCollision(SOLID_TILES);
    this.layer.forEachTile((t) => {
      if (ONE_WAY_TILES.includes(t.index)) t.setCollision(false, false, true, false);
    });
  }

  private isGroundChar(x: number, y: number): boolean {
    if (x < 0 || x >= this.tw || y >= this.th) return true;
    if (y < 0) return false;
    return this.rows[y][x] === '#';
  }

  private tileFor(ch: string, x: number, y: number): number {
    switch (ch) {
      case '#': {
        const top = !this.isGroundChar(x, y - 1);
        const left = !this.isGroundChar(x - 1, y);
        const right = !this.isGroundChar(x + 1, y);
        if (top) return left ? T.TOP_L : right ? T.TOP_R : T.TOP;
        if (left) return T.DIRT_L;
        if (right) return T.DIRT_R;
        return (x * 7 + y * 13) % 11 === 0 ? T.DIRT2 : T.DIRT;
      }
      case 'B':
        return y > 0 && this.rows[y - 1][x] === 'B' ? T.CONC : T.CONC_TOP;
      case 'X':
        return T.CRATE;
      case '=':
        return T.PLANK;
      case '-':
        return T.GIRDER;
      default:
        return -1;
    }
  }

  private kind(px: number, py: number): number {
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    if (tx < 0 || tx >= this.tw || ty >= this.th) return SOLID;
    if (ty < 0) return EMPTY;
    return this.grid[ty * this.tw + tx];
  }

  /** Fully solid (blocks bullets and walking). */
  isSolid(px: number, py: number): boolean {
    return this.kind(px, py) === SOLID;
  }

  /** Something you can stand on (solid or one-way platform). */
  isGround(px: number, py: number): boolean {
    return this.kind(px, py) !== EMPTY;
  }

  isOneWay(px: number, py: number): boolean {
    return this.kind(px, py) === ONEWAY;
  }

  /** First standable surface at or below py, or null. */
  groundBelow(px: number, py: number, maxDist = 400): number | null {
    let ty = Math.floor(py / TILE);
    const limit = ty + Math.ceil(maxDist / TILE);
    for (; ty <= limit && ty < this.th; ty++) {
      if (this.kind(px, ty * TILE + 1) !== EMPTY) return ty * TILE;
    }
    return null;
  }

  /** Coarse line-of-sight test against solid tiles. */
  clearLine(x0: number, y0: number, x1: number, y1: number): boolean {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.ceil(d / 6);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.isSolid(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
    }
    return true;
  }

  setGate(locked: boolean): void {
    for (const g of this.gate) {
      this.grid[g.ty * this.tw + g.tx] = locked ? SOLID : EMPTY;
      if (locked) this.layer.putTileAt(T.GATE, g.tx, g.ty);
      else this.layer.removeTileAt(g.tx, g.ty);
    }
  }
}
