import Phaser from 'phaser';

// Unified input: keyboard (two layouts at once) + gamepad. Tracks just-pressed
// edges ourselves so behavior is identical across scenes.

export type Action = 'left' | 'right' | 'up' | 'down' | 'jump' | 'fire' | 'reload' | 'melee' | 'ration' | 'pause' | 'confirm' | 'back' | 'interact' | 'tabL' | 'tabR';

const KEYMAP: Record<Action, string[]> = {
  left: ['LEFT', 'A'],
  right: ['RIGHT', 'D'],
  up: ['UP', 'W'],
  down: ['DOWN', 'S'],
  jump: ['Z', 'SPACE', 'K'],
  fire: ['X', 'J'],
  reload: ['C', 'L'],
  melee: ['V', 'I'],
  ration: ['Q', 'H'],
  pause: ['ESC', 'P', 'ENTER'],
  confirm: ['ENTER', 'Z', 'SPACE', 'X', 'J'],
  back: ['ESC', 'BACKSPACE'],
  interact: ['UP', 'W', 'X', 'J', 'ENTER', 'E'],
  tabL: ['Q', 'PAGE_UP'],
  tabR: ['E', 'PAGE_DOWN', 'TAB'],
};

// Standard gamepad mapping
const PADMAP: Partial<Record<Action, number[]>> = {
  left: [14],
  right: [15],
  up: [12],
  down: [13],
  jump: [0],
  fire: [2, 7],
  reload: [3],
  melee: [1, 5],
  ration: [4],
  pause: [9],
  confirm: [0, 9],
  back: [1, 8],
  interact: [2, 12],
  tabL: [4],
  tabR: [5],
};

export class Controls {
  private keys = new Map<Action, Phaser.Input.Keyboard.Key[]>();
  private now = new Map<Action, boolean>();
  private prev = new Map<Action, boolean>();
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const kb = scene.input.keyboard!;
    for (const [action, names] of Object.entries(KEYMAP) as [Action, string[]][]) {
      this.keys.set(
        action,
        names.map((n) => kb.addKey(n, true, false)),
      );
    }
  }

  private pad(): Phaser.Input.Gamepad.Gamepad | undefined {
    const gp = this.scene.input.gamepad;
    if (!gp || gp.total === 0) return undefined;
    return gp.getPad(0) ?? undefined;
  }

  update(): void {
    const pad = this.pad();
    for (const action of this.keys.keys()) {
      this.prev.set(action, this.now.get(action) ?? false);
      let down = this.keys.get(action)!.some((k) => k.isDown);
      if (pad) {
        const btns = PADMAP[action] ?? [];
        down ||= btns.some((b) => pad.buttons[b]?.pressed);
        const ax = pad.axes.length > 0 ? pad.axes[0].getValue() : 0;
        const ay = pad.axes.length > 1 ? pad.axes[1].getValue() : 0;
        if (action === 'left') down ||= ax < -0.4;
        if (action === 'right') down ||= ax > 0.4;
        if (action === 'up') down ||= ay < -0.55;
        if (action === 'down') down ||= ay > 0.55;
      }
      this.now.set(action, down);
    }
  }

  isDown(a: Action): boolean {
    return this.now.get(a) ?? false;
  }

  justDown(a: Action): boolean {
    return (this.now.get(a) ?? false) && !(this.prev.get(a) ?? false);
  }

  justUp(a: Action): boolean {
    return !(this.now.get(a) ?? false) && (this.prev.get(a) ?? false);
  }

  /** Prevent a held key from immediately registering in a new scene. */
  swallow(): void {
    this.update();
    for (const a of this.now.keys()) this.prev.set(a, this.now.get(a)!);
  }
}
