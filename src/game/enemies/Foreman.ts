import Phaser from 'phaser';
import { Enemy } from './Enemy';
import type { GameScene } from '../../scenes/GameScene';
import { sfx } from '../../audio/sfx';
import { DEPTH } from '../../constants';
import { FOREMAN_H, FOREMAN_MUZZLE, FOREMAN_W } from '../../art/sprites';

type State = 'dormant' | 'intro' | 'walk' | 'gatling' | 'stomp' | 'windup' | 'charge' | 'stunned' | 'mortar' | 'dying';
type Attack = 'gatling' | 'stomp' | 'charge' | 'mortar';

interface Shell {
  img: Phaser.GameObjects.Image;
  marker: Phaser.GameObjects.Sprite;
  x: number;
  groundY: number;
  delay: number;
  y: number;
}

const BODY_W = 34;
const BODY_H = 46;
const BODY_X = 12;

/**
 * THE FOREMAN — Hexcorp's prototype exo-walker.
 * Telegraphed attack patterns:
 *   gatling  shoulder-height sweep  → crouch (or stand on a platform)
 *   stomp    ground shockwaves      → jump
 *   charge   rams the arena wall    → jump over / platform; it's stunned after
 *   mortar   marked strikes         → move off the markers
 */
export class Foreman extends Enemy {
  ai: State = 'dormant';
  private t = 0;
  private stepT = 0;
  private shots = 0;
  private shotT = 0;
  private stomps = 0;
  private last: Attack | null = null;
  private shells: Shell[] = [];
  private boomT = 0;
  private arenaL: number;
  private arenaR: number;

  constructor(gs: GameScene, x: number, y: number, arenaL: number, arenaR: number) {
    super(gs, x, y - FOREMAN_H / 2, 'foreman', 1300);
    this.isBoss = true;
    this.contactDamage = 15;
    this.arenaL = arenaL;
    this.arenaR = arenaR;
    this.body.setSize(BODY_W, BODY_H);
    this.faceDir(-1);
    this.syncBody();
    this.play('foreman-idle');
    this.setDepth(DEPTH.enemies - 1);
    this.drops = [];
  }

  get phase2(): boolean {
    return this.hp < this.maxHp * 0.5;
  }

  private syncBody() {
    const ox = this.facing > 0 ? BODY_X : FOREMAN_W - BODY_X - BODY_W;
    this.body.setOffset(ox, FOREMAN_H - BODY_H);
  }

  protected faceDir(dir: number): void {
    super.faceDir(dir);
    if (this.body) this.syncBody();
  }

  damage(amount: number, dir: number): boolean {
    if (this.ai === 'dormant' || this.ai === 'intro' || this.ai === 'dying') return false;
    return super.damage(this.ai === 'stunned' ? amount * 1.5 : amount, dir);
  }

  activate(): void {
    this.ai = 'intro';
    this.t = 1.8;
    sfx(this.gs, 'boss_roar');
    this.gs.cameras.main.shake(900, 0.006);
    this.play('foreman-windup');
  }

  protected onDie(): void {
    this.ai = 'dying';
    this.t = 2.6;
    this.body.setVelocity(0, 0);
    this.play('foreman-stun');
    for (const s of this.shells) {
      s.img.destroy();
      s.marker.destroy();
    }
    this.shells = [];
  }

  tick(dt: number): void {
    const b = this.body;
    const p = this.player();
    this.t -= dt;
    this.updateShells(dt);

    switch (this.ai) {
      case 'dormant':
        return;
      case 'intro':
        if (this.t <= 0) this.next();
        break;
      case 'walk': {
        const dx = p.x - this.x;
        this.faceDir(dx);
        const speed = this.phase2 ? 55 : 40;
        b.setVelocityX(Math.abs(dx) > 70 ? this.facing * speed : 0);
        this.play(Math.abs(dx) > 70 ? 'foreman-walk' : 'foreman-idle', true);
        this.stepT -= dt;
        if (this.stepT <= 0 && Math.abs(dx) > 70) {
          this.stepT = 0.33;
          sfx(this.gs, 'stomp', { volume: 0.5 });
          this.gs.cameras.main.shake(60, 0.002);
        }
        if (this.t <= 0) this.choose();
        break;
      }
      case 'gatling':
        b.setVelocityX(0);
        if (this.t > 0) {
          this.play('foreman-windup', true);
          break;
        }
        this.play('foreman-fire', true);
        this.shotT -= dt;
        if (this.shotT <= 0 && this.shots > 0) {
          this.shotT = this.phase2 ? 0.075 : 0.1;
          this.shots--;
          this.fireGatling();
        }
        if (this.shots <= 0) this.next();
        break;
      case 'stomp':
        if (b.blocked.down && this.t < 0.45) {
          // landed: shockwaves both ways
          this.gs.projectiles.spawnWave(this.x - 20, this.feetY, -1, this.phase2 ? 175 : 150, 15);
          this.gs.projectiles.spawnWave(this.x + 20, this.feetY, 1, this.phase2 ? 175 : 150, 15);
          this.gs.cameras.main.shake(250, 0.012);
          sfx(this.gs, 'stomp');
          sfx(this.gs, 'explosion', { volume: 0.4 });
          this.gs.fx.dust(this.x - 18, this.feetY);
          this.gs.fx.dust(this.x + 18, this.feetY);
          this.stomps--;
          if (this.stomps > 0) {
            this.t = 0.9;
            this.hop();
          } else {
            this.ai = 'walk';
            this.t = 1;
          }
        }
        break;
      case 'windup':
        b.setVelocityX(0);
        this.play('foreman-windup', true);
        if (this.t <= 0) {
          this.ai = 'charge';
          this.t = 2.6;
          sfx(this.gs, 'boss_roar', { volume: 0.6, detune: 300 });
        }
        break;
      case 'charge': {
        this.play('foreman-charge', true);
        b.setVelocityX(this.facing * (this.phase2 ? 290 : 240));
        this.stepT -= dt;
        if (this.stepT <= 0) {
          this.stepT = 0.15;
          this.gs.fx.dust(this.x - this.facing * 16, this.feetY);
        }
        const hitWall = (this.facing > 0 && (b.blocked.right || b.right >= this.arenaR - 2)) || (this.facing < 0 && (b.blocked.left || b.left <= this.arenaL + 2));
        if (hitWall || this.t <= 0) {
          b.setVelocityX(0);
          this.ai = 'stunned';
          this.t = this.phase2 ? 1.2 : 1.6;
          this.gs.cameras.main.shake(350, 0.016);
          sfx(this.gs, 'explosion');
          this.gs.fx.explosion(this.x + this.facing * 22, this.y, 0.7);
        }
        break;
      }
      case 'stunned':
        this.play('foreman-stun', true);
        b.setVelocityX(0);
        if (Math.random() < dt * 6) this.gs.fx.spark(this.x + Phaser.Math.Between(-14, 14), this.y + Phaser.Math.Between(-20, 0));
        if (this.t <= 0) {
          this.ai = 'walk';
          this.t = 0.8;
        }
        break;
      case 'mortar':
        b.setVelocityX(0);
        this.play('foreman-idle', true);
        if (this.t <= 0) this.next();
        break;
      case 'dying':
        b.setVelocityX(0);
        this.boomT -= dt;
        this.x += Math.sin(this.t * 60) * 0.5;
        if (this.boomT <= 0) {
          this.boomT = 0.14;
          this.gs.fx.explosion(this.x + Phaser.Math.Between(-24, 24), this.y + Phaser.Math.Between(-26, 20), 0.5 + Math.random() * 0.4);
          sfx(this.gs, 'explosion', { volume: 0.5 });
        }
        if (this.t <= 0) {
          this.gs.fx.explosion(this.x, this.y, 2);
          this.gs.cameras.main.shake(600, 0.02);
          this.gs.cameras.main.flash(250, 255, 240, 200);
          sfx(this.gs, 'explosion');
          for (let i = 0; i < 3; i++) this.gs.spawnPickup('alloy', this.x, this.y);
          for (let i = 0; i < 4; i++) this.gs.spawnPickup('scrap', this.x, this.y);
          this.gs.onBossDefeated();
          this.destroy();
          return;
        }
        break;
    }

    // contact damage
    if (this.ai !== 'dying' && this.ai !== 'intro') {
      const r = this.hitRect();
      if (p.mode !== 'dead' && p.body.right > r.left + 4 && p.body.left < r.right - 4 && p.body.bottom > r.top + 6 && p.body.top < r.bottom) {
        p.hurt(this.ai === 'charge' ? 25 : this.contactDamage, this.x);
      }
    }
  }

  private next() {
    this.ai = 'walk';
    this.t = this.phase2 ? Phaser.Math.FloatBetween(0.6, 1.1) : Phaser.Math.FloatBetween(1.1, 1.7);
  }

  private choose() {
    const options: Attack[] = (['gatling', 'stomp', 'charge', 'mortar'] as Attack[]).filter((a) => a !== this.last);
    const pick = Phaser.Utils.Array.GetRandom(options) as Attack;
    this.last = pick;
    const p = this.player();
    this.faceDir(p.x - this.x);
    switch (pick) {
      case 'gatling':
        this.ai = 'gatling';
        this.t = 0.5;
        this.shots = this.phase2 ? 18 : 12;
        this.shotT = 0;
        sfx(this.gs, 'windup');
        break;
      case 'stomp':
        this.ai = 'stomp';
        this.stomps = this.phase2 ? 2 : 1;
        this.t = 0.9;
        this.hop();
        break;
      case 'charge':
        this.ai = 'windup';
        this.t = this.phase2 ? 0.55 : 0.75;
        sfx(this.gs, 'windup');
        break;
      case 'mortar':
        this.ai = 'mortar';
        this.t = 1.2;
        this.launchMortars(this.phase2 ? 5 : 3);
        break;
    }
  }

  private hop() {
    this.body.setVelocityY(-260);
    sfx(this.gs, 'windup', { volume: 0.5, detune: 500 });
  }

  private muzzle(): { x: number; y: number } {
    const left = this.x - FOREMAN_W / 2;
    const top = this.y - FOREMAN_H / 2;
    const mx = this.facing > 0 ? FOREMAN_MUZZLE.x : FOREMAN_W - FOREMAN_MUZZLE.x;
    return { x: left + mx, y: top + FOREMAN_MUZZLE.y };
  }

  private fireGatling() {
    const m = this.muzzle();
    const y = this.feetY - 20 + Phaser.Math.Between(-1, 1);
    this.gs.projectiles.spawn('enemy', 'b_boss', m.x, y, this.facing * 210, 0, 8, 520, 2);
    this.gs.fx.muzzle(m.x, m.y, 0, this.facing < 0);
    sfx(this.gs, 'shoot_boss', { volume: 0.7 });
  }

  private launchMortars(n: number) {
    sfx(this.gs, 'whistle');
    const top = this.y - FOREMAN_H / 2;
    for (let i = 0; i < 2; i++) {
      const up = this.gs.add.image(this.x - this.facing * 6 + i * 5, top + 4, 'mortar').setFlipY(true).setDepth(DEPTH.bullets);
      this.gs.tweens.add({ targets: up, y: top - 200, duration: 500, onComplete: () => up.destroy() });
    }
    const p = this.player();
    for (let i = 0; i < n; i++) {
      const spread = (i - (n - 1) / 2) * 46 + Phaser.Math.Between(-10, 10);
      const x = Phaser.Math.Clamp(p.x + spread, this.arenaL + 12, this.arenaR - 12);
      const g = this.gs.level.groundBelow(x, p.feetY - 40) ?? p.feetY;
      const marker = this.gs.add.sprite(x, g - 3, 'target').setDepth(DEPTH.fx).play('target');
      const img = this.gs.add.image(x, -50, 'mortar').setDepth(DEPTH.bullets).setVisible(false);
      this.shells.push({ img, marker, x, groundY: g, delay: 0.7 + i * 0.12, y: this.gs.cameras.main.scrollY - 20 });
    }
  }

  private updateShells(dt: number) {
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const s = this.shells[i];
      s.delay -= dt;
      if (s.delay > 0) continue;
      s.img.setVisible(true);
      s.y += 330 * dt;
      s.img.setPosition(Math.round(s.x), Math.round(s.y));
      if (s.y >= s.groundY - 4) {
        this.gs.explode(s.x, s.groundY - 6, 26, 20, 0);
        s.img.destroy();
        s.marker.destroy();
        this.shells.splice(i, 1);
      }
    }
  }
}
