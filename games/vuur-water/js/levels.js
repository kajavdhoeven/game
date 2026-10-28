// Levels worden uit een vaste tempelopzet gebouwd (3 verdiepingen met trappen) en steeds moeilijker: meer plassen, poorten met knoppen en hendels.
export const W = 32;
export const H = 20;
export const LEVEL_COUNT = 32;

// de levelkeuze: een boom van edelstenen (positie in een vlak van 1280 x 720, en welk level je eerst moet halen)
export const NODES = [
  [640, 375, 0], [640, 285, 1], [528, 345, 1], [715, 345, 1], [640, 470, 1], [528, 470, 1], [752, 470, 1],
  [528, 252, 2], [715, 252, 2], [603, 188, 2], [454, 345, 3], [790, 376, 4], [715, 545, 5], [454, 438, 6],
  [378, 500, 6], [828, 438, 7], [454, 188, 8], [790, 190, 9], [678, 158, 10], [392, 268, 11], [380, 376, 11],
  [865, 283, 12], [902, 376, 12], [902, 500, 16], [715, 625, 13], [341, 158, 17], [902, 158, 18], [600, 95, 19],
  [298, 230, 20], [304, 408, 21], [940, 252, 22], [978, 408, 23],
].map(([x, y, parent], i) => ({ n: i + 1, x, y, parent }));

const rng = (seed) => {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export function makeLevel(n) {
  const R = rng(n * 7717 + 11);
  const d = (n - 1) / (LEVEL_COUNT - 1);
  const grid = new Uint8Array(W * H);
  const liquids = []; // {type:'lava'|'water'|'goo', x, y(rij), w}
  const gates = [], buttons = [], levers = [], gems = [];
  const set = (x, y, v = 1) => { if (x >= 0 && x < W && y >= 0 && y < H) grid[y * W + x] = v; };
  const rect = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y); };
  const floors = n <= 3 ? 2 : 3;

  rect(0, 0, W - 1, 0); rect(0, 0, 0, H - 1); rect(W - 1, 0, W - 1, H - 1);
  rect(0, 18, W - 1, 19); // begane grond
  // verdieping 1: gat in de vloer rechts (schacht 1), twee richels om omhoog te springen
  rect(0, 12, 21, 12); rect(31, 12, 31, 12);
  rect(27, 16, 29, 16); // richel A (2 omhoog)
  rect(23, 14, 25, 14); // richel B (2 omhoog), daarna de vloer van verdieping 1
  const top = floors === 3 ? 6 : 12;
  if (floors === 3) {
    // verdieping 2: gat in de vloer links (schacht 2)
    rect(10, 6, 31, 6); rect(0, 6, 0, 6);
    rect(3, 10, 5, 10); // richel A'
    rect(7, 8, 9, 8); // richel B'
  }

  // plassen: gaten in de looppaden. Breedte 2 tot 3 (springbaar)
  const types = n >= 7 ? ['lava', 'water', 'goo'] : n >= 2 ? ['lava', 'water'] : [];
  const taken = []; // [x0, x1, vloer]
  const free = (x0, x1, f) => !taken.some(([a, b, ff]) => ff === f && x0 <= b + 2 && x1 >= a - 2);
  const pools = (f, y, lo, hi, count) => {
    for (let i = 0; i < count; i++) {
      const w = 2 + (R() < 0.35 + 0.4 * d ? 1 : 0);
      for (let tries = 0; tries < 12; tries++) {
        const x0 = lo + ((R() * (hi - lo - w)) | 0);
        if (!free(x0, x0 + w - 1, f)) continue;
        const type = types[(R() * types.length) | 0];
        if (!type) return;
        for (let x = x0; x < x0 + w; x++) set(x, y, 0);
        liquids.push({ type, x: x0, y, w });
        taken.push([x0, x0 + w - 1, f]);
        break;
      }
    }
  };

  // poorten met knoppen of hendels
  const gateKinds = ['#b469ff', '#ffd23a', '#41d97a'];
  let gateNo = 0;
  const addGate = (f, y, gx, ax, bx, useLever) => {
    const color = gateKinds[gateNo++ % 3];
    const id = gates.length;
    gates.push({ id, x: gx, y: y - 3, h: 3, color });
    taken.push([gx, gx, f], [ax, ax + 1, f]);
    if (useLever) levers.push({ id: levers.length, x: ax, y: y - 1, gate: id });
    else {
      buttons.push({ id: buttons.length, x: ax, y: y - 1, gate: id, color });
      buttons.push({ id: buttons.length, x: bx, y: y - 1, gate: id, color });
      taken.push([bx, bx + 1, f]);
    }
  };
  // plassen eerst, dan poorten op de resterende plekken
  pools(0, 18, 10, 23, Math.min(3, (n >= 2 ? 1 : 0) + Math.floor(n / 6)));
  pools(1, 12, 12, 20, Math.min(2, (n >= 3 ? 1 : 0) + Math.floor(n / 14)));
  if (floors === 3) pools(2, 6, 13, 24, Math.min(3, (n >= 4 ? 1 : 0) + Math.floor(n / 9)));
  const wantGates = n >= 5 ? 1 + (n >= 12) + (n >= 21) : 0;
  const spots = [[0, 18, 16, 10, 21], [1, 12, 16, 20, 12], [2, 6, 19, 14, 23]].filter((s) => s[0] < floors);
  for (let i = 0; i < wantGates && i < spots.length; i++) {
    const [f, y, gx, ax, bx] = spots[(i + n) % spots.length];
    // niet op een plas
    const blocked = taken.some(([a, b, ff]) => ff === f && (Math.abs(gx - a) < 3 || Math.abs(gx - b) < 3 || Math.abs(ax - a) < 2 || Math.abs(bx - a) < 2));
    if (blocked) continue;
    addGate(f, y, gx, f === 1 ? ax : ax, bx, n >= 8 && R() < 0.5 && f !== 1);
    // hendel links van de poort: de speler komt van links of rechts, dus een hendel werkt alleen op vloer 0 en 2
  }
  // gesloten poort op een hendelvloer: poort zelf zet 3 tegels hoog blokkade in het raster via 'gates'

  // diamanten boven de looppaden
  const gemCount = 3 + Math.floor(n / 5);
  const rows = floors === 3 ? [[0, 18, 3, 25], [1, 12, 11, 21], [2, 6, 12, 30]] : [[0, 18, 3, 25], [1, 12, 3, 21]];
  for (let i = 0; i < gemCount * 2; i++) {
    const [, y, lo, hi] = rows[i % rows.length];
    let x = lo + ((R() * (hi - lo)) | 0);
    // niet voor een deur en niet boven een plas of poort
    const dd = floors === 3 ? [25, 28] : [4, 8];
    for (let k = 0; k < 20 && ((y === top && dd.some((d) => x >= d - 1 && x <= d + 2)) || liquids.some((l) => l.y === y && x >= l.x - 1 && x <= l.x + l.w) || gates.some((gt) => Math.abs(gt.x - x) < 2 && gt.y + gt.h === y)); k++) x = lo + ((R() * (hi - lo)) | 0);
    gems.push({ type: i % 2 ? 'blue' : 'red', x: x + 0.5, y: y - 1.1 - (R() < 0.3 ? 1.2 : 0), got: false });
  }

  const doors = floors === 3
    ? { fire: { x: 25, y: top }, water: { x: 28, y: top } }
    : { fire: { x: 4, y: top }, water: { x: 8, y: top } };
  return { n, W, H, grid, liquids, gates, buttons, levers, gems, doors, starts: { fire: { x: 3.5, y: 18 }, water: { x: 6.5, y: 18 } }, floors };
}
