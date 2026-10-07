import Phaser from 'phaser';
import { Enemy } from './Enemy';
import type { GameScene } from '../../scenes/GameScene';
import { sfx } from '../../audio/sfx';

type State = 'patrol' | 'alert' | 'combat' | 'hurt' | 'dead';

/**
 * Hexcorp rifle trooper. Patrols, spots the player, then fires 3-round bursts.
 * Standing bursts fly at shoulder height (crouch to dodge); crouching bursts
 * fly low (jump to dodge).
 */
export class Grunt extends Enemy {
  private ai: State = 'patrol';
  private t = 0;
  private walkT = 0;
  private fireCd = 1;
  private burst = 0;
  private burstT = 0;
  private aiming = 0;
  private lowShot = false;
  private lostT = 0;
  /** After a flinch, ignore further flinches briefly so sustained fire can't stun-lock. */
  private flinchCd = 0;

  constructor(gs: GameScene, x: number, y: number) {
    super(gs, x, y - 16, 'grunt', 40);
    this.body.setSize(10, 24).setOffset(11, 8);
    this.facing = Math.random() < 0.5 ? -1 : 1;
    this.drops = [
      ['scrap', 0.55],
      ['wire', 0.2],
    ];
    this.walkT = Phaser.Math.FloatBetween(1, 3);
  }

  protected onHurt(dir: number): void {
    if (this.ai === 'patrol') {
      this.faceDir(-dir || this.facing);
      this.ai = 'combat';
      this.fireCd = 0.6;
    }
    if (this.burst === 0 && this.aiming <= 0 && !this.dead && this.flinchCd <= 0) {
      this.ai = 'hurt';
      this.t = 0.18;
      this.flinchCd = 0.75;
      this.body.setVelocityX(dir * 40);
    }
  }

  protected onDie(dir: number): void {
    this.ai = 'dead';
    this.anims.play('grunt-dead', true);
    this.body.setVelocity(dir * 70, -140);
    this.fadeOut(700);
  }

  tick(dt: number): void {
    if (this.dead) return;
    const b = this.body;
    const p = this.player();
    this.t -= dt;
    this.flinchCd -= dt;

    switch (this.ai) {
      case 'patrol': {
        this.walkT -= dt;
        if (this.walkT <= 0) this.walkT = Phaser.Math.FloatBetween(1.5, 3.5);
        const walking = this.walkT > 1;
        if (walking && !this.canPatrol(this.facing)) this.faceDir(-this.facing);
        b.setVelocityX(walking ? this.facing * 26 : 0);
        this.anims.play(walking ? 'grunt-walk' : 'grunt-idle', true);
        if (this.canSee(200)) {
          this.ai = 'alert';
          this.t = 0.45;
          b.setVelocityX(0);
          this.showAlert();
        }
        break;
      }
      case 'alert':
        this.faceDir(p.x - this.x);
        b.setVelocityX(0);
        this.anims.play('grunt-idle', true);
        if (this.t <= 0) {
          this.ai = 'combat';
          this.fireCd = 0.3;
        }
        break;
      case 'hurt':
        this.anims.play('grunt-hurt', true);
        if (this.t <= 0) this.ai = 'combat';
        break;
      case 'combat':
        this.combat(dt);
        break;
    }
    this.setFlipX(this.facing < 0);
  }

  private combat(dt: number) {
    const b = this.body;
    const p = this.player();
    const dx = p.x - this.x;
    const dist = Math.abs(dx);

    if (Math.abs(p.feetY - this.feetY) > 100 || dist > 320 || p.mode === 'dead') {
      this.lostT += dt;
      if (this.lostT > 2.5) {
        this.ai = 'patrol';
        this.lostT = 0;
        // drop any half-finished burst so re-engaging starts with the aim telegraph
        this.aiming = 0;
        this.burst = 0;
        return;
      }
    } else this.lostT = 0;

    // mid-burst: hold position and fire
    if (this.aiming > 0 || this.burst > 0) {
      b.setVelocityX(0);
      this.anims.play(this.lowShot ? 'grunt-crouch' : 'grunt-aim', true);
      if (this.aiming > 0) {
        this.aiming -= dt;
        return;
      }
      this.burstT -= dt;
      if (this.burstT <= 0) {
        this.fire();
        this.burst--;
        this.burstT = 0.14;
        if (this.burst === 0) this.fireCd = Phaser.Math.FloatBetween(1.4, 2.2);
      }
      return;
    }

    this.faceDir(dx);
    let move = 0;
    if (dist > 170) move = Math.sign(dx);
    else if (dist < 64) move = -Math.sign(dx);
    if (move !== 0 && !this.canWalk(move)) move = 0;
    b.setVelocityX(move * 44);
    this.anims.play(move !== 0 ? 'grunt-run' : 'grunt-idle', true);

    this.fireCd -= dt;
    const sameLevel = Math.abs(p.feetY - this.feetY) < 48;
    if (this.fireCd <= 0 && dist < 260 && sameLevel && this.gs.level.clearLine(this.x, this.feetY - 18, p.x, p.feetY - 12)) {
      this.lowShot = Math.random() < 0.35;
      this.aiming = 0.38;
      this.burst = 3;
      this.burstT = 0;
    }
  }

  private fire() {
    // shoulder height from the aim frame, or knee height when crouched
    const y = this.lowShot ? this.feetY - 8 : this.feetY - 19;
    const x = this.x + this.facing * 22;
    this.gs.projectiles.spawn('enemy', 'b_enemy', x, y, this.facing * 155, 0, 10, 300, 2);
    this.gs.fx.muzzle(x - this.facing * 2, y, 0, this.facing < 0);
    sfx(this.gs, 'shoot_enemy', { volume: 0.7 });
  }
}
