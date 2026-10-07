import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../constants';
import { Controls } from '../input/Controls';
import { P, hex } from '../art/palette';
import { text } from '../ui/text';
import { materialStrip } from '../ui/panel';
import { sfx } from '../audio/sfx';
import { buildGroundStrip } from '../art/tiles';
import { ANCHORS } from '../art/sprites';
import { GunArt, attachGun, ensureGunTexture } from '../art/guns';
import { getSave, commit } from '../data/save';
import { computeStats, moveSpeed } from '../data/gunParts';

const WORLD_W = 960;
const GROUND_Y = 222;

interface Station {
  key: 'Board' | 'Gunsmith' | 'Records';
  label: string;
  x: number;
  reach: number;
}

const STATIONS: Station[] = [
  { key: 'Board', label: 'MISSION BOARD', x: 84, reach: 34 },
  { key: 'Gunsmith', label: 'GUNSMITH', x: 452, reach: 52 },
  { key: 'Records', label: 'COMMS & RECORDS', x: 728, reach: 36 },
];

const BRASS_LINES = [
  'BRING ME SCRAP, I BRING YOU FIREPOWER.',
  'HEXCORP ALLOY? NOW WE ARE TALKING.',
  'A GUN IS JUST PARTS THAT AGREE.',
  'MIND YOUR RELOAD TIMING, MERC.',
  'LONGER BARREL, LONGER ARGUMENT.',
  'THAT RIFLE OF YOURS SOUNDS THIRSTY.',
];

/** The mercenary base: walk between stations to take contracts and build guns. */
export class CampScene extends Phaser.Scene {
  private controls!: Controls;
  private merc!: Phaser.Physics.Arcade.Sprite;
  private gun!: Phaser.GameObjects.Image;
  private gunArt!: GunArt;
  private walkSpeed = 0;
  private facing: 1 | -1 = 1;
  private prompt!: Phaser.GameObjects.BitmapText;
  private near: Station | null = null;
  private matLabels: Phaser.GameObjects.BitmapText[] = [];
  private loadoutLabel!: Phaser.GameObjects.BitmapText;
  private bubble: Phaser.GameObjects.Container | null = null;
  private brassT = 3;
  private far!: Phaser.GameObjects.TileSprite;
  private mid!: Phaser.GameObjects.TileSprite;
  private glow!: Phaser.GameObjects.Image;
  private bulbs: Phaser.GameObjects.Image[] = [];
  private leaving = false;

  constructor() {
    super('Camp');
  }

  create(): void {
    this.leaving = false;
    this.near = null;
    this.bubble = null;
    this.bulbs = [];
    this.controls = new Controls(this);
    this.controls.swallow();
    buildGroundStrip(this, 'title_ground');

    // backdrop
    this.add.image(0, 0, 'bg_dusk').setOrigin(0).setScrollFactor(0).setDepth(-100);
    this.far = this.add.tileSprite(0, 92, GAME_W, 160, 'bg_far').setOrigin(0).setScrollFactor(0).setDepth(-90).setTint(0x7a6a9a);
    this.mid = this.add.tileSprite(0, 120, GAME_W, 200, 'bg_mid').setOrigin(0).setScrollFactor(0).setDepth(-89).setTint(0x52507a);
    this.add.tileSprite(0, GROUND_Y - 2, WORLD_W, 64, 'title_ground').setOrigin(0).setDepth(0);

    const base = GROUND_Y + 3;
    const put = (key: string, x: number, depth: number, flip = false) =>
      this.add.image(x, base, key).setOrigin(0.5, 1).setDepth(depth).setFlipX(flip);

    put('c_board', 84, -5);
    put('c_tent', 196, -8);
    this.add.sprite(616, base, 'c_flag').setOrigin(0.5, 1).setDepth(-7).play('c_flag');
    put('c_crates', 572, -6);
    put('c_workshop', 452, -5);
    const brass = this.add.sprite(466, GROUND_Y - 6, 'brass').setOrigin(0.5, 1).setDepth(-4).play('brass-work');
    brass.setFlipX(true);
    put('c_bench', 452, -3);
    put('c_radio', 728, -5);
    put('c_tent', 886, -8, true);

    // campfire + seats + glow
    this.glow = this.add.image(312, GROUND_Y - 12, 'c_glow').setDepth(-2).setBlendMode(Phaser.BlendModes.ADD).setScale(1.4);
    this.add.sprite(312, base - 1, 'c_fire').setOrigin(0.5, 1).setDepth(-1).play('c_fire');
    put('c_log', 278, -1);
    put('c_log', 348, -1, true);

    this.stringLights([
      [40, 150],
      [96, 166],
      [196, 140],
      [398, 146],
      [506, 146],
      [606, 148],
      [784, 160],
      [886, 140],
      [940, 150],
    ]);

    // the merc, carrying the equipped loadout
    this.merc = this.physics.add.sprite(150, GROUND_Y - 16, 'rook', 0);
    this.merc.setDepth(10);
    const body = this.merc.body as Phaser.Physics.Arcade.Body;
    body.setSize(10, 24).setOffset(11, 8);
    this.merc.setCollideWorldBounds(true);
    this.physics.world.setBounds(0, 0, WORLD_W, GROUND_Y);
    this.gun = this.add.image(0, 0, '__WHITE').setDepth(11);
    this.equipGun();

    this.prompt = text(this, 0, 0, '', { ox: 0.5, oy: 1, color: P.hazard, depth: 30 }).setVisible(false);

    // HUD
    const hud = this.add.graphics().setScrollFactor(0).setDepth(40);
    hud.fillStyle(hex(P.ink), 0.75).fillRect(0, 0, GAME_W, 18);
    hud.fillStyle(hex(P.ink), 0.6).fillRect(0, GAME_H - 15, GAME_W, 15);
    this.matLabels = materialStrip(this, 8, 5, 40, 41, true);
    text(this, GAME_W / 2, 5, 'MERCENARY CAMP', { ox: 0.5, color: P.uiDim, fixed: true, depth: 41 });
    this.loadoutLabel = text(this, GAME_W - 8, 5, '', { ox: 1, fixed: true, depth: 41 });
    text(this, GAME_W / 2, GAME_H - 11, 'ARROWS MOVE   UP INTERACT   ESC TITLE', { ox: 0.5, color: P.uiDim, fixed: true, depth: 41 });

    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, GAME_H);
    cam.startFollow(this.merc, true, 0.12, 0.12, 0, 0);
    cam.setRoundPixels(true);
    cam.fadeIn(400, 14, 11, 20);

    this.refreshHud();
    // Scene listeners survive shutdown, so remove this one or each visit stacks another
    const onResume = () => {
      this.controls.swallow();
      this.equipGun();
      this.refreshHud();
    };
    this.events.on(Phaser.Scenes.Events.RESUME, onResume);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.RESUME, onResume));

    const save = getSave();
    if (!save.seenCamp) {
      save.seenCamp = true;
      commit();
      this.time.delayedCall(600, () => this.say(84, GROUND_Y - 60, 'TAKE A CONTRACT FROM THE BOARD.'));
    }
  }

  private stringLights(points: [number, number][]) {
    const g = this.add.graphics().setDepth(-6);
    g.lineStyle(1, hex('#2a2238'), 1);
    for (let i = 0; i < points.length - 1; i++) {
      const [x0, y0] = points[i];
      const [x1, y1] = points[i + 1];
      const sag = 10;
      let prev: [number, number] = [x0, y0];
      const steps = Math.ceil((x1 - x0) / 4);
      for (let k = 1; k <= steps; k++) {
        const t = k / steps;
        const x = x0 + (x1 - x0) * t;
        const y = y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * sag;
        g.lineBetween(prev[0], prev[1], x, y);
        prev = [x, y];
        if (k % 4 === 2) this.bulbs.push(this.add.image(Math.round(x), Math.round(y) + 1, 'c_bulb', 0).setOrigin(0.5, 0).setDepth(-6));
      }
    }
  }

  private equipGun() {
    const save = getSave();
    const build = save.loadouts[save.equipped];
    this.gunArt = ensureGunTexture(this, build);
    this.gun.setTexture(this.gunArt.key);
    this.walkSpeed = moveSpeed(computeStats(build));
  }

  private refreshHud() {
    const save = getSave();
    this.matLabels[0].setText(String(save.materials.scrap));
    this.matLabels[1].setText(String(save.materials.wire));
    this.matLabels[2].setText(String(save.materials.alloy));
    const b = save.loadouts[save.equipped];
    this.loadoutLabel.setText(`LOADOUT ${'ABC'[save.equipped]}: ${b.name}`);
  }

  /** Speech bubble anchored in the world. */
  private say(x: number, y: number, line: string) {
    this.bubble?.destroy();
    const t = text(this, 0, 0, line, { ox: 0.5, oy: 0.5, color: '#2c2338' });
    const w = t.width + 10;
    const g = this.add.graphics();
    g.fillStyle(hex('#f4ecd8'), 1).fillRect(-w / 2, -8, w, 15);
    g.lineStyle(1, hex(P.ink), 1).strokeRect(-w / 2 + 0.5, -7.5, w - 1, 14);
    const tip = Phaser.Math.Clamp(x - Phaser.Math.Clamp(x, w / 2 + 4, WORLD_W - w / 2 - 4), -w / 2 + 6, w / 2 - 6);
    g.fillStyle(hex('#f4ecd8'), 1).fillTriangle(tip - 3, 7, tip + 3, 7, tip, 11);
    const cx = Phaser.Math.Clamp(x, w / 2 + 4, WORLD_W - w / 2 - 4);
    const c = this.add.container(Math.round(cx), Math.round(y), [g, t]).setDepth(35);
    this.bubble = c;
    c.setScale(1, 0);
    this.tweens.add({ targets: c, scaleY: 1, duration: 120, ease: 'Back.easeOut' });
    this.time.delayedCall(3200, () => {
      if (this.bubble !== c) return;
      this.tweens.add({ targets: c, alpha: 0, duration: 250, onComplete: () => c.destroy() });
      this.bubble = null;
    });
  }

  update(time: number, delta: number): void {
    const c = this.controls;
    c.update();
    const dt = Math.min(delta / 1000, 1 / 30);
    const body = this.merc.body as Phaser.Physics.Arcade.Body;
    const onGround = body.blocked.down;

    if (!this.leaving) {
      const dir = (c.isDown('right') ? 1 : 0) - (c.isDown('left') ? 1 : 0);
      if (dir) this.facing = dir as 1 | -1;
      const target = dir * this.walkSpeed;
      const vx = body.velocity.x;
      body.setVelocityX(vx + Math.sign(target - vx) * Math.min(Math.abs(target - vx), 1300 * dt));
      if (c.justDown('jump') && onGround) {
        body.setVelocityY(-300);
        sfx(this, 'jump', { volume: 0.6 });
      }
      if (c.justDown('back')) {
        this.leaving = true;
        this.cameras.main.fadeOut(300, 14, 11, 20);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Title'));
      }
    } else body.setVelocityX(0);

    // animation + held gun
    const anim = !onGround ? (body.velocity.y < 0 ? 'rook-jump' : 'rook-fall') : Math.abs(body.velocity.x) > 12 ? 'rook-run' : 'rook-idle';
    this.merc.anims.play(anim, true);
    this.merc.setFlipX(this.facing < 0);
    const frame = Number(this.merc.frame.name);
    const a = ANCHORS['rook'][frame] ?? { x: 19, y: 17 };
    const left = Math.round(body.x - body.offset.x);
    const top = Math.round(body.y - body.offset.y);
    attachGun(this.gun, this.gunArt, left, top, a, this.facing > 0);

    // stations
    const near = STATIONS.find((s) => Math.abs(this.merc.x - s.x) < s.reach) ?? null;
    if (near !== this.near) {
      this.near = near;
      if (near) sfx(this, 'ui_move', { volume: 0.4 });
    }
    if (near) {
      this.prompt.setVisible(true).setText(`^ ${near.label}`);
      this.prompt.setPosition(Math.round(near.x), GROUND_Y - 78 + Math.round(Math.sin(time / 200) * 2));
      if (!this.leaving && c.justDown('interact') && onGround) this.open(near);
    } else this.prompt.setVisible(false);

    // Brass chatter when you're nearby
    this.brassT -= dt;
    if (this.brassT <= 0 && Math.abs(this.merc.x - 452) < 140 && !this.bubble) {
      this.brassT = Phaser.Math.FloatBetween(7, 11);
      this.say(466, GROUND_Y - 50, Phaser.Utils.Array.GetRandom(BRASS_LINES) as string);
    }

    // ambience
    const cam = this.cameras.main;
    this.far.tilePositionX = Math.round(cam.scrollX * 0.08);
    this.mid.tilePositionX = Math.round(cam.scrollX * 0.22);
    this.glow.setAlpha(0.75 + Math.sin(time / 90) * 0.12 + Math.sin(time / 37) * 0.08);
    this.bulbs.forEach((b, i) => b.setFrame(Math.sin(time / 600 + i * 1.7) > 0.92 ? 1 : 0));
  }

  private open(s: Station) {
    sfx(this, 'ui_ok');
    (this.merc.body as Phaser.Physics.Arcade.Body).setVelocityX(0);
    this.prompt.setVisible(false);
    this.scene.launch(s.key);
    this.scene.pause();
  }
}
