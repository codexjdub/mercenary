import Phaser from 'phaser';
import { Enemy } from './Enemy';
import type { GameScene } from '../../scenes/GameScene';
import { sfx } from '../../audio/sfx';

type State = 'hover' | 'track' | 'windup' | 'dash' | 'recover' | 'falling';

/** Hover drone: tracks above the player, then dive-bombs. Contact damage only. */
export class Drone extends Enemy {
  private ai: State = 'hover';
  private t = 0;
  private home: Phaser.Math.Vector2;
  private age = Math.random() * 10;
  private dashCd = 1.5;
  private target = new Phaser.Math.Vector2();

  constructor(gs: GameScene, x: number, y: number) {
    super(gs, x, y - 10, 'drone', 22);
    this.home = new Phaser.Math.Vector2(x, y - 10);
    this.body.setAllowGravity(false);
    this.body.setSize(16, 11).setOffset(4, 6);
    this.contactDamage = 12;
    this.drops = [
      ['wire', 0.6],
      ['scrap', 0.3],
    ];
    this.play('drone-fly');
  }

  protected onDie(dir: number): void {
    this.ai = 'falling';
    this.dead = true;
    this.body.setAllowGravity(true);
    this.body.setVelocity(dir * 60, -80);
    this.setAngularVelocity(dir * 400);
    this.t = 0.9;
  }

  /** Drones keep simulating after death so they can crash and explode. */
  tick(dt: number): void {
    this.age += dt;
    this.t -= dt;
    const b = this.body;
    const p = this.player();

    if (this.ai === 'falling') {
      if (b.blocked.down || this.t <= 0) {
        this.gs.fx.explosion(this.x, this.y, 0.6);
        sfx(this.gs, 'explosion', { volume: 0.5 });
        this.destroy();
      }
      return;
    }

    const bob = Math.sin(this.age * 4) * 6;
    const dx = p.x - this.x;
    const near = Math.abs(dx) < 170 && Math.abs(p.y - this.y) < 150 && p.mode !== 'dead';

    switch (this.ai) {
      case 'hover':
        this.seek(this.home.x + Math.sin(this.age * 0.7) * 30, this.home.y + bob, 50);
        if (near) {
          this.ai = 'track';
          this.showAlert();
        }
        break;
      case 'track':
        this.seek(p.x - Math.sign(dx || 1) * 40, p.feetY - 70 + bob, 85);
        this.dashCd -= dt;
        if (!near && Math.abs(dx) > 260) this.ai = 'hover';
        if (this.dashCd <= 0) {
          this.ai = 'windup';
          this.t = 0.5;
          this.play('drone-charge');
          this.target.set(p.x, p.feetY - 12);
        }
        break;
      case 'windup':
        b.setVelocity(0, 0);
        this.x += Math.sin(this.age * 80) * 0.6;
        if (this.t <= 0) {
          this.ai = 'dash';
          this.t = 0.6;
          const v = this.target.clone().subtract(new Phaser.Math.Vector2(this.x, this.y)).normalize().scale(240);
          b.setVelocity(v.x, v.y);
          sfx(this.gs, 'throw', { detune: 600 });
        }
        break;
      case 'dash':
        if (this.t <= 0 || b.blocked.down || b.blocked.left || b.blocked.right) {
          this.ai = 'recover';
          this.t = 0.7;
          this.play('drone-fly');
        }
        break;
      case 'recover':
        b.velocity.scale(0.9);
        if (this.t <= 0) {
          this.ai = 'track';
          this.dashCd = Phaser.Math.FloatBetween(1.6, 2.6);
        }
        break;
    }
    this.faceDir(dx);
    this.setFlipX(this.facing < 0);

    if (this.contactDamage && p.hurtsAt(this.x, this.y + 2, 7)) p.hurt(this.contactDamage, this.x);
  }

  private seek(tx: number, ty: number, speed: number) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    const v = Math.min(speed, d * 3);
    this.body.setVelocity(d > 1 ? (dx / d) * v : 0, d > 1 ? (dy / d) * v : 0);
  }
}
