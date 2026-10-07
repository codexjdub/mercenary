import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../constants';
import { Controls } from '../input/Controls';
import { P, hex } from '../art/palette';
import { text } from '../ui/text';
import { CostView, StatPanel, materialStrip, panel, wrap } from '../ui/panel';
import { sfx } from '../audio/sfx';
import { ensureGunTexture } from '../art/guns';
import { CATALOG, GunBuild, SLOTS, SLOT_LABEL, Slot, computeStats, nameBuild, part } from '../data/gunParts';
import { canAfford, commit, craft, getSave, ownedIds, owns, setLoadout } from '../data/save';

type Tab = 'assemble' | 'craft';
type Parts = Omit<GunBuild, 'name'>;

const SLOT_SHORT: Record<Slot, string> = { receiver: 'REC', barrel: 'BRL', magazine: 'MAG', stock: 'STK', sight: 'OPT' };

const strip = (b: GunBuild): Parts => ({ receiver: b.receiver, barrel: b.barrel, magazine: b.magazine, stock: b.stock, sight: b.sight });
const same = (a: Parts, b: Parts) => SLOTS.every((s) => a[s] === b[s]);

/** Brass's Gunworks: assemble loadouts from owned parts, craft new parts with materials. */
export class GunsmithScene extends Phaser.Scene {
  private c!: Controls;
  private tab: Tab = 'assemble';
  private frame!: Phaser.GameObjects.Graphics;
  private dyn!: Phaser.GameObjects.Graphics;
  private tabTexts!: Phaser.GameObjects.BitmapText[];
  private matLabels: Phaser.GameObjects.BitmapText[] = [];
  private footer!: Phaser.GameObjects.BitmapText;
  private msg!: Phaser.GameObjects.BitmapText;
  private msgT = 0;

  // assemble
  private aObjs: Phaser.GameObjects.GameObject[] = [];
  private row = 0;
  private slotIdx = 0;
  private cand!: Parts;
  private rowValues: Phaser.GameObjects.BitmapText[] = [];
  private rowCounts: Phaser.GameObjects.BitmapText[] = [];
  private rowLabels: Phaser.GameObjects.BitmapText[] = [];
  private aDesc: Phaser.GameObjects.BitmapText[] = [];
  private aStatus!: Phaser.GameObjects.BitmapText;
  private aName!: Phaser.GameObjects.BitmapText;
  private aGun!: Phaser.GameObjects.Image;
  private aStats!: StatPanel;
  private aInfo!: Phaser.GameObjects.BitmapText;

  // craft
  private cObjs: Phaser.GameObjects.GameObject[] = [];
  private items: { slot: Slot; id: string }[] = [];
  private sel = 0;
  private cRows: { name: Phaser.GameObjects.BitmapText; tag: Phaser.GameObjects.BitmapText; cost: CostView; owned: Phaser.GameObjects.BitmapText }[] = [];
  private cName!: Phaser.GameObjects.BitmapText;
  private cSlot!: Phaser.GameObjects.BitmapText;
  private cDesc: Phaser.GameObjects.BitmapText[] = [];
  private cCost!: CostView;
  private cCostLabel!: Phaser.GameObjects.BitmapText;
  private cStatus!: Phaser.GameObjects.BitmapText;
  private cGun!: Phaser.GameObjects.Image;
  private cStats!: StatPanel;

  constructor() {
    super('Gunsmith');
  }

  create(): void {
    this.c = new Controls(this);
    this.c.swallow();
    this.tab = 'assemble';
    this.row = 0;
    this.sel = 0;
    // Phaser reuses this scene instance on every visit, so per-visit UI lists
    // must be cleared here or they'd still hold the last visit's destroyed objects
    this.aObjs = [];
    this.cObjs = [];
    this.rowValues = [];
    this.rowCounts = [];
    this.rowLabels = [];
    this.aDesc = [];
    this.items = [];
    this.cRows = [];
    this.cDesc = [];
    this.msgT = 0;
    const save = getSave();
    this.slotIdx = save.equipped;
    this.cand = strip(save.loadouts[this.slotIdx]);

    this.add.rectangle(0, 0, GAME_W, GAME_H, hex(P.black), 0.85).setOrigin(0).setDepth(-3);
    this.add.rectangle(0, 0, GAME_W, 19, hex(P.ink), 1).setOrigin(0).setDepth(-3);
    this.add.rectangle(0, GAME_H - 17, GAME_W, 17, hex(P.ink), 1).setOrigin(0).setDepth(-3);
    this.frame = this.add.graphics().setDepth(-2);
    this.dyn = this.add.graphics().setDepth(-1);
    panel(this.frame, 8, 22, 228, 220, true);
    panel(this.frame, 242, 22, 230, 220);

    text(this, 10, 6, "BRASS'S GUNWORKS", { color: P.hazard });
    this.tabTexts = [text(this, 160, 6, ''), text(this, 236, 6, '')];
    this.matLabels = materialStrip(this, 352, 5, 40, 2);
    this.footer = text(this, GAME_W / 2, GAME_H - 12, '', { ox: 0.5, color: P.uiDim });
    this.msg = text(this, GAME_W / 2, GAME_H - 24, '', { ox: 0.5 }).setDepth(10);

    this.buildAssemble();
    this.buildCraft();
    this.refresh();
  }

  // ------------------------------------------------------------ assemble

  private buildAssemble() {
    const A = (o: Phaser.GameObjects.GameObject) => (this.aObjs.push(o), o);
    this.rowLabels.push(A(text(this, 16, 30, 'LOADOUT', { color: P.uiDim })) as Phaser.GameObjects.BitmapText);
    this.rowValues.push(A(text(this, 84, 30, '')) as Phaser.GameObjects.BitmapText);
    this.rowCounts.push(A(text(this, 228, 30, '', { ox: 1, color: P.uiDim })) as Phaser.GameObjects.BitmapText);
    SLOTS.forEach((slot, i) => {
      const y = 52 + i * 17;
      this.rowLabels.push(A(text(this, 16, y, SLOT_LABEL[slot], { color: P.uiDim })) as Phaser.GameObjects.BitmapText);
      this.rowValues.push(A(text(this, 84, y, '')) as Phaser.GameObjects.BitmapText);
      this.rowCounts.push(A(text(this, 228, y, '', { ox: 1, color: P.uiDim })) as Phaser.GameObjects.BitmapText);
    });
    for (let i = 0; i < 4; i++) this.aDesc.push(A(text(this, 16, 152 + i * 10, '', { color: '#c8c0d8' })) as Phaser.GameObjects.BitmapText);
    this.aStatus = A(text(this, 16, 222, '')) as Phaser.GameObjects.BitmapText;

    this.aName = A(text(this, 357, 30, '', { ox: 0.5, color: P.hazard })) as Phaser.GameObjects.BitmapText;
    this.aGun = A(this.add.image(357, 70, '__WHITE').setScale(3)) as Phaser.GameObjects.Image;
    this.aStats = new StatPanel(this, 252, 112, 212);
    this.aObjs.push(...this.aStats.objects());
    this.aInfo = A(text(this, 252, 196, '', { color: P.uiDim })) as Phaser.GameObjects.BitmapText;
    A(text(this, 252, 212, 'RELOAD WINDOW', { color: P.uiDim }));
  }

  private assembleInput() {
    const c = this.c;
    const save = getSave();
    const fitted = strip(save.loadouts[this.slotIdx]);
    if (c.justDown('up') || c.justDown('down')) {
      this.row = (this.row + (c.justDown('up') ? -1 : 1) + 6) % 6;
      this.cand = fitted;
      sfx(this, 'ui_move');
    }
    const dx = (c.justDown('right') ? 1 : 0) - (c.justDown('left') ? 1 : 0);
    if (dx !== 0) {
      sfx(this, 'ui_move');
      if (this.row === 0) {
        this.slotIdx = (this.slotIdx + dx + 3) % 3;
        save.equipped = this.slotIdx;
        commit();
        this.cand = strip(save.loadouts[this.slotIdx]);
      } else {
        const slot = SLOTS[this.row - 1];
        const opts = ownedIds(slot);
        const i = opts.indexOf(this.cand[slot]);
        this.cand = { ...this.cand, [slot]: opts[(i + dx + opts.length) % opts.length] };
      }
    }
    if (c.justDown('confirm') && this.row > 0) {
      if (!same(this.cand, fitted)) {
        const b = setLoadout(this.slotIdx, this.cand);
        save.equipped = this.slotIdx;
        commit();
        sfx(this, 'reload_done');
        this.flash(`FITTED - ${b.name}`, P.hpGood);
      } else sfx(this, 'dry');
    }
  }

  private drawAssemble() {
    const save = getSave();
    const fitted = strip(save.loadouts[this.slotIdx]);
    const changed = !same(this.cand, fitted);
    this.rowValues[0].setText(`< ${'ABC'[this.slotIdx]}: ${save.loadouts[this.slotIdx].name} >`).setTint(hex(this.row === 0 ? P.hazard : P.ui));
    this.rowLabels[0].setTint(hex(this.row === 0 ? P.ui : P.uiDim));
    SLOTS.forEach((slot, i) => {
      const r = i + 1;
      const id = this.cand[slot];
      const active = this.row === r;
      const opts = ownedIds(slot);
      const total = Object.keys(CATALOG[slot]).length;
      this.rowValues[r].setText(active ? `< ${part(slot, id).name} >` : part(slot, id).name);
      this.rowValues[r].setTint(hex(active ? (id !== fitted[slot] ? P.hpGood : P.hazard) : P.ui));
      this.rowLabels[r].setTint(hex(active ? P.ui : P.uiDim));
      this.rowCounts[r].setText(`${opts.length}/${total}`);
    });

    // selection bar
    const y = this.row === 0 ? 28 : 50 + (this.row - 1) * 17;
    this.dyn.fillStyle(hex('#2a2238'), 1).fillRect(11, y, 222, 12);

    // description of the highlighted part
    const desc = this.row === 0 ? 'SWITCH BETWEEN YOUR THREE LOADOUTS. THE SELECTED ONE IS WHAT YOU CARRY.' : part(SLOTS[this.row - 1], this.cand[SLOTS[this.row - 1]]).desc;
    const lines = wrap(desc, 30);
    this.aDesc.forEach((t, i) => t.setText(lines[i] ?? ''));
    const slot = this.row > 0 ? SLOTS[this.row - 1] : null;
    const allOwned = slot ? ownedIds(slot).length === Object.keys(CATALOG[slot]).length : true;
    this.aStatus.setText(changed ? 'ENTER TO FIT THIS PART' : slot && !allOwned ? 'CRAFT MORE PARTS: PRESS E' : '').setTint(hex(changed ? P.hpGood : P.uiDim));

    // preview
    const build = { ...this.cand, name: nameBuild(this.cand) };
    this.aName.setText(build.name);
    this.aGun.setTexture(ensureGunTexture(this, build, false).key);
    const st = computeStats(build);
    this.aStats.draw(this.dyn, st, changed ? computeStats({ ...fitted, name: '' }) : undefined);
    this.aInfo.setText(`${st.mode === 'auto' ? 'FULL AUTO' : 'SEMI AUTO'}${st.pellets > 1 ? '  SPREAD SHOT' : ''}${st.pierce ? '  PIERCING' : ''}${st.laser ? '  LASER' : ''}`);
    // active-reload window preview
    const bx = 346;
    const bw = 116;
    this.dyn.fillStyle(hex(P.inkSoft), 1).fillRect(bx, 213, bw, 5);
    this.dyn.fillStyle(hex(P.hpGood), 1).fillRect(bx + Math.round(st.sweetStart * bw), 213, Math.max(2, Math.round(st.sweetWidth * bw)), 5);
  }

  // ------------------------------------------------------------ craft

  private buildCraft() {
    const C = (o: Phaser.GameObjects.GameObject) => (this.cObjs.push(o), o);
    for (const slot of SLOTS) for (const [id, p] of Object.entries(CATALOG[slot])) if (p.cost) this.items.push({ slot, id });
    this.items.forEach((it, i) => {
      const y = 30 + i * 16;
      const tag = C(text(this, 16, y, SLOT_SHORT[it.slot], { color: P.uiDim })) as Phaser.GameObjects.BitmapText;
      const name = C(text(this, 44, y, part(it.slot, it.id).name)) as Phaser.GameObjects.BitmapText;
      const cost = new CostView(this, 150, y, 27);
      this.cObjs.push(...cost.objects());
      const owned = C(text(this, 228, y, 'OWNED', { ox: 1, color: P.hpGood })) as Phaser.GameObjects.BitmapText;
      this.cRows.push({ name, tag, cost, owned });
    });
    this.cName = C(text(this, 252, 30, '', { color: P.hazard })) as Phaser.GameObjects.BitmapText;
    this.cSlot = C(text(this, 252, 42, '', { color: P.uiDim })) as Phaser.GameObjects.BitmapText;
    for (let i = 0; i < 3; i++) this.cDesc.push(C(text(this, 252, 56 + i * 10, '', { color: '#c8c0d8' })) as Phaser.GameObjects.BitmapText);
    this.cCostLabel = C(text(this, 252, 90, 'COST', { color: P.uiDim })) as Phaser.GameObjects.BitmapText;
    this.cCost = new CostView(this, 284, 90, 34);
    this.cObjs.push(...this.cCost.objects());
    this.cStatus = C(text(this, 252, 104, '')) as Phaser.GameObjects.BitmapText;
    this.cGun = C(this.add.image(357, 132, '__WHITE').setScale(2)) as Phaser.GameObjects.Image;
    this.cStats = new StatPanel(this, 252, 156, 212);
    this.cObjs.push(...this.cStats.objects());
  }

  private craftInput() {
    const c = this.c;
    if (c.justDown('up') || c.justDown('down')) {
      this.sel = (this.sel + (c.justDown('up') ? -1 : 1) + this.items.length) % this.items.length;
      sfx(this, 'ui_move');
    }
    if (c.justDown('confirm')) {
      const it = this.items[this.sel];
      const p = part(it.slot, it.id);
      if (owns(it.slot, it.id)) {
        sfx(this, 'dry');
        this.flash('ALREADY OWNED - FIT IT IN ASSEMBLE', P.uiDim);
      } else if (craft(it.slot, it.id)) {
        sfx(this, 'perfect');
        this.cameras.main.flash(120, 255, 230, 160);
        this.flash(`CRAFTED ${p.name}!  FRESH OFF THE BENCH.`, P.hpGood);
      } else {
        sfx(this, 'jam');
        this.flash('NEED MORE MATERIALS, MERC.', P.hpLow);
      }
    }
  }

  private drawCraft() {
    const save = getSave();
    this.items.forEach((it, i) => {
      const r = this.cRows[i];
      const own = owns(it.slot, it.id);
      const p = part(it.slot, it.id);
      r.owned.setVisible(own);
      r.cost.set(own ? undefined : p.cost, save.materials);
      r.name.setTint(hex(i === this.sel ? P.hazard : own ? P.uiDim : canAfford(p.cost) ? P.ui : '#a098b0'));
    });
    this.dyn.fillStyle(hex('#2a2238'), 1).fillRect(11, 28 + this.sel * 16, 222, 12);

    const it = this.items[this.sel];
    const p = part(it.slot, it.id);
    const own = owns(it.slot, it.id);
    this.cName.setText(p.name);
    this.cSlot.setText(SLOT_LABEL[it.slot]);
    const lines = wrap(p.desc, 30);
    this.cDesc.forEach((t, i) => t.setText(lines[i] ?? ''));
    this.cCost.set(own ? undefined : p.cost, save.materials);
    this.cCostLabel.setVisible(!own);
    this.cStatus
      .setText(own ? 'OWNED - FIT IT IN ASSEMBLE (Q)' : canAfford(p.cost) ? 'ENTER TO CRAFT' : 'NOT ENOUGH MATERIALS')
      .setTint(hex(own ? P.hpGood : canAfford(p.cost) ? P.hazard : P.hpLow));

    // preview: the equipped loadout with this part swapped in
    const equipped = save.loadouts[save.equipped];
    const swapped = { ...strip(equipped), [it.slot]: it.id } as Parts;
    const build = { ...swapped, name: nameBuild(swapped) };
    this.cGun.setTexture(ensureGunTexture(this, build, false).key);
    this.cStats.draw(this.dyn, computeStats(build), computeStats(equipped));
  }

  // ------------------------------------------------------------ shared

  private flash(msg: string, color: string) {
    this.msg.setText(msg).setTint(hex(color)).setAlpha(1);
    this.msgT = 2.2;
  }

  private refresh() {
    const save = getSave();
    this.dyn.clear();
    const asm = this.tab === 'assemble';
    this.aObjs.forEach((o) => (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(asm));
    this.cObjs.forEach((o) => (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(!asm));
    this.tabTexts[0].setText(asm ? '[ASSEMBLE]' : ' ASSEMBLE ').setTint(hex(asm ? P.hazard : P.uiDim));
    this.tabTexts[1].setText(!asm ? '[CRAFT]' : ' CRAFT ').setTint(hex(!asm ? P.hazard : P.uiDim));
    this.matLabels[0].setText(String(save.materials.scrap));
    this.matLabels[1].setText(String(save.materials.wire));
    this.matLabels[2].setText(String(save.materials.alloy));
    if (asm) this.drawAssemble();
    else this.drawCraft();
    this.footer.setText(asm ? 'UP/DOWN SELECT  LEFT/RIGHT CYCLE  ENTER FIT  Q/E TAB  ESC CLOSE' : 'UP/DOWN SELECT  ENTER CRAFT  Q/E TAB  ESC CLOSE');
  }

  update(_t: number, delta: number): void {
    const c = this.c;
    c.update();
    if (this.msgT > 0) {
      this.msgT -= delta / 1000;
      if (this.msgT < 0.4) this.msg.setAlpha(Math.max(0, this.msgT / 0.4));
    }
    if (c.justDown('back')) {
      sfx(this, 'ui_move');
      this.scene.resume('Camp');
      this.scene.stop();
      return;
    }
    if (c.justDown('tabL') || c.justDown('tabR')) {
      this.tab = this.tab === 'assemble' ? 'craft' : 'assemble';
      const save = getSave();
      this.cand = strip(save.loadouts[this.slotIdx]);
      sfx(this, 'ui_ok');
    } else if (this.tab === 'assemble') this.assembleInput();
    else this.craftInput();
    this.refresh();
  }
}
