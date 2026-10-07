import Phaser from 'phaser';
import { DEPTH } from '../constants';
import type { Level } from './Level';
import { text } from '../ui/text';

interface Particle {
  img: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  life: number;
  spin: number;
  grav: number;
  bounced: boolean;
  fade: number;
}

/** Visual-only effects: one-shot animations and simple debris particles. */
export class Effects {
  private scene: Phaser.Scene;
  private level: Level;
  private parts: Particle[] = [];

  constructor(scene: Phaser.Scene, level: Level) {
    this.scene = scene;
    this.level = level;
  }

  oneShot(key: string, x: number, y: number, o: { flipX?: boolean; angle?: number; scale?: number; depth?: number; ox?: number; oy?: number } = {}): Phaser.GameObjects.Sprite {
    const s = this.scene.add.sprite(Math.round(x), Math.round(y), key);
    s.setDepth(o.depth ?? DEPTH.fx);
    if (o.flipX) s.setFlipX(true);
    if (o.angle) s.setAngle(o.angle);
    if (o.scale) s.setScale(o.scale);
    if (o.ox !== undefined || o.oy !== undefined) s.setOrigin(o.ox ?? 0.5, o.oy ?? 0.5);
    s.play(key);
    s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.destroy());
    return s;
  }

  spark(x: number, y: number): void {
    this.oneShot('spark', x, y);
  }

  muzzle(x: number, y: number, angle: number, flipX: boolean, big = false): void {
    // origin at the left edge so the flash grows out of the barrel
    this.oneShot('muzzle', x, y, { angle, flipX, ox: flipX ? 1 : 0, oy: 0.5, scale: big ? 1.4 : 1, depth: DEPTH.gun + 1 });
  }

  explosion(x: number, y: number, scale = 1): void {
    this.oneShot('boom', x, y, { scale });
    for (let i = 0; i < 6 * scale; i++) this.debris(x, y, Phaser.Math.Between(0, 2), 160);
    for (let i = 0; i < 3; i++) {
      this.scene.time.delayedCall(100 + i * 90, () =>
        this.oneShot('smoke', x + Phaser.Math.Between(-10, 10) * scale, y - 6 - i * 6, { scale }),
      );
    }
  }

  smoke(x: number, y: number): void {
    const s = this.oneShot('smoke', x, y);
    this.scene.tweens.add({ targets: s, y: y - 10, duration: 500 });
  }

  dust(x: number, y: number): void {
    this.oneShot('dust', x, y - 3, { depth: DEPTH.player - 1 });
  }

  slash(x: number, y: number, flipX: boolean): void {
    this.oneShot('slash', x, y, { flipX, depth: DEPTH.fx });
  }

  private particle(key: string, frame: number, x: number, y: number, vx: number, vy: number, life: number, grav = 600): void {
    const img = this.scene.add.image(x, y, key, frame).setDepth(DEPTH.fx - 1);
    this.parts.push({ img, vx, vy, life, spin: Phaser.Math.FloatBetween(-12, 12), grav, bounced: false, fade: life });
  }

  casing(x: number, y: number, dir: number, shell = false): void {
    this.particle(shell ? 'shell' : 'casing', 0, x, y, -dir * Phaser.Math.Between(30, 70), -Phaser.Math.Between(90, 150), 1.2);
  }

  debris(x: number, y: number, frame: number, power = 120): void {
    const a = Phaser.Math.FloatBetween(-Math.PI * 0.9, -Math.PI * 0.1);
    const v = Phaser.Math.FloatBetween(0.4, 1) * power;
    this.particle('debris', frame, x, y, Math.cos(a) * v, Math.sin(a) * v, 1.4);
  }

  popText(x: number, y: number, str: string, color = '#f4f0e8'): void {
    const t = text(this.scene, x, y, str, { color, ox: 0.5, oy: 1, depth: DEPTH.overlay });
    this.scene.tweens.add({
      targets: t,
      y: y - 18,
      duration: 700,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.scene.tweens.add({ targets: t, alpha: 0, duration: 250, onComplete: () => t.destroy() });
      },
    });
  }

  update(dt: number): void {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      p.vy += p.grav * dt;
      const nx = p.img.x + p.vx * dt;
      const ny = p.img.y + p.vy * dt;
      if (p.vy > 0 && this.level.isGround(nx, ny + 1) && !this.level.isGround(nx, p.img.y)) {
        if (!p.bounced) {
          p.vy *= -0.35;
          p.vx *= 0.5;
          p.bounced = true;
        } else {
          p.vy = 0;
          p.vx = 0;
          p.spin = 0;
          p.grav = 0;
        }
      } else {
        p.img.setPosition(nx, ny);
      }
      p.img.rotation += p.spin * dt;
      if (p.life < 0.3) p.img.setAlpha(Math.max(0, p.life / 0.3));
      if (p.life <= 0) {
        p.img.destroy();
        this.parts.splice(i, 1);
      }
    }
  }
}
