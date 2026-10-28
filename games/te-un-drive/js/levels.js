// Levels worden uit stukken opgebouwd: heuvels, trappen, sprongen over water, houten bruggen en spijkers.
export const LEVEL_COUNT = 25;

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
  const R = rng(n * 104729 + 7);
  const d = (n - 1) / (LEVEL_COUNT - 1);
  const main = [[-50, 0], [0, 0]];
  const planks = []; // losse houten bruggen: [[x,y],...]
  const posts = [];
  const hz = [];
  const movers = [];
  const easy = n <= 5; // de eerste vijf levels zijn te doen met de fiets (geen vering)
  const track = [[-50, 0], [0, 0]];
  let x = 0, y = 0;
  const add = (nx, ny, on = true) => { main.push([nx, ny]); if (on) track.push([nx, ny]); x = nx; y = ny; };
  const flat = (len) => add(x + len, y);
  const bumps = (count, h) => {
    for (let k = 0; k < count; k++) {
      const w = 5 + R() * 2, x0 = x, y0 = y;
      for (let i = 1; i <= 8; i++) { const t = i / 8; add(x0 + w * t, y0 + h * Math.pow(Math.sin(Math.PI * t), 2)); }
    }
  };
  const hill = (len, dy) => {
    const x0 = x, y0 = y, steps = Math.round(len / 1.2);
    for (let i = 1; i <= steps; i++) { const t = i / steps; add(x0 + len * t, y0 + dy * (1 - Math.cos(Math.PI * t)) / 2); }
  };
  const stairs = (count, h, tread, up) => {
    for (let i = 0; i < count; i++) { add(x, y + (up ? h : -h)); add(x + tread, y); }
  };
  // sprong: stijle oprit, water eronder, landing iets lager
  const jump = (width, rise) => {
    add(x + 7, y + rise);
    const x0 = x, base = y - rise - 0.8;
    main.push([x0, base - 12]); main.push([x0 + width, base - 12]);
    hz.push({ type: 'water', x0, x1: x0 + width, y: base - 5 });
    x = x0 + width; y = base;
    main.push([x, y]); track.push([x, y]);
  };
  // houten brug in een boog over het water
  const bridge = (len, hump) => {
    const x0 = x, y0 = y, x1 = x0 + len;
    main.push([x0, y0 - 12]); main.push([x1, y0 - 12]);
    hz.push({ type: 'water', x0, x1, y: y0 - 5 });
    const pl = [];
    const steps = Math.round(len / 1.5);
    for (let i = 0; i <= steps; i++) { const t = i / steps; pl.push([x0 + len * t, y0 + hump * Math.sin(Math.PI * t) - 0.1]); }
    planks.push(pl);
    for (let i = 2; i < steps - 1; i += 3) posts.push([pl[i][0], pl[i][1]]);
    x = x1; main.push([x, y0]); track.push([x, y0]);
  };
  // veerboot: een platform dat automatisch heen en weer vaart over het water
  const ferry = (width) => {
    const x0 = x, base = y;
    main.push([x0, base - 12]); main.push([x0 + width, base - 12]);
    hz.push({ type: 'water', x0, x1: x0 + width, y: base - 5 });
    movers.push({ id: movers.length, kind: 'ferry', x0, x1: x0 + width, y: base, len: 6.5, phase: R() * 14 });
    x = x0 + width; y = base;
    main.push([x, y]); track.push([x, y]);
  };
  // knop: rijd op de plaat en een brug schuift uit over het water
  const bridgeBtn = (width) => {
    flat(6);
    const bx0 = x, bx1 = x + 4;
    flat(4);
    flat(18);
    const x0 = x, base = y;
    main.push([x0, base - 12]); main.push([x0 + width, base - 12]);
    hz.push({ type: 'water', x0, x1: x0 + width, y: base - 5 });
    movers.push({ id: movers.length, kind: 'bridgebtn', bx0, bx1, x0, x1: x0 + width, y: base });
    x = x0 + width; y = base;
    main.push([x, y]); track.push([x, y]);
  };
  const spikes = (len) => {
    add(x + 6, y + 1.6); add(x, y - 1.6); // oprit en afgrond
    flat(0.8);
    hz.push({ type: 'spikes', x0: x, x1: x + len, y, h: 0.9 });
    flat(len);
  };

  const kinds = easy
    ? [{ k: 'bumps', min: 1, w: 3 }, { k: 'hill', min: 1, w: 3 }, { k: 'bridge', min: 2, w: 2.4 }, { k: 'jump', min: 4, w: 2 }]
    : [
      { k: 'bumps', min: 6, w: 3 }, { k: 'hill', min: 6, w: 3 }, { k: 'stairs', min: 6, w: 2.4 }, { k: 'jump', min: 6, w: 3 },
      { k: 'bridge', min: 6, w: 2.4 }, { k: 'spikes', min: 7, w: 2 }, { k: 'ferry', min: 7, w: 2.2 }, { k: 'bridgeBtn', min: 9, w: 2.2 },
      { k: 'jump2', min: 10, w: 1.6 }, { k: 'stairsDown', min: 8, w: 1.4 },
    ];
  const count = 4 + Math.round(7 * d) + Math.floor(n / 5);
  let last = '';
  flat(20);
  for (let i = 0; i < count; i++) {
    const pool = kinds.filter((o) => n >= o.min && o.k !== last && (i > 0 || o.k === 'bumps' || o.k === 'hill'));
    let total = 0; pool.forEach((o) => { total += o.w; });
    let r = R() * total, pick = pool[0];
    for (const o of pool) { r -= o.w; if (r <= 0) { pick = o; break; } }
    const k = pick.k;
    if (k === 'bumps') bumps(2 + ((R() * 3) | 0), easy ? 0.18 + 0.03 * n : 0.35 + 0.4 * d);
    else if (k === 'hill') { const len = 24 + R() * 16; hill(len, (R() < 0.55 ? 1 : -1) * len * (easy ? 0.04 + 0.01 * n : 0.07 + 0.1 * d + R() * 0.05)); }
    else if (k === 'stairs') stairs(2 + ((R() * 3) | 0), 0.45 + 0.25 * d, 3.2, true);
    else if (k === 'stairsDown') stairs(3 + ((R() * 3) | 0), 0.5, 3.2, false);
    else if (k === 'jump') jump(easy ? 3.2 : 4 + 3.2 * d + R() * 0.8, easy ? 1.8 : 2.2);
    else if (k === 'ferry') ferry(11 + R() * 3);
    else if (k === 'bridgeBtn') bridgeBtn(7 + 2 * d);
    else if (k === 'jump2') { jump(4.5 + 2.5 * d, 2.2); flat(18); jump(4.5 + 2.2 * d, 2.2); }
    else if (k === 'bridge') bridge(12 + R() * 8 + 6 * d, easy ? 1.1 : 2.2 + R() * 1.2);
    else if (k === 'spikes') spikes(3 + 2.5 * d);
    last = k;
    flat(Math.max(14, 22 - 8 * d) + R() * 6);
  }
  flat(14);
  const finishX = x;
  flat(30);
  const length = finishX;
  return { n, main, planks, posts, hz, movers, track, finishX, startX: 4, length, minY: Math.min(...main.map((p) => p[1])) };
}

export function levelHeight(level, px) {
  const t = level.track;
  for (let i = 1; i < t.length; i++) {
    const a = t[i - 1], b = t[i];
    if (b[0] > a[0] && px >= a[0] && px <= b[0]) return a[1] + (b[1] - a[1]) * (px - a[0]) / (b[0] - a[0]);
  }
  return t[t.length - 1][1];
}
