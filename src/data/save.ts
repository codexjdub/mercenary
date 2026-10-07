import type { Material, MissionResult } from '../game/Mission';
import { rankFor } from '../game/Mission';
import { CATALOG, Cost, GunBuild, PRESET_BUILDS, SLOTS, Slot, nameBuild } from './gunParts';

// Persistent career data. Stored in localStorage when available; falls back
// to memory (private windows, blocked storage) so the game never breaks.

const KEY = 'hired-steel-save';
const MATS: Material[] = ['scrap', 'wire', 'alloy'];
const RANK_ORDER = ['S', 'A', 'B', 'C'];

export interface MissionRecord {
  runs: number;
  clears: number;
  bestRank: string | null;
  bestTime: number | null;
}

export interface SaveData {
  v: 1;
  materials: Record<Material, number>;
  owned: string[]; // "slot:id"
  loadouts: GunBuild[];
  equipped: number;
  missions: Record<string, MissionRecord>;
  career: { kills: number; runs: number; clears: number; banked: Record<Material, number> };
  seenCamp: boolean;
}

export const partKey = (slot: Slot, id: string) => `${slot}:${id}`;

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

function sanitize(raw: Partial<SaveData>): SaveData {
  const d = defaults();
  const out: SaveData = { ...d, ...raw, v: 1 } as SaveData;
  out.materials = { ...d.materials, ...(raw.materials ?? {}) };
  out.career = { ...d.career, ...(raw.career ?? {}), banked: { ...d.career.banked, ...(raw.career?.banked ?? {}) } };
  out.missions = raw.missions ?? {};
  // owned parts must exist; default parts are always owned
  out.owned = Array.from(new Set([...d.owned, ...(raw.owned ?? []).filter((k) => {
    const [slot, id] = k.split(':') as [Slot, string];
    return CATALOG[slot]?.[id] !== undefined;
  })]));
  // loadouts must reference parts that exist and are owned
  const valid = (b: GunBuild) => SLOTS.every((s) => out.owned.includes(partKey(s, b[s])));
  out.loadouts = d.loadouts.map((preset, i) => {
    const b = raw.loadouts?.[i];
    return b && valid(b) ? { ...b, name: nameBuild(b) } : preset;
  });
  out.equipped = Math.min(Math.max(0, out.equipped | 0), out.loadouts.length - 1);
  return out;
}

export function getSave(): SaveData {
  if (data) return data;
  let raw: Partial<SaveData> | null = null;
  try {
    const s = localStorage.getItem(KEY);
    if (s) raw = JSON.parse(s) as Partial<SaveData>;
  } catch {
    raw = null;
  }
  data = raw ? sanitize(raw) : defaults();
  return data;
}

export function commit(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(getSave()));
  } catch {
    /* storage unavailable: keep in memory */
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

export interface BankReceipt {
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
