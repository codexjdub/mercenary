import Phaser from 'phaser';
import { DEPTH } from '../constants';
import type { GameScene } from '../scenes/GameScene';
import type { Hittable } from './types';
import type { Material } from './Mission';
import { sfx } from '../audio/sfx';
import { P, hex } from '../art/palette';

// ------------------------------------------------------------------ hostage

/** A captured engineer. Touch to free; they hand over supplies and flee. */
export class Hostage extends Phaser.GameObjects.Sprite {
  freed = false;
  private gs: GameScene;
  private fleeDir = 1;
  private t = 0;

  constructor(gs: GameScene, x: number, y: number) {
    super(gs, x, y - 16, 'hostage', 0);
    this.gs = gs;
    gs.add.existing(this);
    this.setDepth(DEPTH.enemies - 2);
    this.play('hostage-tied');
  }

  tick(dt: number): void {
    const p = this.gs.player;
    if (!this.freed) {
      this.setFlipX(p.x < this.x);
      if (p.mode !== 'dead' && Math.abs(p.x - this.x) < 14 && Math.abs(p.feetY - (this.y + 16)) < 20) this.free();
      return;
    }
    this.t -= dt;
    if (this.t <= 0 && this.anims.currentAnim?.key === 'hostage-wave') {
      this.play('hostage-run');
      this.setFlipX(this.fleeDir < 0);
      this.gs.tweens.add({ targets: this, alpha: 0, delay: 600, duration: 500, onComplete: () => this.destroy() });
    }
    if (this.anims.currentAnim?.key === 'hostage-run') {
      const nx = this.x + this.fleeDir * 70 * dt;
      if (this.gs.level.isGround(nx, this.y + 18) && !this.gs.level.isSolid(nx + this.fleeDir * 6, this.y + 8)) this.x = nx;
    }
  }

  private free() {
    this.freed = true;
    this.t = 1.0;
    this.fleeDir = this.gs.player.x < this.x ? 1 : -1;
    this.play('hostage-wave');
    this.setFlipX(this.gs.player.x < this.x);
    sfx(this.gs, 'rescue');
    this.gs.fx.popText(this.x, this.y - 18, 'THANK YOU!', P.hazard);
    this.gs.onHostageFreed(this);
  }
}

// ------------------------------------------------------------------ pickups

export type PickupKind = Material | 'ration';

export class Pickup extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  readonly kind: PickupKind;
  private gs: GameScene;
  private age = 0;
  private magnet = false;
  /** Tile collider, switched off once the pickup homes in so walls can't pin it. */
  levelCollider?: Phaser.Physics.Arcade.Collider;

  constructor(gs: GameScene, kind: PickupKind, x: number, y: number) {
    super(gs, x, y, `pk_${kind}`);
    this.gs = gs;
    this.kind = kind;
    gs.add.existing(this);
    gs.physics.add.existing(this);
    this.setDepth(DEPTH.pickups);
    this.body.setSize(8, 8);
    this.body.setBounce(0.35, 0.3);
    this.body.setDragX(120);
    this.body.setVelocity(Phaser.Math.Between(-70, 70), Phaser.Math.Between(-210, -140));
  }

  tick(dt: number): void {
    this.age += dt;
    const p = this.gs.player;
    if (p.mode === 'dead') {
      if (this.magnet) this.body.setVelocity(0, 0);
      return;
    }
    const dx = p.x - this.x;
    const dy = p.y - this.y;
    const d = Math.hypot(dx, dy);
    if (this.age > 0.45 && d < 56 && !this.magnet) {
      this.magnet = true;
      if (this.levelCollider) this.levelCollider.active = false;
    }
    if (this.magnet) {
      this.body.setAllowGravity(false);
      const v = Math.min(320, 80 + this.age * 200);
      this.body.setVelocity((dx / d) * v, (dy / d) * v);
      if (d < 10) this.collect();
    } else if (this.age > 12) {
      this.setAlpha(Math.floor(this.age * 10) % 2 ? 0.3 : 1);
      if (this.age > 15) this.destroy();
    }
  }

  private collect() {
    const names: Record<PickupKind, string> = { scrap: 'SCRAP', wire: 'WIRING', alloy: 'HEX ALLOY', ration: 'RATION' };
    if (this.kind === 'ration') {
      const p = this.gs.player;
      if (p.rations < 3) p.rations++;
      else p.heal(25);
    } else {
      this.gs.mission.materials[this.kind]++;
    }
    sfx(this.gs, 'pickup');
    this.gs.fx.popText(this.x, this.y - 6, `+${names[this.kind]}`, this.kind === 'alloy' ? '#e8a0ff' : this.kind === 'ration' ? P.hpGood : P.ui);
    this.destroy();
  }
}

// ------------------------------------------------------------------ props

export class Prop extends Phaser.GameObjects.Image implements Hittable {
  readonly kind: 'barrel' | 'supply';
  hp: number;
  private gs: GameScene;
  private flash = 0;

  constructor(gs: GameScene, kind: 'barrel' | 'supply', x: number, y: number) {
    super(gs, x, y, kind);
    this.gs = gs;
    this.kind = kind;
    this.hp = kind === 'barrel' ? 14 : 26;
    this.setOrigin(0.5, 1);
    gs.add.existing(this);
    this.setDepth(DEPTH.props);
  }

  get alive(): boolean {
    return this.active && this.hp > 0;
  }

  private rect = new Phaser.Geom.Rectangle();

  /** Current hurtbox. Returns a shared rectangle: read it, don't keep it. */
  hitRect(): Phaser.Geom.Rectangle {
    return this.rect.setTo(this.x - this.width / 2 + 1, this.y - this.height + 1, this.width - 2, this.height - 1);
  }

  damage(n: number): boolean {
    if (this.hp <= 0) return false;
    this.hp -= n;
    this.flash = 0.06;
    this.setTint(hex(P.white)).setTintMode(Phaser.TintModes.FILL);
    sfx(this.gs, 'hit', { volume: 0.5, detune: -400 });
    if (this.hp <= 0) this.gs.time.delayedCall(this.kind === 'barrel' ? 60 : 0, () => this.breakApart());
    return true;
  }

  tick(dt: number): void {
    if (this.flash > 0) {
      this.flash -= dt;
      if (this.flash <= 0) this.clearTint();
    }
  }

  private breakApart() {
    if (!this.active) return;
    const cx = this.x;
    const cy = this.y - this.height / 2;
    if (this.kind === 'barrel') {
      this.destroy();
      this.gs.explode(cx, cy, 40, 25, 70);
    } else {
      sfx(this.gs, 'enemy_die', { detune: -600 });
      for (let i = 0; i < 6; i++) this.gs.fx.debris(cx, cy, 1, 150);
      const n = Phaser.Math.Between(3, 4);
      for (let i = 0; i < n; i++) this.gs.spawnPickup(Math.random() < 0.6 ? 'scrap' : 'wire', cx, cy);
      if (Math.random() < 0.5) this.gs.spawnPickup('ration', cx, cy);
      this.destroy();
    }
  }
}

// ------------------------------------------------------------------ grenade

export class Grenade extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  private gs: GameScene;
  private fuse = 1.5;
  private bounces = 0;

  constructor(gs: GameScene, x: number, y: number, vx: number, vy: number) {
    super(gs, x, y, 'grenade', 0);
    this.gs = gs;
    gs.add.existing(this);
    gs.physics.add.existing(this);
    this.setDepth(DEPTH.bullets);
    this.body.setSize(5, 5);
    this.body.setBounce(0.45, 0.4);
    this.body.setDragX(60);
    this.body.setVelocity(vx, vy);
    this.setAngularVelocity(vx > 0 ? 600 : -600);
  }

  tick(dt: number): void {
    this.fuse -= dt;
    const b = this.body;
    if (b.blocked.down || b.blocked.left || b.blocked.right) {
      if (Math.abs(b.velocity.y) > 40 || Math.abs(b.velocity.x) > 40) {
        if (this.bounces++ < 4) sfx(this.gs, 'bounce', { volume: 0.5 });
      }
      if (b.blocked.down) this.setAngularVelocity(b.velocity.x * 6);
    }
    this.setFrame(this.fuse < 0.6 && Math.floor(this.fuse * 16) % 2 === 0 ? 1 : 0);
    if (this.fuse <= 0) {
      const { x, y } = this;
      this.destroy();
      this.gs.explode(x, y, 30, 22, 20);
    }
  }
}
