import { MISSION_TIME } from '../constants';

export type Material = 'scrap' | 'wire' | 'alloy';

export interface MissionResult {
  success: boolean;
  reason: string;
  time: number;
  kills: number;
  shots: number;
  hits: number;
  perfect: number;
  jams: number;
  damageTaken: number;
  deaths: number;
  hostages: number;
  hostagesTotal: number;
  bossDown: boolean;
  materials: Record<Material, number>;
  build: string;
}

export class Mission {
  timeLeft = MISSION_TIME;
  elapsed = 0;
  hostagesTotal: number;
  hostages = 0;
  bossDown = false;
  kills = 0;
  shots = 0;
  hits = 0;
  perfect = 0;
  jams = 0;
  damageTaken = 0;
  deaths = 0;
  materials: Record<Material, number> = { scrap: 0, wire: 0, alloy: 0 };
  over = false;

  constructor(hostagesTotal: number) {
    this.hostagesTotal = hostagesTotal;
  }

  get complete(): boolean {
    return this.hostages >= this.hostagesTotal && this.bossDown;
  }

  result(success: boolean, reason: string, build: string): MissionResult {
    return {
      success,
      reason,
      time: this.elapsed,
      kills: this.kills,
      shots: this.shots,
      hits: this.hits,
      perfect: this.perfect,
      jams: this.jams,
      damageTaken: Math.round(this.damageTaken),
      deaths: this.deaths,
      hostages: this.hostages,
      hostagesTotal: this.hostagesTotal,
      bossDown: this.bossDown,
      materials: { ...this.materials },
      build,
    };
  }
}

export function rankFor(r: MissionResult): string {
  if (!r.success) return '-';
  let score = 0;
  score += r.time < 180 ? 3 : r.time < 270 ? 2 : r.time < 360 ? 1 : 0;
  score += r.damageTaken < 60 ? 3 : r.damageTaken < 150 ? 2 : r.damageTaken < 300 ? 1 : 0;
  score += r.deaths === 0 ? 2 : r.deaths === 1 ? 1 : 0;
  const acc = r.shots ? r.hits / r.shots : 0;
  score += acc > 0.6 ? 2 : acc > 0.4 ? 1 : 0;
  score += r.perfect >= 5 ? 1 : 0;
  return score >= 10 ? 'S' : score >= 7 ? 'A' : score >= 4 ? 'B' : 'C';
}
