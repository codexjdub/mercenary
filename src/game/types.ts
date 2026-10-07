import Phaser from 'phaser';

/** Anything the player's bullets and knife can damage. */
export interface Hittable {
  readonly alive: boolean;
  hitRect(): Phaser.Geom.Rectangle;
  /** Applies damage; returns false if the target ignored it (dead, invulnerable). */
  damage(amount: number, dir: number): boolean;
}
