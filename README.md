# Mercenary

A 2D pixel-art run-and-gun inspired by the *gameplay loop* of contract-based shooters like Mercenary Kings: timed missions, modular gunsmithing, active reloads, and material farming. All art, characters, names, and sound are original and generated in code — there are no external asset files.

Built with Phaser 4 + TypeScript + Vite.

**Play it in your browser:** https://codexjdub.github.io/mercenary/ (keyboard or gamepad)

## Run it

```bash
npm install
npm run dev
```

Then open the printed localhost URL. Dev shortcuts:

- `?camp` — start in the base camp
- `?play=0|1|2` — skip menus and start the mission with preset loadout 0/1/2
- `?art` — sprite gallery for checking generated art

## Controls

| Action | Keyboard | Gamepad |
| --- | --- | --- |
| Move / aim | Arrows or WASD (hold Up to aim up, Down in air to aim down) | D-pad / left stick |
| Jump | Z, Space, K (Down + Jump drops through platforms) | A |
| Fire | X, J | X / RT |
| Reload / active reload | C, L — press again inside the green zone | Y |
| Knife (also slashes bullets) | V, I | B / RB |
| Eat ration | Q, H | LB |
| Pause | Esc, P, Enter | Start |

Crouch under shoulder-height shots; jump over low shots and shockwaves.

In camp: walk with the arrows, press Up at a station. In the gunsmith, Q/E switches between Assemble and Craft.

## The loop

Title → **Camp** → Mission Board → Briefing (pick loadout A/B/C) → Mission → Results → Camp.

- **Mission Board** — accept contracts; shows your best rank and time.
- **Gunsmith (Brass)** — *Assemble* fits owned parts into three loadout slots with live stat comparison; *Craft* spends materials to unlock new parts (two receivers, barrels, mags, a stock, sights).
- **Comms & Records** — career stats. Hold R for 2s to wipe the save.
- Materials you collect are banked when a mission ends; a failed run salvages half.
- Progress is saved in browser localStorage (`mercenary-save`).

## Project layout

```
src/
  art/          procedural pixel art: PixelCanvas, humanoid rig, guns, tiles, backgrounds, font
  audio/sfx.ts  tiny synthesizer that renders all sound effects at boot
  data/         gun parts + costs, stat math, save system
  game/         Player, Weapon (active reload), enemies, projectiles, effects, level parser
  levels/       ASCII-authored maps (see legend in thornback.ts)
  scenes/       Boot, Title, Camp (+ Gunsmith, Board, Records overlays), Briefing, Game, Hud, Pause, Results
  constants.ts  feel/tuning values
```

## Status: vertical slice

Done: one full mission (3 rescues + boss), three gun builds composed from parts, three enemy types plus the Foreman boss, checkpoints, lives, rations, material drops, results ranking.

Also done: walkable base camp, gunsmith crafting/assembly, persistent saves.

Next up: more missions reusing areas, music, co-op.

## License

MIT, covering the code and all generated art and sound. See [LICENSE](LICENSE).
