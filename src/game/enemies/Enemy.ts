import Phaser from 'phaser';
import { DEPTH, TILE } from '../../constants';
import type { GameScene } from '../../scenes/GameScene';
import type { Hittable } from '../types';
import type { Material } from '../Mission';
import { sfx } from '../../audio/sfx';
import { P, hex } from '../../art/palette';

export abstract class Enemy extends Phaser.Physics.Arcade.Sprite implements Hittable {
  declare body: Phaser.Physics.Arcade.Body;
  protected gs: GameScene;
  hp: number;
  maxHp: number;
  dead = false;
  facing: 1 | -1 = -1;
  contactDamage = 0;
  isBoss = false;
  /** Material drops: [material, chance] */
  protected drops: [Material, number][] = [['scrap', 0.6]];
  /** Patrol leash: enemies wander at most this far from where they spawned. */
  protected homeX: number;
  protected leash = 72;
  private flashT = 0;
  private alertIcon?: Phaser.GameObjects.Image;

  constructor(gs: GameScene, x: number, y: number, texture: string, hp: number) {
    super(gs, x, y, texture, 0);
    this.gs = gs;
    this.hp = hp;
    this.maxHp = hp;
    this.homeX = x;
    gs.add.existing(this);
    gs.physics.add.existing(this);
    this.setDepth(DEPTH.enemies);
  }

  get alive(): boolean {
    return !this.dead && this.active;
  }

  get feetY(): number {
    return this.body.bottom;
  }

  hitRect(): Phaser.Geom.Rectangle {
    const b = this.body;
    return new Phaser.Geom.Rectangle(b.x, b.y, b.width, b.height);
  }

  damage(amount: number, dir: number): void {
    if (this.dead) return;
    this.hp -= amount;
    this.flashT = 0.06;
    this.onHurt(dir);
    if (this.hp <= 0) {
      this.dead = true;
      this.gs.mission.kills++;
      sfx(this.gs, 'enemy_die');
      this.dropLoot();
      this.onDie(dir);
    } else {
      sfx(this.gs, 'hit', { volume: 0.7 });
    }
  }

  protected onHurt(_dir: number): void {}
  protected abstract onDie(dir: number): void;
  abstract tick(dt: number): void;

  protected dropLoot(): void {
    for (const [mat, chance] of this.drops) {
      if (Math.random() < chance) this.gs.spawnPickup(mat, this.x, this.body.center.y);
    }
  }

  /** Called every frame by the scene before tick. */
  preTick(dt: number): void {
    if (this.flashT > 0) {
      this.flashT -= dt;
      this.setTint(hex(P.white)).setTintMode(Phaser.TintModes.FILL);
      if (this.flashT <= 0) this.clearTint();
    }
    if (this.alertIcon) this.alertIcon.setPosition(Math.round(this.x), Math.round(this.body.top - 8));
  }

  protected showAlert(): void {
    sfx(this.gs, 'alert', { volume: 0.6 });
    this.alertIcon?.destroy();
    const icon = this.gs.add.image(this.x, this.body.top - 8, 'alert').setOrigin(0.5, 1).setDepth(DEPTH.overlay);
    this.alertIcon = icon;
    this.gs.tweens.add({ targets: icon, scaleY: { from: 0.3, to: 1 }, duration: 120, ease: 'Back.easeOut' });
    this.gs.time.delayedCall(650, () => {
      icon.destroy();
      if (this.alertIcon === icon) this.alertIcon = undefined;
    });
  }

  protected player() {
    return this.gs.player;
  }

  /** Can this enemy see the player (rough cone + line of sight)? */
  protected canSee(range: number, vertical = 40): boolean {
    const p = this.player();
    if (p.mode === 'dead') return false;
    const dx = p.x - this.x;
    const dy = p.feetY - this.feetY;
    if (Math.abs(dx) > range || Math.abs(dy) > vertical) return false;
    if (Math.sign(dx) !== this.facing && Math.abs(dx) > 64) return false;
    return this.gs.level.clearLine(this.x, this.feetY - 18, p.x, p.feetY - 14);
  }

  /** Patrol variant of canWalk that also respects the leash. */
  protected canPatrol(dir: number): boolean {
    if (dir > 0 && this.x > this.homeX + this.leash) return false;
    if (dir < 0 && this.x < this.homeX - this.leash) return false;
    return this.canWalk(dir);
  }

  /** Is there floor in front of us and no wall? */
  protected canWalk(dir: number): boolean {
    const ahead = this.x + dir * (this.body.width / 2 + 3);
    const lvl = this.gs.level;
    if (lvl.isSolid(ahead, this.feetY - 6)) return false;
    return lvl.isGround(ahead, this.feetY + 4);
  }

  protected faceDir(dir: number): void {
    if (dir !== 0) this.facing = dir > 0 ? 1 : -1;
    this.setFlipX(this.facing < 0);
  }

  protected fadeOut(delay = 700): void {
    this.body.enable = false;
    this.gs.time.delayedCall(delay, () => {
      this.gs.tweens.add({
        targets: this,
        alpha: 0,
        duration: 300,
        onComplete: () => this.destroy(),
      });
    });
  }

  protected tileX(): number {
    return Math.floor(this.x / TILE);
  }
}
