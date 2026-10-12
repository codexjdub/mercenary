import type { Material, MissionResult } from '../game/Mission';
import { rankFor } from '../game/Mission';
import { CATALOG, Cost, GunBuild, PRESET_BUILDS, SLOTS, Slot, nameBuild } from './gunParts';

// Persistent career data. Stored in localStorage when available; falls back
// to memory (private windows, blocked storage) so the game never breaks.

const KEY = 'mercenary-save';
/** Key used before the game was renamed from Hired Steel; migrated on first load. */
const LEGACY_KEY = 'hired-steel-save';
const MATS: Material[] = ['scrap', 'wire', 'alloy'];
const RANK_ORDER = ['S', 'A', 'B', 'C'];

interface MissionRecord {
  runs: number;
  clears: number;
  bestRank: string | null;
  bestTime: number | null;
}

interface SaveData {
  v: 1;
  materials: Record<Material, number>;
  owned: string[]; // "slot:id"
  loadouts: GunBuild[];
  equipped: number;
  missions: Record<string, MissionRecord>;
  career: { kills: number; runs: number; clears: number; banked: Record<Material, number> };
  seenCamp: boolean;
}

const partKey = (slot: Slot, id: string) => `${slot}:${id}`;

function defaults(): SaveData {
  const owned: string[] = [];
  for (const slot of SLOTS) for (const [id, p] of Object.entries(CATALOG[slot])) if (!p.cost) owned.push(partKey(slot, id));
  return {
    v: 1,
    materials: { scrap: 0, wire: 0, alloy: 0 },
    owned,
    loadouts: PRESET_BUILDS.map((b) => ({ ...b })),
    equipped: 0,
    missions: {},
    career: { kills: 0, runs: 0, clears: 0, banked: { scrap: 0, wire: 0, alloy: 0 } },
    seenCamp: false,
  };
}

let data: SaveData | null = null;

// Stored saves can be damaged or hand-edited, so every field is type-checked
// and anything that doesn't fit falls back to its default.
type Loose = Record<string, unknown>;
const obj = (v: unknown): Loose => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Loose) : {});
const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const counts = (v: unknown): Record<Material, number> => {
  const o = obj(v);
  return { scrap: num(o.scrap), wire: num(o.wire), alloy: num(o.alloy) };
};

function sanitize(raw: Loose): SaveData {
  const d = defaults();
  const career = obj(raw.career);
  const missions: Record<string, MissionRecord> = {};
  for (const [id, v] of Object.entries(obj(raw.missions))) {
    const r = obj(v);
    missions[id] = {
      runs: num(r.runs),
      clears: num(r.clears),
      bestRank: typeof r.bestRank === 'string' && RANK_ORDER.includes(r.bestRank) ? r.bestRank : null,
      bestTime: typeof r.bestTime === 'number' && Number.isFinite(r.bestTime) ? r.bestTime : null,
    };
  }
  // owned parts must exist; default parts are always owned
  const stored = Array.isArray(raw.owned) ? raw.owned : [];
  const owned = Array.from(new Set([...d.owned, ...stored.filter((k): k is string => {
    if (typeof k !== 'string') return false;
    const [slot, id] = k.split(':') as [Slot, string];
    return CATALOG[slot]?.[id] !== undefined;
  })]));
  // loadouts must reference parts that exist and are owned
  const valid = (b: Loose) => SLOTS.every((s) => typeof b[s] === 'string' && owned.includes(partKey(s, b[s] as string)));
  const loadouts = d.loadouts.map((preset, i) => {
    const b = obj(Array.isArray(raw.loadouts) ? raw.loadouts[i] : undefined);
    if (!valid(b)) return preset;
    const parts = Object.fromEntries(SLOTS.map((s) => [s, b[s]])) as Omit<GunBuild, 'name'>;
    return { ...parts, name: nameBuild(parts) };
  });
  return {
    v: 1,
    materials: counts(raw.materials),
    owned,
    loadouts,
    equipped: Math.min(Math.max(0, num(raw.equipped) | 0), loadouts.length - 1),
    missions,
    career: { kills: num(career.kills), runs: num(career.runs), clears: num(career.clears), banked: counts(career.banked) },
    seenCamp: raw.seenCamp === true,
  };
}

/** Loads one stored save; null if it is missing, unreadable, or storage is blocked. */
function read(key: string): SaveData | null {
  try {
    const s = localStorage.getItem(key);
    const raw: unknown = s ? JSON.parse(s) : null;
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? sanitize(raw as Loose) : null;
  } catch {
    return null;
  }
}

export function getSave(): SaveData {
  if (data) return data;
  const current = read(KEY);
  const legacy = read(LEGACY_KEY);
  // A tab still running a pre-rename build can write the legacy key even after
  // a migration, so when both exist keep whichever save has more runs on it.
  data = legacy && (!current || legacy.career.runs > current.career.runs) ? legacy : (current ?? defaults());
  // Drop the legacy copy only once the new key holds the save we kept. A legacy
  // save that can't be read is left alone so it can still be recovered by hand.
  if (legacy && (data === current || commit())) {
    try {
      localStorage.removeItem(LEGACY_KEY);
    } catch {
      /* storage unavailable: keep the legacy copy */
    }
  }
  return data;
}

/** Writes the save to storage. Returns false if storage is unavailable; the save then lives in memory only. */
export function commit(): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(getSave()));
    return true;
  } catch {
    return false;
  }
}

export function resetSave(): void {
  data = defaults();
  commit();
}

export function owns(slot: Slot, id: string): boolean {
  return getSave().owned.includes(partKey(slot, id));
}

export function canAfford(cost: Cost | undefined): boolean {
  if (!cost) return true;
  const m = getSave().materials;
  return MATS.every((k) => (cost[k] ?? 0) <= m[k]);
}

/** Spends materials and unlocks a part. Returns false if not possible. */
export function craft(slot: Slot, id: string): boolean {
  const p = CATALOG[slot][id];
  if (!p || owns(slot, id) || !canAfford(p.cost)) return false;
  const s = getSave();
  for (const k of MATS) s.materials[k] -= p.cost?.[k] ?? 0;
  s.owned.push(partKey(slot, id));
  commit();
  return true;
}

export function setLoadout(i: number, b: Omit<GunBuild, 'name'>): GunBuild {
  const s = getSave();
  const full = { ...b, name: nameBuild(b) } as GunBuild;
  s.loadouts[i] = full;
  commit();
  return full;
}

export function ownedIds(slot: Slot): string[] {
  return Object.keys(CATALOG[slot]).filter((id) => owns(slot, id));
}

interface BankReceipt {
  banked: Record<Material, number>;
  salvage: boolean;
  newBestRank: boolean;
  newBestTime: boolean;
}

/** Applies a finished run to the save. Failed runs keep half the haul. */
export function bankResult(missionId: string, r: MissionResult): BankReceipt {
  const s = getSave();
  const banked = { scrap: 0, wire: 0, alloy: 0 } as Record<Material, number>;
  for (const k of MATS) {
    banked[k] = r.success ? r.materials[k] : Math.floor(r.materials[k] / 2);
    s.materials[k] += banked[k];
    s.career.banked[k] += banked[k];
  }
  s.career.kills += r.kills;
  s.career.runs++;
  const rec = (s.missions[missionId] ??= { runs: 0, clears: 0, bestRank: null, bestTime: null });
  rec.runs++;
  let newBestRank = false;
  let newBestTime = false;
  if (r.success) {
    s.career.clears++;
    rec.clears++;
    const rank = rankFor(r);
    if (rec.bestRank === null || RANK_ORDER.indexOf(rank) < RANK_ORDER.indexOf(rec.bestRank)) {
      rec.bestRank = rank;
      newBestRank = true;
    }
    if (rec.bestTime === null || r.time < rec.bestTime) {
      rec.bestTime = r.time;
      newBestTime = true;
    }
  }
  commit();
  return { banked, salvage: !r.success, newBestRank, newBestTime };
}
