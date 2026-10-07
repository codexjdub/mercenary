import Phaser from 'phaser';

/** Anything the player's bullets and knife can damage. */
export interface Hittable {
  readonly alive: boolean;
  hitRect(): Phaser.Geom.Rectangle;
  damage(amount: number, dir: number): void;
}
