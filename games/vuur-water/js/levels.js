// De levels worden uit bouwstenen opgebouwd: elke verdieping krijgt een rij obstakels (plassen, poorten met knoppen of hendels, kratten, bruggen
// en draaiende planken boven smurrie). Wat erin komt, en hoe vol het wordt, hangt af van hoe ver het level van het midden van de levelboom ligt.
export const W = 32;
export const H = 22;
export const LEVEL_COUNT = 32;
export const Y = [20, 13, 6]; // de vloer (bovenkant) van de drie verdiepingen

// de levelkeuze: een boom van edelstenen (positie in een vlak van 1280 x 720, en welk level je eerst moet halen)
export const NODES = [
  [640, 375, 0], [640, 285, 1], [528, 345, 1], [715, 345, 1], [640, 470, 1], [528, 470, 1], [752, 470, 1],
  [528, 252, 2], [715, 252, 2], [603, 188, 2], [454, 345, 3], [790, 376, 4], [715, 545, 5], [454, 438, 6],
  [378, 500, 14], [828, 438, 7], [454, 188, 8], [790, 190, 9], [678, 158, 10], [392, 268, 11], [380, 376, 11],
  [865, 283, 12], [902, 376, 12], [902, 500, 16], [715, 625, 13], [341, 158, 17], [902, 158, 18], [600, 95, 19],
  [298, 230, 20], [304, 408, 21], [940, 252, 22], [978, 408, 23],
].map(([x, y, parent], i) => ({ n: i + 1, x, y, parent }));
const PARENTS = new Set(NODES.map((nd) => nd.parent));
// de buitenste levels: die zonder volgend level (10 stuks). Alle gehaald = regenbogen.
export const OUTER = NODES.filter((nd) => !PARENTS.has(nd.n)).map((nd) => nd.n);
export const depthOf = (n) => { let d = 0, nd = NODES[n - 1]; while (nd && nd.parent) { d++; nd = NODES[nd.parent - 1]; } return d; };

const rng = (seed) => {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const COLORS = ['#3b8cff', '#41d97a', '#b469ff', '#ffd23a', '#ff8a3d', '#ff5ea8'];

// Welk obstakel komt voor het eerst in welk level (de rest van de levels mag het daarna ook gebruiken)
const INTRO = { 4: 'lever', 5: 'btn', 6: 'crate', 7: 'goo', 9: 'bridge', 11: 'plank1', 17: 'plank2' };
const UNLOCK = { pool: 2, lever: 4, btn: 5, crate: 6, goo: 7, bridge: 9, plank1: 11, plank2: 17 };
const WIDTH = { pool: 3, lever: 5, btn: 5, crate: 10, goo: 3, bridge: 8, plank1: 7, plank2: 10, plateau: 3 };

export function makeLevel(n, force) {
  const R = rng(n * 7717 + 11);
  const depth = depthOf(n);
  const grid = new Uint8Array(W * H);
  const liquids = [], gates = [], buttons = [], levers = [], bridges = [], crates = [], planks = [], gems = [];
  const vadd = []; // extra vaste tegels voor de controle (kratten, planken en bruggen zijn daar al "opgelost")
  const set = (x, y, v = 1) => { if (x >= 0 && x < W && y >= 0 && y < H) grid[y * W + x] = v; };
  const rect = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y); };
  const colorOf = () => COLORS[(gates.length + bridges.length) % COLORS.length];

  // ---- indeling
  const floors = force && force.floors ? force.floors : n === 1 ? 1 : n <= 7 ? 2 : depth === 2 ? (R() < 0.5 ? 2 : 3) : 3;
  const mirror = R() < 0.5;
  const ws = 2;
  const xs1 = 15 + ((R() * 8) | 0);  // einde van de vloer van verdieping 1 (gat rechts)
  const xs2 = 9 + ((R() * 5) | 0);   // begin van de vloer van verdieping 2 (gat links)
  rect(0, 0, W - 1, 0); rect(0, 0, 0, H - 1); rect(W - 1, 0, W - 1, H - 1);
  rect(0, 20, W - 1, 21); // begane grond
  if (floors >= 2) {
    rect(0, 13, xs1, 14); // vloer van verdieping 1
    // drie zwevende treden omhoog naar verdieping 1: de hoogste ligt tegen de vloer, je loopt eronderdoor naar de laagste
    rect(xs1 + 1, 14, xs1 + ws, 14); rect(xs1 + ws + 2, 16, xs1 + 2 * ws + 1, 16); rect(xs1 + 2 * ws + 3, 18, xs1 + 3 * ws + 2, 18);
  }
  if (floors === 3) {
    rect(xs2, 6, W - 2, 7); // vloer van verdieping 2
    rect(xs2 - ws, 7, xs2 - 1, 7); rect(xs2 - 2 * ws - 1, 9, xs2 - ws - 2, 9); rect(xs2 - 3 * ws - 2, 11, xs2 - 2 * ws - 3, 11);
  }

  // ---- gangen: [verdieping, eerste tegel, laatste tegel, looprichting]
  const corridors = [];
  if (floors === 1) corridors.push([0, 2, 24, 1]);
  else corridors.push([0, 2, xs1 - 1, 1]);
  if (floors === 2) corridors.push([1, 10, xs1 - 1, -1]);
  if (floors === 3) { corridors.push([1, xs2, xs1 - 1, -1]); corridors.push([2, xs2 + 1, 22, 1]); }
  const doors = floors === 1 ? { fire: { x: 25, y: Y[0] }, water: { x: 28, y: Y[0] } }
    : floors === 2 ? { fire: { x: 3, y: Y[1] }, water: { x: 6, y: Y[1] } }
      : { fire: { x: 24, y: Y[2] }, water: { x: 27, y: Y[2] } };

  // ---- welke obstakels komen erin
  const allowed = Object.keys(UNLOCK).filter((k) => n >= UNLOCK[k]);
  const want = 1 + depth + (n > 6 ? 1 : 0) - (n === 1 ? 1 : 0);
  const pickType = () => {
    const pool = ['plateau', 'plateau'];
    for (const k of allowed) { pool.push(k); if (k === 'pool') pool.push('pool'); }
    return pool[(R() * pool.length) | 0];
  };
  const lists = corridors.map(() => []);
  const intro = force ? null : INTRO[n];
  for (let i = 0; i < want; i++) lists[(R() * corridors.length) | 0].push(force && force.types ? force.types[i % force.types.length] : pickType());
  if (force && force.types) { lists.forEach((l) => { l.length = 0; }); lists[0] = force.types.slice(); }
  if (intro) lists[0].unshift(intro); // het nieuwe obstakel staat op de langste gang (de begane grond)

  const ceilAt = (x, y) => { for (let yy = y - 1; yy >= 0; yy--) if (grid[yy * W + x]) return yy + 1; return 1; };
  const taken = []; // [x0, x1, verdieping] voor de edelstenen
  let gateCount = 0;
  corridors.forEach(([f, a, b, d], ci) => {
    const Yf = Y[f];
    const X = (u) => (d > 0 ? a + u : b - u);
    const L = Math.abs(b - a) + 1;
    let u = ci === 0 ? 5 : 2; // op de begane grond staan de poppetjes eerst op een vlak stuk
    for (const type of lists[ci]) {
      const w0 = WIDTH[type];
      if (u + w0 + 2 > L) continue;
      const c = colorOf();
      if (type === 'plateau') {
        const w = 2 + ((R() * 3) | 0), h = depth >= 1 && R() < 0.5 ? 2 : 1;
        for (let i = 0; i < w; i++) rect(X(u + i), Yf - h, X(u + i), Yf - 1);
        taken.push([Math.min(X(u), X(u + w - 1)), Math.max(X(u), X(u + w - 1)), f]); u += w + 2 + ((R() * 2) | 0);
      } else if (type === 'pool' || type === 'goo') {
        const w = 2 + (R() < 0.4 + depth * 0.1 ? 1 : 0);
        const kind = type === 'goo' ? 'goo' : R() < 0.5 ? 'lava' : 'water';
        for (let i = 0; i < w; i++) set(X(u + i), Yf, 0);
        liquids.push({ type: kind, x: Math.min(X(u), X(u + w - 1)), y: Yf, w });
        u += w + 2 + ((R() * 2) | 0);
      } else if (type === 'btn' || type === 'lever') {
        const gx = X(u + 4 - 2 * (type === 'btn' ? 1 : 0));
        const g = { id: gates.length, x: type === 'btn' ? X(u + 2) : X(u + 4), y: Yf - 4, h: 4, color: c };
        gates.push(g);
        if (type === 'btn') {
          buttons.push({ id: buttons.length, x: X(u), y: Yf - 1, gate: g.id, color: c, kind: 'gate' });
          buttons.push({ id: buttons.length, x: X(u + 4), y: Yf - 1, gate: g.id, color: c, kind: 'gate' });
        } else levers.push({ id: levers.length, x: X(u), y: Yf - 1, gate: g.id, color: c, openDir: d });
        taken.push([Math.min(X(u), X(u + 4)) - 1, Math.max(X(u), X(u + 4)) + 1, f]); u += 5 + 2 + ((R() * 2) | 0); gateCount++; void gx;
      } else if (type === 'crate') {
        crates.push({ x: X(u + 2) + 0.5, y: Yf });
        for (let i = 6; i <= 9; i++) rect(X(u + i), Yf - 3, X(u + i), Yf - 1);
        vadd.push([X(u + 5), Yf - 1]);
        taken.push([Math.min(X(u), X(u + 9)), Math.max(X(u), X(u + 9)), f]); u += 10 + 2;
      } else if (type === 'bridge') {
        const c0 = X(u), pool0 = X(u + 1), c1 = X(u + 7);
        for (let i = 1; i <= 6; i++) { set(X(u + i), Yf, 0); vadd.push([X(u + i), Yf]); }
        liquids.push({ type: 'goo', x: Math.min(X(u + 1), X(u + 6)), y: Yf, w: 6 });
        const br = { id: bridges.length, x: pool0, y: Yf, len: 6, dir: d, color: c };
        bridges.push(br);
        buttons.push({ id: buttons.length, x: c0, y: Yf - 1, bridge: br.id, color: c, kind: 'bridge' });
        buttons.push({ id: buttons.length, x: c1, y: Yf - 1, bridge: br.id, color: c, kind: 'bridge' });
        taken.push([Math.min(c0, c1), Math.max(c0, c1), f]); u += 8 + 2;
      } else if (type === 'plank1' || type === 'plank2') {
        const w = type === 'plank1' ? 7 : 10;
        for (let i = 0; i < w; i++) set(X(u + i), Yf, 0);
        liquids.push({ type: 'goo', x: Math.min(X(u), X(u + w - 1)), y: Yf, w });
        const centers = type === 'plank1' ? [3.5] : [3.3, 6.7];
        for (const cu of centers) {
          // het midden van de plank in tegelcoördinaten (de gang loopt van links naar rechts of andersom)
          const px = d > 0 ? a + u + cu : b + 1 - u - cu;
          planks.push({ x: px, y: Yf, hl: 1.2, anchor: 0 });
          vadd.push([Math.floor(px), Yf]);
        }
        taken.push([Math.min(X(u), X(u + w - 1)) - 1, Math.max(X(u), X(u + w - 1)) + 1, f]); u += w + 2;
      }
    }
  });
  for (const p of planks) p.anchor = ceilAt(Math.floor(p.x), p.y - 1) ;

  // ---- diamanten: op de vloer, in de plassen van de juiste kleur en op de trappen
  const floorAt = (x, f) => !grid[(Y[f] - 1) * W + x] && grid[Y[f] * W + x] === 1;
  const tryGem = (type, x, f, extra) => {
    if (x < 1 || x > W - 2 || !floorAt(x, f)) return false;
    if (floors >= 2 && f === 0 && x > xs1 - 1) return false; // onder de zwevende treden komt niemand
    if (floors === 3 && f === 1 && x < xs2) return false;
    if (floors >= 2 && f === floors - 1 && floors === 3 && x < xs2) return false;
    if (taken.some(([a, b, ff]) => ff === f && x >= a && x <= b)) return false;
    if ((f === (floors - 1) || floors === 1) && x >= doors.fire.x - 1 && x <= doors.water.x + 2 && Math.abs(Y[f] - doors.fire.y) < 1) return false;
    gems.push({ type, x: x + 0.5, y: Y[f] - 1.1 - (extra ? 1.2 : 0), got: false });
    return true;
  };
  const gemN = 2 + Math.min(5, Math.floor(n / 5) + depth);
  let placed = 0;
  for (let tries = 0; tries < 400 && placed < gemN * 2; tries++) {
    const f = (R() * floors) | 0;
    const x = 2 + ((R() * (W - 5)) | 0);
    if (tryGem(placed % 2 ? 'blue' : 'red', x, f, R() < 0.3)) placed++;
  }
  for (const l of liquids) { // een diamant diep in een plas die bij het poppetje past
    if (l.type === 'goo' || R() < 0.35) continue;
    gems.push({ type: l.type === 'lava' ? 'red' : 'blue', x: l.x + l.w / 2, y: l.y + 0.35, got: false });
  }

  // ---- spiegelen: de helft van de levels staat andersom
  const mx = (x, w = 1) => (mirror ? W - x - w : x);
  let g2 = grid;
  if (mirror) { g2 = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) g2[y * W + (W - 1 - x)] = grid[y * W + x]; }
  const out = {
    n, W, H, grid: g2, floors, mirror,
    liquids: liquids.map((l) => ({ ...l, x: mx(l.x, l.w) })),
    gates: gates.map((g) => ({ ...g, x: mx(g.x) })),
    buttons: buttons.map((b) => ({ ...b, x: mx(b.x) })),
    levers: levers.map((l) => ({ ...l, x: mx(l.x), openDir: mirror ? -l.openDir : l.openDir })),
    bridges: bridges.map((b) => ({ ...b, x: mx(b.x), dir: mirror ? -b.dir : b.dir })),
    crates: crates.map((c) => ({ ...c, x: mirror ? W - c.x : c.x })),
    planks: planks.map((p) => ({ ...p, x: mirror ? W - p.x : p.x })),
    gems: gems.map((g) => ({ ...g, x: mirror ? W - g.x : g.x })),
    doors: { fire: { ...doors.fire, x: mx(doors.fire.x, 2) }, water: { ...doors.water, x: mx(doors.water.x, 2) } },
    starts: { fire: { x: mirror ? W - 3.5 : 3.5, y: Y[0] }, water: { x: mirror ? W - 6.5 : 6.5, y: Y[0] } },
    vadd: vadd.map(([x, y]) => [mx(x), y]),
  };
  return out;
}

// de "opgeloste" versie van een level: voor de controle of beide poppetjes bij hun deur kunnen komen
export function solvedLevel(L) {
  const grid = L.grid.slice();
  for (const [x, y] of L.vadd) grid[y * W + x] = 1;
  return { ...L, grid, gates: [], buttons: [], levers: [], bridges: [], crates: [], planks: [] };
}
