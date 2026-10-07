// A tiny software pixel buffer used to author all of the game's art in code.
// Shapes are drawn with palette colors, then `outline()` adds the crisp dark
// silhouette that makes chunky pixel art read well at small sizes.

export type Px = string | null;

export class PixelCanvas {
  readonly w: number;
  readonly h: number;
  private px: Px[];

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.px = new Array(w * h).fill(null);
  }

  get(x: number, y: number): Px {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.px[y * this.w + x];
  }

  set(x: number, y: number, c: Px): this {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    this.px[y * this.w + x] = c;
    return this;
  }

  /** Only paints where something is already drawn (useful for shading). */
  over(x: number, y: number, c: Px): this {
    if (this.get(x, y) !== null) this.set(x, y, c);
    return this;
  }

  rect(x: number, y: number, w: number, h: number, c: Px): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
    return this;
  }

  hline(x0: number, x1: number, y: number, c: Px): this {
    const a = Math.min(x0, x1);
    const b = Math.max(x0, x1);
    for (let x = a; x <= b; x++) this.set(x, y, c);
    return this;
  }

  vline(x: number, y0: number, y1: number, c: Px): this {
    const a = Math.min(y0, y1);
    const b = Math.max(y0, y1);
    for (let y = a; y <= b; y++) this.set(x, y, c);
    return this;
  }

  /** Bresenham line with a square brush of the given thickness. */
  line(x0: number, y0: number, x1: number, y1: number, c: Px, thick = 1): this {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    const off = Math.floor((thick - 1) / 2);
    for (;;) {
      this.rect(x0 - off, y0 - off, thick, thick, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
    return this;
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, c: Px): this {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x - cx) / (rx + 0.5);
        const ny = (y - cy) / (ry + 0.5);
        if (nx * nx + ny * ny <= 1) this.set(x, y, c);
      }
    }
    return this;
  }

  circle(cx: number, cy: number, r: number, c: Px): this {
    return this.ellipse(cx, cy, r, r, c);
  }

  ring(cx: number, cy: number, r: number, c: Px, width = 1): this {
    for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) {
      for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d <= r + 0.5 && d > r + 0.5 - width) this.set(x, y, c);
      }
    }
    return this;
  }

  /** Draw rows of characters using a palette map. ' ' and '.' are transparent. */
  pattern(x: number, y: number, rows: string[], pal: Record<string, Px>): this {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '.' || ch === ' ') continue;
        const c = pal[ch];
        if (c !== undefined) this.set(x + i, y + j, c);
      }
    });
    return this;
  }

  stamp(src: PixelCanvas, ox: number, oy: number, flipX = false): this {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const c = src.get(x, y);
        if (c === null) continue;
        this.set(ox + (flipX ? src.w - 1 - x : x), oy + y, c);
      }
    }
    return this;
  }

  /** Adds a 1px outline around every opaque region. */
  outline(c: Px, diagonals = false): this {
    const add: number[] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y) !== null) continue;
        const n =
          this.get(x - 1, y) !== null ||
          this.get(x + 1, y) !== null ||
          this.get(x, y - 1) !== null ||
          this.get(x, y + 1) !== null ||
          (diagonals &&
            (this.get(x - 1, y - 1) !== null ||
              this.get(x + 1, y - 1) !== null ||
              this.get(x - 1, y + 1) !== null ||
              this.get(x + 1, y + 1) !== null));
        if (n) add.push(y * this.w + x);
      }
    }
    for (const i of add) this.px[i] = c;
    return this;
  }

  replace(from: Px, to: Px): this {
    for (let i = 0; i < this.px.length; i++) if (this.px[i] === from) this.px[i] = to;
    return this;
  }

  /** Returns a copy rotated 90deg counter-clockwise. */
  rotateCCW(): PixelCanvas {
    const out = new PixelCanvas(this.h, this.w);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) out.set(y, this.w - 1 - x, this.get(x, y));
    return out;
  }

  shifted(dx: number, dy: number): PixelCanvas {
    const out = new PixelCanvas(this.w, this.h);
    out.stamp(this, dx, dy);
    return out;
  }

  clone(): PixelCanvas {
    const out = new PixelCanvas(this.w, this.h);
    out.px = this.px.slice();
    return out;
  }

  draw(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
    for (let y = 0; y < this.h; y++) {
      let runStart = -1;
      let runColor: Px = null;
      for (let x = 0; x <= this.w; x++) {
        const c = x < this.w ? this.px[y * this.w + x] : null;
        if (c !== runColor) {
          if (runColor !== null) {
            ctx.fillStyle = runColor;
            ctx.fillRect(ox + runStart, oy + y, x - runStart, 1);
          }
          runColor = c;
          runStart = x;
        }
      }
    }
  }
}

/** Deterministic PRNG so generated art is identical every run. */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
