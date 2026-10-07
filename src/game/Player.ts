import Phaser from 'phaser';
import { DEPTH, PLAYER } from '../constants';
import { ANCHORS } from '../art/sprites';
import { GunArt, ensureGunTexture } from '../art/guns';
import { GunBuild, GunStats, computeStats, moveSpeed } from '../data/gunParts';
import { Weapon } from './Weapon';
import type { GameScene } from '../scenes/GameScene';
import type { Controls } from '../input/Controls';
import { sfx } from '../audio/sfx';
import { P, hex } from '../art/palette';

type Mode = 'normal' | 'melee' | 'eat' | 'hurt' | 'dead';
type Aim = 'fwd' | 'up' | 'down';

const STAND_H = 24;
const CROUCH_H = 14;

function approach(v: number, target: number, step: number): number {
  return v < target ? Math.min(v + step, target) : Math.max(v - step, target);
}

export class Player extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  private gs: GameScene;
  readonly gun: Phaser.GameObjects.Image;
  readonly gunArt: GunArt;
  readonly build: GunBuild;
  readonly stats: GunStats;
  readonly weapon: Weapon;

  facing: 1 | -1 = 1;
  hp = PLAYER.maxHp;
  lives = PLAYER.lives;
  rations = PLAYER.rations;
  mode: Mode = 'normal';
  aim: Aim = 'fwd';
  crouching = false;
  onGround = false;

  private coyote = 0;
  private buffer = 0;
  dropTimer = 0;
  invuln = 0;
  private modeT = 0;
  private meleeCd = 0;
  private meleeHit = new Set<unknown>();
  private lastVy = 0;
  private stepT = 0;
  private fireQueue = 0;

  constructor(gs: GameScene, x: number, y: number, build: GunBuild) {
    super(gs, x, y, 'rook', 0);
    this.gs = gs;
    this.build = build;
    this.stats = computeStats(build);
    this.weapon = new Weapon(this.stats);
    gs.add.existing(this);
    gs.physics.add.existing(this);
    this.setDepth(DEPTH.player);
    this.setStanding(true);
    this.body.setMaxVelocityY(400);
    this.setCollideWorldBounds(true);

    this.gunArt = ensureGunTexture(gs, build);
    this.gun = gs.add.image(x, y, this.gunArt.key).setDepth(DEPTH.gun);
  }

  get feetY(): number {
    return this.body.bottom;
  }

  get speed(): number {
    return moveSpeed(this.stats);
  }

  private setStanding(stand: boolean) {
    if (stand) this.body.setSize(10, STAND_H).setOffset(11, 32 - STAND_H);
    else this.body.setSize(10, CROUCH_H).setOffset(11, 32 - CROUCH_H);
  }

  /** Point-vs-hurtbox test used by enemy projectiles. */
  hurtsAt(x: number, y: number, r: number): boolean {
    if (this.mode === 'dead') return false;
    const b = this.body;
    return x + r > b.left + 1 && x - r < b.right - 1 && y + r > b.top + 1 && y - r < b.bottom;
  }

  hurt(dmg: number, srcX: number): boolean {
    if (this.invuln > 0 || this.mode === 'dead' || this.gs.mission.over) return false;
    this.hp -= dmg;
    this.gs.mission.damageTaken += dmg;
    this.gs.cameras.main.shake(120, 0.006);
    sfx(this.gs, 'hurt');
    this.setTint(hex(P.white)).setTintMode(Phaser.TintModes.FILL);
    this.gs.time.delayedCall(70, () => this.clearTint());
    if (this.hp <= 0) {
      this.die();
      return true;
    }
    this.mode = 'hurt';
    this.modeT = 0.28;
    this.crouching = false;
    this.setStanding(true);
    const dir = Math.sign(this.x - srcX) || -this.facing;
    this.body.setVelocity(dir * 110, -170);
    this.invuln = PLAYER.invulnAfterHit;
    return true;
  }

  private die() {
    this.hp = 0;
    this.mode = 'dead';
    this.modeT = 2.2;
    this.lives--;
    this.gs.mission.deaths++;
    this.crouching = false;
    this.setStanding(true);
    this.body.setVelocity(-this.facing * 80, -200);
    this.gs.fx.explosion(this.x, this.y, 0.6);
    sfx(this.gs, 'explosion', { volume: 0.6 });
    this.gs.onPlayerDown();
  }

  respawn(x: number, y: number) {
    this.setPosition(x, y - 16);
    this.body.reset(x, y - 16);
    this.hp = PLAYER.maxHp;
    this.mode = 'normal';
    this.invuln = 2.2;
    this.weapon.refill();
    this.setAlpha(1);
  }

  heal(n: number) {
    this.hp = Math.min(PLAYER.maxHp, this.hp + n);
  }

  update(dt: number, c: Controls): void {
    const b = this.body;
    const wasGround = this.onGround;
    this.onGround = b.blocked.down || b.touching.down;
    if (this.onGround && !wasGround && this.lastVy > 200) {
      this.gs.fx.dust(this.x, this.feetY);
      sfx(this.gs, 'land', { volume: 0.6 });
    }
    this.lastVy = b.velocity.y;

    this.coyote = this.onGround ? PLAYER.coyoteTime : this.coyote - dt;
    this.buffer -= dt;
    this.dropTimer -= dt;
    this.invuln -= dt;
    this.meleeCd -= dt;
    this.modeT -= dt;
    this.fireQueue -= dt;

    const ev = this.weapon.update(dt);
    if (ev === 'done') sfx(this.gs, 'reload_done');

    switch (this.mode) {
      case 'dead':
        b.setVelocityX(approach(b.velocity.x, 0, 300 * dt));
        if (this.modeT <= 0) this.gs.onPlayerRespawnReady();
        break;
      case 'hurt':
        if (this.modeT <= 0) this.mode = 'normal';
        break;
      case 'eat':
        b.setVelocityX(0);
        if (this.modeT <= 0) {
          this.rations--;
          this.heal(PLAYER.rationHeal);
          sfx(this.gs, 'heal');
          this.gs.fx.popText(this.x, this.feetY - 28, `+${PLAYER.rationHeal}`, P.hpGood);
          this.mode = 'normal';
        }
        break;
      case 'melee':
        this.control(dt, c, true);
        this.meleeStep();
        if (this.modeT <= 0) this.mode = 'normal';
        break;
      case 'normal':
        this.control(dt, c, false);
        break;
    }

    this.animate();
    this.placeGun();

    const blink = this.invuln > 0 && this.mode !== 'dead' && Math.floor(this.invuln * 20) % 2 === 0;
    this.setAlpha(blink ? 0.35 : 1);
    this.gun.setAlpha(this.alpha);
  }

  private control(dt: number, c: Controls, meleeing: boolean) {
    const b = this.body;
    const dir = (c.isDown('right') ? 1 : 0) - (c.isDown('left') ? 1 : 0);

    // crouch (ground only); stay down if there's no headroom
    const wantCrouch = this.onGround && c.isDown('down');
    if (wantCrouch !== this.crouching) {
      if (wantCrouch) {
        this.crouching = true;
        this.setStanding(false);
      } else if (!this.gs.level.isSolid(this.x - 4, this.feetY - STAND_H + 1) && !this.gs.level.isSolid(this.x + 4, this.feetY - STAND_H + 1)) {
        this.crouching = false;
        this.setStanding(true);
      }
    }

    if (dir !== 0 && !meleeing) this.facing = dir as 1 | -1;

    // horizontal movement
    const target = this.crouching ? 0 : dir * this.speed * (meleeing && this.onGround ? 0.3 : 1);
    const accel = this.onGround ? (dir !== 0 ? PLAYER.groundAccel : PLAYER.groundDecel) : PLAYER.airAccel;
    b.setVelocityX(approach(b.velocity.x, target, accel * dt));

    // aim
    if (c.isDown('up')) this.aim = 'up';
    else if (c.isDown('down') && !this.onGround) this.aim = 'down';
    else this.aim = 'fwd';

    // jump / drop-through
    if (c.justDown('jump')) this.buffer = PLAYER.jumpBuffer;
    if (this.buffer > 0) {
      const onPlatform = this.onGround && this.gs.level.isOneWay(this.x, this.feetY + 2) && !this.gs.level.isSolid(this.x - 4, this.feetY + 2) && !this.gs.level.isSolid(this.x + 4, this.feetY + 2);
      if (c.isDown('down') && onPlatform) {
        this.dropTimer = 0.22;
        this.buffer = 0;
        this.crouching = false;
        this.setStanding(true);
        b.setVelocityY(40);
      } else if (this.coyote > 0 && !c.isDown('down')) {
        b.setVelocityY(-PLAYER.jumpVel);
        this.buffer = 0;
        this.coyote = 0;
        this.crouching = false;
        this.setStanding(true);
        sfx(this.gs, 'jump', { volume: 0.7 });
      }
    }
    if (!c.isDown('jump') && b.velocity.y < -PLAYER.jumpCutVel) b.setVelocityY(-PLAYER.jumpCutVel);

    // footstep dust
    if (this.onGround && Math.abs(b.velocity.x) > 60) {
      this.stepT -= dt;
      if (this.stepT <= 0) {
        this.stepT = 0.3;
        if (Math.random() < 0.5) this.gs.fx.dust(this.x - this.facing * 4, this.feetY);
      }
    }

    // weapon
    const w = this.weapon;
    // semi-auto: remember a tap made slightly early so rapid tapping never eats shots
    if (this.stats.mode === 'semi' && c.justDown('fire')) this.fireQueue = Math.min(0.5, Math.max(0.18, w.cooldown + 0.08));
    const wantFire = this.stats.mode === 'auto' ? c.isDown('fire') : this.fireQueue > 0;
    if (wantFire && !meleeing) {
      if (this.stats.mode === 'semi' && w.state === 'ready' && w.ammo > 0 && w.cooldown > 0) {
        // queued: wait for the action to cycle
      } else {
        this.fireQueue = 0;
        if (w.state === 'ready' && w.ammo === 0) this.reloadPress();
        else if (w.fire()) this.shoot();
        else if (c.justDown('fire') && w.state !== 'ready') sfx(this.gs, 'dry');
      }
    }
    if (c.justDown('reload')) this.reloadPress();

    if (!meleeing && c.justDown('melee') && this.meleeCd <= 0) {
      this.mode = 'melee';
      this.modeT = PLAYER.meleeTime;
      this.meleeCd = PLAYER.meleeCooldown;
      this.meleeHit.clear();
      sfx(this.gs, 'knife');
      const r = this.meleeRect();
      this.gs.fx.slash(this.facing > 0 ? r.x + 2 : r.right - 2, r.centerY, this.facing < 0);
    }

    if (!meleeing && c.justDown('ration') && this.rations > 0 && this.hp < PLAYER.maxHp && this.onGround) {
      this.mode = 'eat';
      this.modeT = PLAYER.rationTime;
      this.crouching = false;
      this.setStanding(true);
    }
  }

  private reloadPress() {
    const ev = this.weapon.press();
    if (ev === 'started') sfx(this.gs, 'reload_start');
    else if (ev === 'perfect') {
      sfx(this.gs, 'perfect');
      this.gs.mission.perfect++;
      this.gs.fx.popText(this.x, this.feetY - 34, 'PERFECT!', P.hazard);
    } else if (ev === 'jam') {
      sfx(this.gs, 'jam');
      this.gs.mission.jams++;
      this.gs.fx.popText(this.x, this.feetY - 34, 'JAMMED', P.hpLow);
    }
  }

  private meleeRect(): Phaser.Geom.Rectangle {
    const top = this.crouching ? this.feetY - 16 : this.feetY - 26;
    const h = this.crouching ? 16 : 22;
    const x = this.facing > 0 ? this.x + 2 : this.x - 26;
    return new Phaser.Geom.Rectangle(x, top, 24, h);
  }

  private meleeStep() {
    const r = this.meleeRect();
    if (this.gs.projectiles.parry(r) > 0) {
      sfx(this.gs, 'parry');
      this.gs.fx.popText(this.x, this.feetY - 34, 'PARRY!', '#a8e0ff');
    }
    for (const t of this.gs.hittablesIn(r)) {
      if (this.meleeHit.has(t)) continue;
      this.meleeHit.add(t);
      t.damage(PLAYER.meleeDamage, this.facing);
      this.gs.cameras.main.shake(60, 0.004);
      sfx(this.gs, 'hit');
    }
  }

  /** World-space muzzle and direction for the current aim. */
  private muzzle(): { x: number; y: number; angle: number; dx: number; dy: number } {
    const g = this.gunArt;
    let ox = g.muzzle.x + 0.5 - g.grip.x;
    const oy = g.muzzle.y + 0.5 - g.grip.y;
    if (this.facing < 0) ox = -ox;
    const deg = this.gun.angle;
    const rad = Phaser.Math.DegToRad(deg);
    const x = this.gun.x + ox * Math.cos(rad) - oy * Math.sin(rad);
    const y = this.gun.y + ox * Math.sin(rad) + oy * Math.cos(rad);
    const dx = this.aim === 'fwd' ? this.facing : 0;
    const dy = this.aim === 'up' ? -1 : this.aim === 'down' ? 1 : 0;
    return { x, y, angle: deg, dx, dy };
  }

  private shoot() {
    const s = this.stats;
    const m = this.muzzle();
    const base = Math.atan2(m.dy, m.dx);
    const key = { tracer: 'b_tracer', pellet: 'b_pellet', needle: 'b_needle', slug: 'b_slug' }[s.bullet];
    for (let i = 0; i < s.pellets; i++) {
      const a = base + Phaser.Math.DegToRad(Phaser.Math.FloatBetween(-s.spread / 2, s.spread / 2));
      const sp = s.speed * (s.pellets > 1 ? Phaser.Math.FloatBetween(0.85, 1.1) : 1);
      this.gs.projectiles.spawn('player', key, m.x, m.y, Math.cos(a) * sp, Math.sin(a) * sp, this.weapon.damage, s.range * (s.pellets > 1 ? Phaser.Math.FloatBetween(0.8, 1.1) : 1), s.bullet === 'slug' ? 3 : 2, s.pierce);
      this.gs.mission.shots++;
    }
    this.gs.fx.muzzle(m.x, m.y, this.aim === 'fwd' ? 0 : this.facing > 0 ? (this.aim === 'up' ? -90 : 90) : this.aim === 'up' ? 90 : -90, this.facing < 0, s.pellets > 1);
    this.gs.fx.casing(this.gun.x + this.facing * 3, this.gun.y - 4, this.facing, s.pellets > 1);
    this.gs.cameras.main.shake(60, 0.0015 * s.shake);
    sfx(this.gs, s.pellets > 1 ? 'shoot_shotgun' : s.bullet === 'needle' ? 'shoot_smg' : s.bullet === 'slug' ? 'shoot_slug' : 'shoot_ar', { volume: 0.8 });
    if (s.pellets > 1 && this.aim === 'fwd' && !this.onGround) this.body.velocity.x -= this.facing * 60;
    if (s.pellets > 1 && this.aim === 'down' && !this.onGround && this.body.velocity.y > -60) this.body.setVelocityY(-160);
  }

  private animate() {
    let key: string;
    const b = this.body;
    if (this.mode === 'dead') key = 'rook-dead';
    else if (this.mode === 'hurt') key = 'rook-hurt';
    else if (this.mode === 'eat') key = 'rook-eat';
    else if (this.mode === 'melee') key = this.crouching ? 'rook-cmelee' : 'rook-melee';
    else if (!this.onGround) key = b.velocity.y < 0 ? 'rook-jump' : 'rook-fall';
    else if (this.crouching) key = 'rook-crouch';
    else if (Math.abs(b.velocity.x) > 12) key = 'rook-run';
    else key = 'rook-idle';
    this.anims.play(key, true);
    this.setFlipX(this.facing < 0);
  }

  private placeGun() {
    const show = this.mode === 'normal';
    this.gun.setVisible(show);
    if (!show) return;
    const frame = Number(this.frame.name);
    const anchor = ANCHORS['rook'][frame] ?? { x: 19, y: 17 };
    // Derive the sprite's top-left from the physics body: the sprite itself is
    // only synced after this update, so using this.x would lag a frame.
    const left = Math.round(this.body.x - this.body.offset.x);
    const top = Math.round(this.body.y - this.body.offset.y);
    const g = this.gunArt;
    const right = this.facing > 0;
    this.gun.setFlipX(!right);
    this.gun.setOrigin(right ? g.grip.x / g.w : (g.w - g.grip.x) / g.w, g.grip.y / g.h);
    this.gun.setPosition(left + (right ? anchor.x : 32 - anchor.x), top + anchor.y);
    let angle = 0;
    if (this.aim === 'up') angle = right ? -90 : 90;
    else if (this.aim === 'down') angle = right ? 90 : -90;
    this.gun.setAngle(angle);
  }

  /** Laser sight beam, traced until it hits a wall. */
  drawLaser(g: Phaser.GameObjects.Graphics) {
    if (!this.stats.laser || this.mode !== 'normal') return;
    const m = this.muzzle();
    let len = 0;
    while (len < 220 && !this.gs.level.isSolid(m.x + m.dx * len, m.y + m.dy * len)) len += 2;
    g.fillStyle(hex(P.visor), 0.55);
    if (m.dx !== 0) g.fillRect(m.dx > 0 ? m.x : m.x - len, Math.round(m.y) - 0.5, len, 1);
    else g.fillRect(Math.round(m.x) - 0.5, m.dy > 0 ? m.y : m.y - len, 1, len);
    g.fillStyle(hex(P.visorGlow), 0.9).fillRect(m.x + m.dx * len - 1, m.y + m.dy * len - 1, 2, 2);
  }

  /** Active-reload bar drawn above the player's head. */
  drawReloadBar(g: Phaser.GameObjects.Graphics) {
    const w = this.weapon;
    if (w.state === 'ready' || this.mode === 'dead') return;
    const bw = 30;
    const x = Math.round(this.x - bw / 2);
    const y = Math.round(this.feetY - (this.crouching ? 26 : 36));
    g.fillStyle(hex(P.ink), 1).fillRect(x - 1, y - 1, bw + 2, 6);
    if (w.state === 'reload') {
      g.fillStyle(hex(P.inkSoft), 1).fillRect(x, y, bw, 4);
      const sx = x + Math.round(w.stats.sweetStart * bw);
      const sw = Math.max(2, Math.round(w.stats.sweetWidth * bw));
      g.fillStyle(w.tried ? hex(P.uiDim) : hex(P.hpGood), 1).fillRect(sx, y, sw, 4);
      const cx = x + Math.round(w.progress * bw);
      g.fillStyle(hex(P.white), 1).fillRect(cx, y - 2, 1, 8);
    } else {
      g.fillStyle(hex(P.redShade), 1).fillRect(x, y, bw, 4);
      g.fillStyle(hex(P.hpLow), 1).fillRect(x, y, Math.round(w.progress * bw), 4);
    }
  }
}
