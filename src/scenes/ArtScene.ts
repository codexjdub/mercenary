import Phaser from 'phaser';
import { text } from '../ui/text';

/** Dev-only sprite gallery (open with ?art) for checking generated art. */
export class ArtScene extends Phaser.Scene {
  constructor() {
    super('Art');
  }

  create(): void {
    this.add.rectangle(0, 0, 2000, 2000, 0x6a88aa).setOrigin(0);
    const sheets: [string, number][] = [
      ['rook', 16],
      ['grunt', 12],
      ['grenadier', 12],
      ['hostage', 8],
    ];
    sheets.forEach(([key, n], row) => {
      for (let i = 0; i < n; i++) this.add.image(4 + i * 29, 4 + row * 33, key, i).setOrigin(0);
    });
    for (let i = 0; i < 8; i++) this.add.image(4 + i * 58, 140, 'foreman', i).setOrigin(0);
    for (let i = 0; i < 3; i++) this.add.image(4 + i * 26, 200, 'drone', i).setOrigin(0);
    this.add.image(90, 200, 'gun_mutt_field_box_brace_iron').setOrigin(0);
    this.add.image(140, 200, 'gun_brick_stub_tube_wire_iron').setOrigin(0);
    this.add.image(190, 200, 'gun_hornet_stub_drum_wire_dot').setOrigin(0);
    this.add.image(240, 200, 'tiles').setOrigin(0);
    const misc = ['d_tree', 'd_bush', 'd_fern', 'd_sandbags', 'd_lamp', 'd_sign', 'd_wire', 'd_rock', 'barrel', 'supply', 'pk_scrap', 'pk_wire', 'pk_alloy', 'pk_ration'];
    let x = 4;
    for (const k of misc) {
      const img = this.add.image(x, 266, k).setOrigin(0, 1);
      x += img.width + 4;
    }
    text(this, 240, 220, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789 !?:-+/%()');
  }
}
