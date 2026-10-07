// Master palette. Everything is drawn from these so the game reads as one style.

export const P = {
  ink: '#1a1424',
  inkSoft: '#2c2338',
  white: '#f4f0e8',
  black: '#0e0b14',

  skin: '#e2a878',
  skinShade: '#b4764e',
  hair: '#3b2a1e',

  red: '#d6413a',
  redShade: '#982a30',
  redLight: '#f07050',

  olive: '#6c7c3a',
  oliveShade: '#4a5828',
  oliveLight: '#8fa04c',

  shirt: '#2c2c3c',
  khaki: '#94704a',
  khakiShade: '#6c4c32',
  boot: '#3a2e2c',
  bootLight: '#5c4a44',
  belt: '#4c3a2a',
  brass: '#e0c060',
  brassShade: '#a8883a',

  // Hexcorp enemy colors
  hexArmor: '#6a6488',
  hexArmorShade: '#4a4664',
  hexArmorLight: '#8a86aa',
  hexSuit: '#3c3a50',
  hexSuitShade: '#2a2838',
  visor: '#ff4a4a',
  visorGlow: '#ffb0a0',
  hexAccent: '#c45cf0',

  // Machines
  metal: '#7a8494',
  metalShade: '#525a68',
  metalLight: '#aab4c2',
  metalDark: '#363c48',
  hazard: '#e8b830',
  hazardShade: '#b08420',
  glass: '#5ad0e0',
  glassShade: '#2e8aa0',

  // Hostage
  overall: '#3e6ec0',
  overallShade: '#2a4c8c',
  hardhat: '#f0c838',
  rope: '#b08a50',

  // Effects
  flash: '#fff4c0',
  flashMid: '#ffd050',
  flashOut: '#ff8a30',
  fire: '#ff6a20',
  fireDark: '#c03a18',
  smoke: '#8a8494',
  smokeDark: '#5a5664',

  // World
  grass: '#5cb040',
  grassLight: '#8ad050',
  grassShade: '#3a8030',
  dirt: '#8a5a3a',
  dirtShade: '#6a4028',
  dirtDark: '#4c2c1e',
  dirtLight: '#a8724a',
  rock: '#8a8a90',
  rockShade: '#5e5e66',
  concrete: '#8c8c98',
  concreteShade: '#6a6a78',
  concreteLight: '#acacb8',
  wood: '#b07a3e',
  woodShade: '#7c5028',
  woodLight: '#d09a58',
  girder: '#c0562e',
  girderShade: '#843820',
  girderLight: '#e0784a',
  leaf: '#2e7a4a',
  leafShade: '#1e5634',
  leafLight: '#4ea060',
  trunk: '#5c3e2c',
  trunkShade: '#3e2a1e',

  // UI
  hpGood: '#6ad050',
  hpMid: '#f0c838',
  hpLow: '#e84a3a',
  ui: '#f4f0e8',
  uiDim: '#8a8494',
  uiAccent: '#f0c838',
  uiPanel: '#1a1424',
};

/** Converts '#rrggbb' to a Phaser-friendly 0xRRGGBB number. */
export function hex(c: string): number {
  return parseInt(c.slice(1), 16);
}
