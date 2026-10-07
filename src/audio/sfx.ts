import Phaser from 'phaser';

// A tiny sfxr-style synthesizer. Sounds are rendered into AudioBuffers at boot
// and registered in Phaser's audio cache, so no audio files are needed.

type Wave = 'square' | 'saw' | 'tri' | 'sine' | 'noise';

interface Voice {
  wave: Wave;
  f0: number;
  f1?: number;
  dur: number;
  vol?: number;
  delay?: number;
  attack?: number;
  curve?: number; // decay exponent (higher = snappier)
  duty?: number;
  vib?: [number, number]; // rate Hz, depth (fraction)
  lp?: number; // one-pole lowpass 0..1 (1 = off)
}

const RATE = 44100;

function render(ctx: BaseAudioContext, voices: Voice[], master = 0.5): AudioBuffer {
  const total = Math.max(...voices.map((v) => (v.delay ?? 0) + v.dur));
  const n = Math.ceil(total * RATE);
  const buf = ctx.createBuffer(1, n, RATE);
  const out = buf.getChannelData(0);
  for (const v of voices) {
    const start = Math.floor((v.delay ?? 0) * RATE);
    const len = Math.floor(v.dur * RATE);
    const f1 = v.f1 ?? v.f0;
    const vol = (v.vol ?? 1) * master;
    const attack = Math.max(1, Math.floor((v.attack ?? 0.002) * RATE));
    const curve = v.curve ?? 2;
    const duty = v.duty ?? 0.5;
    const lp = v.lp ?? 1;
    let phase = 0;
    let noiseVal = 0;
    let lpState = 0;
    let seed = 12345;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let i = 0; i < len && start + i < n; i++) {
      const t = i / len;
      let f = v.f0 * Math.pow(f1 / v.f0, t);
      if (v.vib) f *= 1 + Math.sin((i / RATE) * Math.PI * 2 * v.vib[0]) * v.vib[1];
      const prev = phase;
      phase = (phase + f / RATE) % 1;
      let s: number;
      switch (v.wave) {
        case 'square':
          s = phase < duty ? 1 : -1;
          break;
        case 'saw':
          s = phase * 2 - 1;
          break;
        case 'tri':
          s = phase < 0.5 ? phase * 4 - 1 : 3 - phase * 4;
          break;
        case 'sine':
          s = Math.sin(phase * Math.PI * 2);
          break;
        case 'noise':
          if (phase < prev) noiseVal = rnd() * 2 - 1;
          s = noiseVal;
          break;
      }
      lpState += (s - lpState) * lp;
      const env = Math.min(1, i / attack) * Math.pow(1 - t, curve);
      out[start + i] += lpState * env * vol;
    }
  }
  for (let i = 0; i < n; i++) out[i] = Math.max(-1, Math.min(1, out[i]));
  return buf;
}

const SOUNDS: Record<string, { v: Voice[]; m?: number }> = {
  shoot_ar: {
    v: [
      { wave: 'noise', f0: 9000, f1: 1500, dur: 0.09, vol: 0.7, curve: 3 },
      { wave: 'square', f0: 260, f1: 70, dur: 0.1, vol: 0.5, curve: 2 },
    ],
    m: 0.35,
  },
  shoot_smg: {
    v: [
      { wave: 'noise', f0: 12000, f1: 3000, dur: 0.06, vol: 0.6, curve: 3 },
      { wave: 'square', f0: 420, f1: 140, dur: 0.06, vol: 0.4, duty: 0.25 },
    ],
    m: 0.3,
  },
  shoot_shotgun: {
    v: [
      { wave: 'noise', f0: 5000, f1: 400, dur: 0.32, vol: 1, curve: 2.5, lp: 0.5 },
      { wave: 'square', f0: 140, f1: 35, dur: 0.22, vol: 0.6 },
    ],
    m: 0.45,
  },
  shoot_slug: {
    v: [
      { wave: 'noise', f0: 7000, f1: 600, dur: 0.22, vol: 0.9, curve: 2.2, lp: 0.6 },
      { wave: 'square', f0: 180, f1: 50, dur: 0.18, vol: 0.6, duty: 0.4 },
      { wave: 'square', f0: 1800, f1: 900, dur: 0.05, vol: 0.2, duty: 0.1 },
    ],
    m: 0.42,
  },
  shoot_enemy: {
    v: [
      { wave: 'square', f0: 700, f1: 220, dur: 0.1, vol: 0.5, duty: 0.25 },
      { wave: 'noise', f0: 6000, f1: 2000, dur: 0.05, vol: 0.4 },
    ],
    m: 0.25,
  },
  shoot_boss: {
    v: [
      { wave: 'square', f0: 360, f1: 120, dur: 0.08, vol: 0.6, duty: 0.3 },
      { wave: 'noise', f0: 4000, f1: 800, dur: 0.07, vol: 0.6 },
    ],
    m: 0.3,
  },
  reload_start: {
    v: [
      { wave: 'noise', f0: 14000, dur: 0.03, vol: 0.6 },
      { wave: 'square', f0: 1400, f1: 900, dur: 0.04, vol: 0.3, delay: 0.01 },
    ],
    m: 0.35,
  },
  reload_done: {
    v: [
      { wave: 'noise', f0: 12000, dur: 0.03, vol: 0.6 },
      { wave: 'square', f0: 900, f1: 1300, dur: 0.04, vol: 0.3 },
      { wave: 'noise', f0: 9000, dur: 0.03, vol: 0.6, delay: 0.07 },
    ],
    m: 0.35,
  },
  perfect: {
    v: [
      { wave: 'square', f0: 880, dur: 0.06, vol: 0.4, duty: 0.25, curve: 0.5 },
      { wave: 'square', f0: 1320, dur: 0.06, vol: 0.4, duty: 0.25, delay: 0.05, curve: 0.5 },
      { wave: 'square', f0: 1760, dur: 0.12, vol: 0.4, duty: 0.25, delay: 0.1 },
    ],
    m: 0.35,
  },
  jam: {
    v: [
      { wave: 'saw', f0: 120, f1: 90, dur: 0.3, vol: 0.6, vib: [30, 0.2], curve: 1 },
      { wave: 'noise', f0: 3000, dur: 0.05, vol: 0.5 },
    ],
    m: 0.35,
  },
  dry: { v: [{ wave: 'square', f0: 2000, f1: 1800, dur: 0.03, vol: 0.4, duty: 0.1 }], m: 0.3 },
  jump: { v: [{ wave: 'square', f0: 260, f1: 520, dur: 0.11, vol: 0.4, duty: 0.25 }], m: 0.18 },
  land: { v: [{ wave: 'noise', f0: 900, f1: 300, dur: 0.06, vol: 0.6, lp: 0.3 }], m: 0.25 },
  knife: { v: [{ wave: 'noise', f0: 2000, f1: 12000, dur: 0.12, vol: 0.6, attack: 0.03, lp: 0.6 }], m: 0.35 },
  parry: {
    v: [
      { wave: 'square', f0: 2400, f1: 2000, dur: 0.12, vol: 0.4, duty: 0.15 },
      { wave: 'noise', f0: 15000, dur: 0.05, vol: 0.4 },
    ],
    m: 0.3,
  },
  hit: {
    v: [
      { wave: 'noise', f0: 8000, f1: 2000, dur: 0.05, vol: 0.6 },
      { wave: 'square', f0: 900, f1: 400, dur: 0.05, vol: 0.3, duty: 0.25 },
    ],
    m: 0.22,
  },
  ricochet: { v: [{ wave: 'square', f0: 3000, f1: 1500, dur: 0.07, vol: 0.3, duty: 0.1 }], m: 0.15 },
  hurt: {
    v: [
      { wave: 'saw', f0: 500, f1: 90, dur: 0.22, vol: 0.6 },
      { wave: 'noise', f0: 3000, dur: 0.08, vol: 0.4 },
    ],
    m: 0.35,
  },
  enemy_die: {
    v: [
      { wave: 'square', f0: 600, f1: 80, dur: 0.25, vol: 0.4, duty: 0.25 },
      { wave: 'noise', f0: 4000, f1: 500, dur: 0.2, vol: 0.5 },
    ],
    m: 0.3,
  },
  explosion: {
    v: [
      { wave: 'noise', f0: 3000, f1: 80, dur: 0.75, vol: 1, curve: 1.6, lp: 0.35 },
      { wave: 'sine', f0: 90, f1: 30, dur: 0.5, vol: 0.8 },
    ],
    m: 0.55,
  },
  pickup: {
    v: [
      { wave: 'square', f0: 1046, dur: 0.05, vol: 0.4, duty: 0.25, curve: 0.5 },
      { wave: 'square', f0: 1568, dur: 0.08, vol: 0.4, duty: 0.25, delay: 0.045 },
    ],
    m: 0.22,
  },
  heal: {
    v: [523, 659, 784, 1046].map((f, i) => ({ wave: 'tri' as Wave, f0: f, dur: 0.1, vol: 0.6, delay: i * 0.07, curve: 1 })),
    m: 0.4,
  },
  rescue: {
    v: [523, 659, 784, 1046, 784, 1046].map((f, i) => ({ wave: 'square' as Wave, f0: f, dur: 0.09, vol: 0.35, duty: 0.25, delay: i * 0.075, curve: 0.8 })),
    m: 0.35,
  },
  alert: {
    v: [
      { wave: 'square', f0: 1200, dur: 0.05, vol: 0.4, duty: 0.25, curve: 0.3 },
      { wave: 'square', f0: 1600, dur: 0.07, vol: 0.4, duty: 0.25, delay: 0.06 },
    ],
    m: 0.2,
  },
  throw: { v: [{ wave: 'noise', f0: 1500, f1: 5000, dur: 0.12, vol: 0.4, attack: 0.04 }], m: 0.25 },
  bounce: { v: [{ wave: 'square', f0: 500, f1: 300, dur: 0.04, vol: 0.4, duty: 0.2 }], m: 0.18 },
  whistle: { v: [{ wave: 'sine', f0: 2200, f1: 500, dur: 0.9, vol: 0.5, curve: 0.4 }], m: 0.18 },
  boss_roar: {
    v: [
      { wave: 'saw', f0: 70, f1: 55, dur: 1.1, vol: 0.8, vib: [8, 0.15], curve: 1 },
      { wave: 'noise', f0: 800, f1: 200, dur: 1.0, vol: 0.4, lp: 0.2 },
      { wave: 'square', f0: 110, f1: 80, dur: 0.9, vol: 0.3, duty: 0.2, vib: [6, 0.1] },
    ],
    m: 0.45,
  },
  stomp: {
    v: [
      { wave: 'sine', f0: 110, f1: 40, dur: 0.18, vol: 0.9 },
      { wave: 'noise', f0: 800, f1: 200, dur: 0.1, vol: 0.4, lp: 0.3 },
    ],
    m: 0.35,
  },
  windup: { v: [{ wave: 'saw', f0: 80, f1: 400, dur: 0.6, vol: 0.5, vib: [20, 0.05], curve: 0.3 }], m: 0.3 },
  ui_move: { v: [{ wave: 'square', f0: 660, dur: 0.04, vol: 0.4, duty: 0.25 }], m: 0.2 },
  ui_ok: {
    v: [
      { wave: 'square', f0: 660, dur: 0.05, vol: 0.4, duty: 0.25, curve: 0.5 },
      { wave: 'square', f0: 990, dur: 0.1, vol: 0.4, duty: 0.25, delay: 0.05 },
    ],
    m: 0.25,
  },
  beep: { v: [{ wave: 'square', f0: 1760, dur: 0.06, vol: 0.4, duty: 0.5, curve: 0.2 }], m: 0.15 },
  checkpoint: {
    v: [784, 988, 1175].map((f, i) => ({ wave: 'tri' as Wave, f0: f, dur: 0.12, vol: 0.7, delay: i * 0.08, curve: 1 })),
    m: 0.4,
  },
  fanfare: {
    v: [523, 523, 523, 659, 784, 659, 784, 1046].map((f, i) => ({
      wave: 'square' as Wave,
      f0: f,
      dur: i === 7 ? 0.6 : 0.12,
      vol: 0.35,
      duty: 0.25,
      delay: [0, 0.12, 0.24, 0.36, 0.6, 0.84, 0.96, 1.08][i],
      curve: 0.6,
    })),
    m: 0.4,
  },
  fail: {
    v: [392, 370, 349, 262].map((f, i) => ({ wave: 'tri' as Wave, f0: f, dur: i === 3 ? 0.8 : 0.25, vol: 0.7, delay: i * 0.25, curve: 0.7 })),
    m: 0.4,
  },
};

let enabled = false;

export function buildSfx(scene: Phaser.Scene): void {
  const sm = scene.sound as Phaser.Sound.WebAudioSoundManager;
  if (!('context' in sm) || !sm.context) return;
  for (const [key, def] of Object.entries(SOUNDS)) {
    scene.cache.audio.add(key, render(sm.context, def.v, def.m ?? 0.4));
  }
  enabled = true;
}

const lastPlayed = new Map<string, number>();

/** Plays a generated sound with slight pitch variance. Rate-limited per key. */
export function sfx(scene: Phaser.Scene, key: string, opts: { volume?: number; detune?: number; vary?: number } = {}): void {
  if (!enabled) return;
  const now = scene.game.loop.time;
  const last = lastPlayed.get(key) ?? -1000;
  if (now - last < 30) return;
  lastPlayed.set(key, now);
  const vary = opts.vary ?? 80;
  scene.sound.play(key, {
    volume: opts.volume ?? 1,
    detune: (opts.detune ?? 0) + (Math.random() * 2 - 1) * vary,
  });
}
