import { PLAYER } from '../constants';
import type { GunStats } from '../data/gunParts';

export type ReloadEvent = 'started' | 'perfect' | 'jam' | 'done' | null;

/**
 * Magazine + active-reload state machine.
 *
 * Press reload once to start. Press again while the cursor is inside the
 * sweet spot for an instant "perfect" reload that also buffs damage for the
 * next magazine. Press outside it and the gun jams, costing extra time.
 */
export class Weapon {
  readonly stats: GunStats;
  ammo: number;
  state: 'ready' | 'reload' | 'jam' = 'ready';
  t = 0;
  cooldown = 0;
  tried = false;
  perfectMag = false;

  constructor(stats: GunStats) {
    this.stats = stats;
    this.ammo = stats.capacity;
  }

  get progress(): number {
    return this.state === 'reload' ? this.t / this.stats.reload : this.state === 'jam' ? this.t / this.jamTime : 0;
  }

  get jamTime(): number {
    return this.stats.reload * 1.15;
  }

  get damage(): number {
    return this.stats.damage * (this.perfectMag ? PLAYER.perfectReloadBonus : 1);
  }

  update(dt: number): ReloadEvent {
    this.cooldown -= dt;
    if (this.state === 'ready') return null;
    this.t += dt;
    const dur = this.state === 'reload' ? this.stats.reload : this.jamTime;
    if (this.t >= dur) {
      this.finish(false);
      return 'done';
    }
    return null;
  }

  canFire(): boolean {
    return this.state === 'ready' && this.ammo > 0 && this.cooldown <= 0;
  }

  fire(): boolean {
    if (!this.canFire()) return false;
    this.ammo--;
    this.cooldown = 1 / this.stats.rate;
    return true;
  }

  /** Reload button: starts a reload, or attempts the active reload. */
  press(): ReloadEvent {
    if (this.state === 'ready') {
      if (this.ammo >= this.stats.capacity) return null;
      this.state = 'reload';
      this.t = 0;
      this.tried = false;
      this.perfectMag = false;
      return 'started';
    }
    if (this.state === 'reload' && !this.tried) {
      this.tried = true;
      const p = this.progress;
      if (p >= this.stats.sweetStart && p <= this.stats.sweetStart + this.stats.sweetWidth) {
        this.finish(true);
        return 'perfect';
      }
      this.state = 'jam';
      this.t = 0;
      return 'jam';
    }
    return null;
  }

  finish(perfect: boolean): void {
    this.ammo = this.stats.capacity;
    this.state = 'ready';
    this.t = 0;
    this.perfectMag = perfect;
    this.cooldown = Math.min(this.cooldown, 0.05);
  }

  refill(): void {
    this.finish(false);
  }
}
