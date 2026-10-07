import Phaser from 'phaser';
import { Enemy } from './Enemy';
import type { GameScene } from '../../scenes/GameScene';
import { sfx } from '../../audio/sfx';
import { GRAVITY } from '../../constants';

type State = 'patrol' | 'alert' | 'combat' | 'windup' | 'release' | 'hurt';

/** Heavy trooper that lobs bouncing grenades in an arc at the player. */
export class Grenadier extends Enemy {
  private ai: State = 'patrol';
  private t = 0;
  private walkT = 2;
  private throwCd = 1;
  private lostT = 0;

  constructor(gs: GameScene, x: number, y: number) {
    super(gs, x, y - 16, 'grenadier', 64);
    this.body.setSize(12, 24).setOffset(10, 8);
    this.drops = [
      ['scrap', 0.7],
      ['wire', 0.45],
    ];
  }

  protected onHurt(dir: number): void {
    if (this.ai === 'patrol') {
      this.faceDir(-dir || this.facing);
      this.ai = 'combat';
      this.throwCd = 0.5;
    }
  }

  protected onDie(dir: number): void {
    this.anims.play('gren-dead', true);
    this.body.setVelocity(dir * 60, -120);
    this.gs.time.delayedCall(80, () => this.fadeOut(600));
  }

  tick(dt: number): void {
    if (this.dead) return;
    const b = this.body;
    const p = this.player();
    this.t -= dt;
    switch (this.ai) {
      case 'patrol': {
        this.walkT -= dt;
        if (this.walkT <= 0) this.walkT = Phaser.Math.FloatBetween(2, 4);
        const walking = this.walkT > 1.5;
        if (walking && !this.canPatrol(this.facing)) this.faceDir(-this.facing);
        b.setVelocityX(walking ? this.facing * 18 : 0);
        this.anims.play(walking ? 'gren-walk' : 'gren-idle', true);
        if (this.canSee(230, 90)) {
          this.ai = 'alert';
          this.t = 0.5;
          b.setVelocityX(0);
          this.showAlert();
        }
        break;
      }
      case 'alert':
        this.faceDir(p.x - this.x);
        this.anims.play('gren-idle', true);
        if (this.t <= 0) this.ai = 'combat';
        break;
      case 'combat': {
        const dx = p.x - this.x;
        const dist = Math.abs(dx);
        this.faceDir(dx);
        if (dist > 330 || Math.abs(p.feetY - this.feetY) > 140 || p.mode === 'dead') {
          this.lostT += dt;
          if (this.lostT > 3) this.ai = 'patrol';
        } else this.lostT = 0;
        let move = 0;
        if (dist > 200) move = Math.sign(dx);
        else if (dist < 80) move = -Math.sign(dx);
        if (move !== 0 && !this.canWalk(move)) move = 0;
        b.setVelocityX(move * 24);
        this.anims.play(move ? 'gren-walk' : 'gren-idle', true);
        this.throwCd -= dt;
        if (this.throwCd <= 0 && dist < 240) {
          this.ai = 'windup';
          this.t = 0.4;
          b.setVelocityX(0);
        }
        break;
      }
      case 'windup':
        this.setFrame(8);
        this.anims.stop();
        if (this.t <= 0) {
          this.throwGrenade();
          this.ai = 'release';
          this.t = 0.35;
        }
        break;
      case 'release':
        this.setFrame(9);
        if (this.t <= 0) {
          this.ai = 'combat';
          this.throwCd = Phaser.Math.FloatBetween(2, 2.8);
        }
        break;
      case 'hurt':
        this.ai = 'combat';
        break;
    }
    this.setFlipX(this.facing < 0);
  }

  private throwGrenade() {
    const p = this.player();
    const sx = this.x + this.facing * 6;
    const sy = this.feetY - 26;
    const tx = p.x + p.body.velocity.x * 0.3;
    const ty = p.feetY - 4;
    const dist = Math.abs(tx - sx);
    const T = Phaser.Math.Clamp(dist / 170, 0.6, 1.15);
    const vx = (tx - sx) / T;
    const vy = (ty - sy - 0.5 * GRAVITY * T * T) / T;
    this.gs.spawnGrenade(sx, sy, vx, vy);
    sfx(this.gs, 'throw');
  }
}
