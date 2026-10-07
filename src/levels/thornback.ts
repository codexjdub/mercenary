// Thornback Ridge — the vertical-slice map.
//
// The map is authored as ASCII sections that are stitched left-to-right.
// Every section is ROWS tall. Rows not listed are empty; rows from `ground`
// downward are solid dirt unless explicitly listed.
//
// Legend
//   .  empty                    #  ground (auto-tiled)
//   B  concrete block           X  wooden crate (solid)
//   =  wooden plank (one-way)   -  steel girder (one-way)
//   G  boss gate (solid only while locked)
//   P  player start             C  checkpoint beacon
//   g  rifle trooper            n  grenadier
//   d  hover drone              F  the Foreman (boss)
//   h  hostage                  !  boss arena trigger (column)
//   $  supply crate (breakable) o  explosive barrel
//   t  tree   b  bush   f  fern   s  sandbags   l  lamp
//   k  warning sign   w  barbed wire   r  rock

export const ROWS = 30;

interface Section {
  w: number;
  ground: number;
  rows: Record<number, string>;
}

function fillRows(from: number, to: number, s: string): Record<number, string> {
  const out: Record<number, string> = {};
  for (let r = from; r <= to; r++) out[r] = s;
  return out;
}

// ---- A: Landing zone
const A: Section = {
  w: 42,
  ground: 26,
  rows: {
    21: '.............................$',
    22: '............................====',
    24: '....................######',
    25: '.P..t....b..f......########...g..s.o.....l',
  },
};

// ---- B: Outpost bunker (hostage 1 on the girder)
const B: Section = {
  w: 44,
  ground: 26,
  rows: {
    18: '.....................h',
    19: '..................------',
    21: '................$.......g',
    22: '...............BBBBBBBBBBBBB',
    23: '...............BBBBBBBBBBBBB',
    24: '..............XBBBBBBBBBBBBB',
    25: '..C..b..k.t..XXBBBBBBBBBBBBB.lsw.g..o...n...',
  },
};

// ---- C: Cliff climb (drones, hostage 2)
const CLIFF = '......................##############';
const C: Section = {
  w: 36,
  ground: 26,
  rows: {
    10: '..............d',
    11: '........................Cb...k',
    ...fillRows(12, 25, CLIFF),
    14: '..........-----------.##############',
    16: '.....h................##############',
    17: '...=====..............##############',
    18: '.................d....##############',
    20: '.........-----........##############',
    23: '..=====...............##############',
    25: '.f.............t...f..##############',
  },
};

// ---- D: Hexcorp camp on the plateau, then the descent
const D: Section = {
  w: 44,
  ground: 26,
  rows: {
    8: '........$',
    9: '......------',
    11: '...s..g..l.o...n',
    ...fillRows(12, 13, '###################'),
    14: '###################.f',
    ...fillRows(15, 16, '#######################'),
    17: '#######################.b',
    ...fillRows(18, 19, '###########################'),
    20: '###########################.g',
    ...fillRows(21, 24, '###############################'),
    25: '###############################....C..t..k..',
  },
};

// ---- E: Holding bunker (hostage 3 inside)
const E: Section = {
  w: 30,
  ground: 26,
  rows: {
    17: '.......s......n',
    18: '....BBBBBBBBBBBBBBBBBBBBBB',
    19: '....BBBBBBBBBBBBBBBBBBBBBB',
    20: '.---B...................B',
    21: '....B...................B',
    22: '....B...................B',
    23: '---.B...................B',
    24: '..........X',
    25: '..b.....g.XX.l...g...$h.......',
  },
};

// ---- F: Boss arena
const ARENA_WALL = '....................................####';
const ARENA_GATE = '..G.................................####';
const F: Section = {
  w: 40,
  ground: 26,
  rows: {
    ...fillRows(6, 17, ARENA_WALL),
    ...fillRows(18, 24, ARENA_GATE),
    22: '..G......====..............====.....####',
    25: 'k.G.C.!.l...........o.........F..l..####',
  },
};

const SECTIONS = [A, B, C, D, E, F];

export function buildThornback(): string[] {
  const rows: string[] = new Array(ROWS).fill('');
  for (const s of SECTIONS) {
    for (let r = 0; r < ROWS; r++) {
      let line = s.rows[r];
      if (line === undefined) line = r >= s.ground ? '#'.repeat(s.w) : '';
      if (line.length > s.w) throw new Error(`Section row ${r} too wide: ${line.length} > ${s.w}`);
      rows[r] += line.padEnd(s.w, '.');
    }
  }
  return rows;
}

export const THORNBACK_MISSION = {
  id: 'thornback',
  name: 'OPERATION CUT CHAIN',
  area: 'THORNBACK RIDGE',
  brief: [
    'HEXCORP HAS SEIZED THE RIDGE AND',
    'IS FORCING CAPTURED ENGINEERS TO',
    'BUILD WAR MACHINES.',
    '',
    'FREE THE ENGINEERS, THEN SCRAP',
    'THEIR PROTOTYPE WALKER.',
  ],
  objectives: ['RESCUE ENGINEERS', 'DESTROY THE FOREMAN'],
  hostages: 3,
};
