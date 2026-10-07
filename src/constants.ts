// Global tuning constants. Everything gameplay-feel related lives here so it
// can be tweaked in one place.

export const GAME_W = 480;
export const GAME_H = 270;
export const TILE = 16;

export const GRAVITY = 950;
export const MAX_FALL = 400;

export const PLAYER = {
  runSpeed: 108,
  groundAccel: 1300,
  groundDecel: 1500,
  airAccel: 800,
  jumpVel: 335,
  jumpCutVel: 120,
  coyoteTime: 0.08,
  jumpBuffer: 0.12,
  maxHp: 100,
  lives: 3,
  rations: 2,
  rationHeal: 50,
  rationTime: 0.9,
  invulnAfterHit: 1.1,
  meleeTime: 0.22,
  meleeCooldown: 0.32,
  meleeDamage: 32,
  perfectReloadBonus: 1.35,
};

export const DEPTH = {
  sky: -100,
  bg: -90,
  decor: -10,
  tiles: 0,
  props: 5,
  pickups: 8,
  enemies: 10,
  player: 20,
  gun: 21,
  bullets: 30,
  fx: 40,
  overlay: 50,
};

export const MISSION_TIME = 8 * 60;
