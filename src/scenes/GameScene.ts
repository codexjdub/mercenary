import Phaser from 'phaser';
import { DEPTH, GAME_H, GAME_W, TILE } from '../constants';
import { Level } from '../game/Level';
import { Player } from '../game/Player';
import { Controls } from '../input/Controls';
import { Effects } from '../game/Effects';
import { Projectiles } from '../game/Projectiles';
import { Mission, Material } from '../game/Mission';
import { Enemy } from '../game/enemies/Enemy';
import { Grunt } from '../game/enemies/Grunt';
import { Grenadier } from '../game/enemies/Grenadier';
import { Drone } from '../game/enemies/Drone';
import { Foreman } from '../game/enemies/Foreman';
import { Grenade, Hostage, Pickup, PickupKind, Prop } from '../game/Entities';
import type { Hittable } from '../game/types';
import { THORNBACK_MISSION, buildThornback } from '../levels/thornback';
import { GunBuild, PRESET_BUILDS } from '../data/gunParts';
import { sfx } from '../audio/sfx';
import { P } from '../art/palette';

interface Checkpoint {
  x: number;
  y: number;
  img: Phaser.GameObjects.Image;
  active: boolean;
}

export class GameScene extends Phaser.Scene {
  level!: Level;
  player!: Player;
  controls!: Controls;
  fx!: Effects;
  projectiles!: Projectiles;
  mission!: Mission;
  build!: GunBuild;

  enemies: Enemy[] = [];
  props: Prop[] = [];
  hostages: Hostage[] = [];
  pickups: Pickup[] = [];
  grenades: Grenade[] = [];
  boss: Foreman | null = null;
  bossActive = false;

  private checkpoints: Checkpoint[] = [];
  private respawnAt = { x: 0, y: 0 };
  private bossTriggered = false;
  private arena = { l: 0, r: 0, gateX: 0 };
  private bg: { far: Phaser.GameObjects.TileSprite; mid: Phaser.GameObjects.TileSprite; near: Phaser.GameObjects.TileSprite } | null = null;
  private overlayGfx!: Phaser.GameObjects.Graphics;
  private camOffX = 0;
  private lastBeep = 999;
  private failing = false;

  constructor() {
    super('Game');
  }

  init(data: { build?: GunBuild }): void {
    this.build = data.build ?? (this.registry.get('build') as GunBuild | undefined) ?? PRESET_BUILDS[0];
    this.registry.set('build', this.build);
    this.enemies = [];
    this.props = [];
    this.hostages = [];
    this.pickups = [];
    this.grenades = [];
    this.checkpoints = [];
    this.boss = null;
    this.bossActive = false;
    this.bossTriggered = false;
    this.camOffX = 0;
    this.lastBeep = 999;
    this.failing = false;
  }

  create(): void {
    this.createBackdrop();

    this.level = new Level(this, buildThornback());
    this.mission = new Mission(THORNBACK_MISSION.hostages);
    this.fx = new Effects(this, this.level);
    this.projectiles = new Projectiles(this);
    this.controls = new Controls(this);
    this.controls.swallow();
    this.physics.world.setBounds(0, 0, this.level.width, this.level.height);

    const start = this.level.spawns.find((s) => s.kind === 'P')!;
    this.respawnAt = { x: start.x, y: start.y };
    this.player = new Player(this, start.x, start.y - 16, this.build);
    this.physics.add.collider(this.player, this.level.layer, undefined, (_p, t) => this.oneWayFilter(t as Phaser.Tilemaps.Tile), this);

    for (const s of this.level.spawns) {
      switch (s.kind) {
        case 'g':
          this.addEnemy(new Grunt(this, s.x, s.y));
          break;
        case 'n':
          this.addEnemy(new Grenadier(this, s.x, s.y));
          break;
        case 'd':
          this.addEnemy(new Drone(this, s.x, s.y - 8));
          break;
        case 'F': {
          const gate = this.level.gate.reduce((a, g) => Math.max(a, g.tx), 0);
          let rx = s.tx;
          while (rx < this.level.tw && !this.level.isSolid(rx * TILE + 1, s.y - 8)) rx++;
          this.arena = { l: (gate + 1) * TILE, r: rx * TILE, gateX: gate * TILE };
          this.boss = new Foreman(this, s.x, s.y, this.arena.l, this.arena.r);
          this.addEnemy(this.boss);
          break;
        }
        case 'h':
          this.hostages.push(new Hostage(this, s.x, s.y));
          break;
        case '$':
          this.props.push(new Prop(this, 'supply', s.x, s.y));
          break;
        case 'o':
          this.props.push(new Prop(this, 'barrel', s.x, s.y));
          break;
        case 'C': {
          const img = this.add.image(s.x, s.y, 'beacon', 0).setOrigin(0.5, 1).setDepth(DEPTH.decor + 1);
          this.checkpoints.push({ x: s.x, y: s.y, img, active: false });
          break;
        }
      }
    }

    this.overlayGfx = this.add.graphics().setDepth(DEPTH.overlay);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.level.width, this.level.height);
    cam.startFollow(this.player, true, 0.14, 0.12, 0, 28);
    cam.setDeadzone(12, 50);
    cam.setRoundPixels(true);
    cam.fadeIn(400, 14, 11, 20);

    this.scene.launch('Hud');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scene.stop('Hud');
      this.projectiles.clear();
    });

    this.time.delayedCall(500, () => this.banner(THORNBACK_MISSION.name, P.hazard, true));
    this.time.delayedCall(2300, () => this.banner('RESCUE 3 ENGINEERS - DESTROY THE FOREMAN', P.ui));
  }

  // ------------------------------------------------------------ helpers

  private oneWayFilter(tile: Phaser.Tilemaps.Tile): boolean {
    if (!tile.collideLeft && tile.collideUp) {
      // one-way platform: skip while dropping through or when coming from below
      if (this.player.dropTimer > 0) return false;
      if (this.player.body.bottom - this.player.body.velocity.y / 60 > tile.pixelY + 4) return false;
    }
    return true;
  }

  private collideLevel(obj: Phaser.GameObjects.GameObject) {
    const c = this.physics.add.collider(obj, this.level.layer);
    obj.once(Phaser.GameObjects.Events.DESTROY, () => c.destroy());
  }

  private addEnemy(e: Enemy) {
    this.enemies.push(e);
    this.collideLevel(e);
    e.setCollideWorldBounds(true);
  }

  spawnPickup(kind: Material | PickupKind, x: number, y: number): void {
    const p = new Pickup(this, kind, x, y);
    this.pickups.push(p);
    this.collideLevel(p);
  }

  spawnGrenade(x: number, y: number, vx: number, vy: number): void {
    const g = new Grenade(this, x, y, vx, vy);
    this.grenades.push(g);
    this.collideLevel(g);
  }

  private hittables(): Hittable[] {
    const list: Hittable[] = [];
    for (const e of this.enemies) if (e.alive) list.push(e);
    for (const p of this.props) if (p.alive) list.push(p);
    return list;
  }

  hittableAt(x: number, y: number, r: number, exclude?: Set<Hittable>): Hittable | null {
    for (const h of this.hittables()) {
      if (exclude?.has(h)) continue;
      const rect = h.hitRect();
      if (x + r > rect.left && x - r < rect.right && y + r > rect.top && y - r < rect.bottom) return h;
    }
    return null;
  }

  hittablesIn(area: Phaser.Geom.Rectangle): Hittable[] {
    return this.hittables().filter((h) => Phaser.Geom.Intersects.RectangleToRectangle(area, h.hitRect()));
  }

  explode(x: number, y: number, radius: number, dmgPlayer: number, dmgEnemies: number): void {
    this.fx.explosion(x, y, radius / 28);
    sfx(this, 'explosion');
    this.cameras.main.shake(220, 0.01);
    if (dmgEnemies > 0) {
      for (const h of this.hittables()) {
        const r = h.hitRect();
        const cx = Phaser.Math.Clamp(x, r.left, r.right);
        const cy = Phaser.Math.Clamp(y, r.top, r.bottom);
        if (Math.hypot(cx - x, cy - y) < radius) h.damage(dmgEnemies, Math.sign(r.centerX - x));
      }
    }
    const pb = this.player.body;
    const px = Phaser.Math.Clamp(x, pb.left, pb.right);
    const py = Phaser.Math.Clamp(y, pb.top, pb.bottom);
    if (dmgPlayer > 0 && Math.hypot(px - x, py - y) < radius) this.player.hurt(dmgPlayer, x);
  }

  banner(msg: string, color: string = P.ui, big = false): void {
    this.events.emit('banner', msg, color, big);
  }

  // ------------------------------------------------------------ events from entities

  onHostageFreed(_h: Hostage): void {
    this.mission.hostages++;
    this.banner(`ENGINEER RESCUED ${this.mission.hostages}/${this.mission.hostagesTotal}`, P.hpGood);
    this.spawnPickup(this.mission.hostages % 2 === 1 ? 'ration' : 'wire', _h.x, _h.y);
    this.checkComplete();
  }

  onBossDefeated(): void {
    this.mission.bossDown = true;
    this.bossActive = false;
    this.boss = null;
    this.level.setGate(false);
    this.cameras.main.setBounds(0, 0, this.level.width, this.level.height);
    this.banner('FOREMAN DESTROYED', P.hazard, true);
    this.checkComplete();
    if (!this.mission.complete) this.time.delayedCall(2200, () => this.banner('RESCUE THE REMAINING ENGINEERS', P.ui));
  }

  onPlayerDown(): void {
    this.banner(this.player.lives > 0 ? 'MERC DOWN!' : 'NO LIVES LEFT', P.hpLow, true);
  }

  onPlayerRespawnReady(): void {
    if (this.mission.over) return;
    if (this.player.lives > 0) {
      this.player.respawn(this.respawnAt.x, this.respawnAt.y);
      this.fx.dust(this.respawnAt.x, this.respawnAt.y);
      this.banner(`BACK IN ACTION - LIVES ${this.player.lives}`, P.ui);
    } else {
      this.missionFailed('MERC KIA');
    }
  }

  private checkComplete() {
    if (!this.mission.complete || this.mission.over) return;
    this.mission.over = true;
    this.player.invuln = 99;
    this.time.delayedCall(1200, () => {
      this.banner('MISSION COMPLETE', P.hpGood, true);
      sfx(this, 'fanfare');
    });
    this.time.delayedCall(5000, () => this.finish(true, 'ALL OBJECTIVES MET'));
  }

  private missionFailed(reason: string) {
    if (this.failing) return;
    this.failing = true;
    this.mission.over = true;
    this.banner('MISSION FAILED', P.hpLow, true);
    sfx(this, 'fail');
    this.time.delayedCall(3200, () => this.finish(false, reason));
  }

  private finish(success: boolean, reason: string) {
    this.cameras.main.fadeOut(500, 14, 11, 20);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('Results', { result: this.mission.result(success, reason, this.build.name), build: this.build });
    });
  }

  private triggerBoss() {
    if (!this.boss) return;
    this.bossTriggered = true;
    this.bossActive = true;
    this.level.setGate(true);
    for (const g of this.level.gate) this.fx.dust(g.tx * TILE + 8, (g.ty + 1) * TILE);
    sfx(this, 'stomp');
    const cam = this.cameras.main;
    cam.setBounds(this.arena.gateX - 8, 0, this.level.width - (this.arena.gateX - 8), this.level.height);
    this.banner('WARNING: HEXCORP WALKER', P.hpLow, true);
    this.boss.activate();
  }

  // ------------------------------------------------------------ main loop

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 1 / 30);
    const c = this.controls;
    c.update();

    if (c.justDown('pause') && !this.mission.over) {
      this.scene.launch('Pause');
      this.scene.pause();
      this.scene.pause('Hud');
      return;
    }

    this.player.update(dt, c);

    for (const e of this.enemies) {
      if (!e.active) continue;
      e.preTick(dt);
      if (!e.dead || e instanceof Drone || e instanceof Foreman) e.tick(dt);
    }
    for (const h of this.hostages) if (h.active) h.tick(dt);
    for (const p of this.pickups) if (p.active) p.tick(dt);
    for (const g of this.grenades) if (g.active) g.tick(dt);
    for (const p of this.props) if (p.active) p.tick(dt);
    if (this.time.now % 60 < 17) {
      this.enemies = this.enemies.filter((e) => e.active);
      this.pickups = this.pickups.filter((p) => p.active);
      this.grenades = this.grenades.filter((g) => g.active);
      this.props = this.props.filter((p) => p.active);
      this.hostages = this.hostages.filter((h) => h.active);
    }

    this.projectiles.update(dt);
    this.fx.update(dt);

    // checkpoints
    for (const cp of this.checkpoints) {
      if (!cp.active && this.player.mode !== 'dead' && this.player.x > cp.x - 8 && Math.abs(this.player.feetY - cp.y) < 80) {
        cp.active = true;
        cp.img.setFrame(1);
        if (cp.x > this.respawnAt.x) this.respawnAt = { x: cp.x, y: cp.y };
        sfx(this, 'checkpoint');
        this.fx.popText(cp.x, cp.y - 32, 'CHECKPOINT', P.hpGood);
      }
    }

    // boss arena
    if (!this.bossTriggered && this.level.triggerX !== null && this.player.x > this.level.triggerX && this.player.mode !== 'dead') this.triggerBoss();

    // timer
    if (!this.mission.over) {
      this.mission.timeLeft -= dt;
      this.mission.elapsed += dt;
      const tl = this.mission.timeLeft;
      if (tl < 60 && Math.ceil(tl) !== this.lastBeep && (tl < 10 || Math.ceil(tl) % 10 === 0)) {
        this.lastBeep = Math.ceil(tl);
        sfx(this, 'beep');
      }
      if (tl <= 0) this.missionFailed('TIME UP');
    }

    // camera look-ahead
    const targetOff = -this.player.facing * 36;
    this.camOffX += (targetOff - this.camOffX) * Math.min(1, dt * 2.5);
    this.cameras.main.setFollowOffset(Math.round(this.camOffX), 28);

    this.updateBackdrop();

    this.overlayGfx.clear();
    this.player.drawLaser(this.overlayGfx);
    this.player.drawReloadBar(this.overlayGfx);
  }

  // ------------------------------------------------------------ backdrop

  private createBackdrop() {
    this.add.image(0, 0, 'bg_sky').setOrigin(0).setScrollFactor(0).setDepth(DEPTH.sky);
    const far = this.add.tileSprite(0, 0, GAME_W, 160, 'bg_far').setOrigin(0).setScrollFactor(0).setDepth(DEPTH.bg);
    const mid = this.add.tileSprite(0, 0, GAME_W, 200, 'bg_mid').setOrigin(0).setScrollFactor(0).setDepth(DEPTH.bg + 1);
    const near = this.add.tileSprite(0, 0, GAME_W, 220, 'bg_near').setOrigin(0).setScrollFactor(0).setDepth(DEPTH.bg + 2);
    this.bg = { far, mid, near };
  }

  private updateBackdrop() {
    if (!this.bg) return;
    const cam = this.cameras.main;
    const maxY = Math.max(1, this.level.height - GAME_H);
    const up = maxY - cam.scrollY; // how far the camera is above the bottom
    this.bg.far.tilePositionX = Math.round(cam.scrollX * 0.08);
    this.bg.far.y = Math.round(GAME_H - 160 + 4 + up * 0.08);
    this.bg.mid.tilePositionX = Math.round(cam.scrollX * 0.22);
    this.bg.mid.y = Math.round(GAME_H - 200 + 50 + up * 0.2);
    this.bg.near.tilePositionX = Math.round(cam.scrollX * 0.45);
    this.bg.near.y = Math.round(GAME_H - 220 + 110 + up * 0.4);
  }
}
