import Phaser from 'phaser';
import { DEPTH } from '../constants';
import type { GameScene } from '../scenes/GameScene';
import { sfx } from '../audio/sfx';
import type { Hittable } from './types';

export interface Bullet {
  img: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  range: number;
  dmg: number;
  team: 'player' | 'enemy';
  r: number;
  alive: boolean;
  /** Ground-hugging shockwaves ignore one-way platforms and die at walls. */
  ground?: boolean;
  /** Extra targets this bullet can pass through. */
  pierce: number;
  hits?: Set<Hittable>;
}

/**
 * Bullets are simulated manually (not with physics bodies): each frame they
 * step in small increments so fast shots never tunnel through thin targets.
 */
export class Projectiles {
  list: Bullet[] = [];
  private gs: GameScene;

  constructor(gs: GameScene) {
    this.gs = gs;
  }

  spawn(team: Bullet['team'], key: string, x: number, y: number, vx: number, vy: number, dmg: number, range: number, r = 2, pierce = 0): Bullet {
    const img = this.gs.add.image(Math.round(x), Math.round(y), key).setDepth(DEPTH.bullets);
    const ang = Math.atan2(vy, vx);
    // snap rotation to 90deg steps for crisp pixels; small spread is invisible anyway
    img.setRotation(Math.round(ang / (Math.PI / 2)) * (Math.PI / 2));
    const b: Bullet = { img, x, y, vx, vy, range, dmg, team, r, alive: true, pierce };
    this.list.push(b);
    return b;
  }

  spawnWave(x: number, y: number, dir: number, speed: number, dmg: number): Bullet {
    const img = this.gs.add.sprite(Math.round(x), Math.round(y), 'shockwave').setOrigin(0.5, 1).setDepth(DEPTH.bullets);
    img.play('shockwave');
    const b: Bullet = { img, x, y, vx: dir * speed, vy: 0, range: 600, dmg, team: 'enemy', r: 7, alive: true, ground: true, pierce: 0 };
    this.list.push(b);
    return b;
  }

  kill(b: Bullet, impact = false): void {
    if (!b.alive) return;
    b.alive = false;
    if (impact) this.gs.fx.spark(b.x, b.y);
    b.img.destroy();
  }

  update(dt: number): void {
    const { level, player } = this.gs;
    for (const b of this.list) {
      if (!b.alive) continue;
      const dist = Math.hypot(b.vx, b.vy) * dt;
      const steps = Math.max(1, Math.ceil(dist / 4));
      for (let s = 0; s < steps && b.alive; s++) {
        b.x += (b.vx * dt) / steps;
        b.y += (b.vy * dt) / steps;
        if (b.ground) {
          // shockwave: hugs the floor, dies at walls or ledges
          if (level.isSolid(b.x + Math.sign(b.vx) * 6, b.y - 6) || !level.isGround(b.x, b.y + 2)) {
            this.kill(b);
            this.gs.fx.dust(b.x, b.y);
            break;
          }
          if (player.hurtsAt(b.x, b.y - 5, b.r)) player.hurt(b.dmg, b.x - b.vx);
          continue;
        }
        if (level.isSolid(b.x, b.y)) {
          this.kill(b, true);
          if (b.team === 'player' && Math.random() < 0.25) sfx(this.gs, 'ricochet', { volume: 0.5 });
          break;
        }
        if (b.team === 'player') {
          const hit = this.gs.hittableAt(b.x, b.y, b.r, b.hits);
          if (hit) {
            hit.damage(b.dmg, Math.sign(b.vx) || 0);
            this.gs.mission.hits++;
            if (b.pierce > 0) {
              b.pierce--;
              (b.hits ??= new Set()).add(hit);
              this.gs.fx.spark(b.x, b.y);
            } else this.kill(b, true);
          }
        } else if (player.hurtsAt(b.x, b.y, b.r)) {
          if (player.hurt(b.dmg, b.x - b.vx)) this.kill(b, true);
        }
      }
      if (!b.alive) continue;
      b.range -= dist;
      b.img.setPosition(Math.round(b.x), Math.round(b.y));
      if (b.range <= 0 || b.x < -20 || b.x > level.width + 20 || b.y < -40 || b.y > level.height + 20) this.kill(b);
    }
    if (this.list.length > 64) this.list = this.list.filter((b) => b.alive);
  }

  /** Destroys enemy bullets inside a rectangle (knife parry). Returns count. */
  parry(rect: Phaser.Geom.Rectangle): number {
    let n = 0;
    for (const b of this.list) {
      if (b.alive && b.team === 'enemy' && !b.ground && rect.contains(b.x, b.y)) {
        this.kill(b, true);
        n++;
      }
    }
    return n;
  }

  clear(): void {
    for (const b of this.list) if (b.alive) this.kill(b);
    this.list = [];
  }
}
