// Levels worden uit stukken opgebouwd (heuvels, sprongen, spijkers, zagen, vuur, tunnels) en worden per level moeilijker.
export const LEVEL_COUNT = 25;
export const THEMES = [
  { id: 'cave', name: 'Grot' },
  { id: 'canyon', name: 'Canyon' },
  { id: 'ice', name: 'IJsgrot' },
];
export const themeOf = (n) => THEMES[n <= 8 ? 0 : n <= 16 ? 1 : 2];

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
  const R = rng(n * 7919 + 13);
  const d = (n - 1) / (LEVEL_COUNT - 1);
  const pts = [[-40, 0], [0, 0]];
  const track = [[-40, 0], [0, 0]];
  const hz = [];
  const tunnels = [];
  let x = 0, y = 0;
  const add = (nx, ny, onTrack = true) => { pts.push([nx, ny]); if (onTrack) track.push([nx, ny]); x = nx; y = ny; };
  const flat = (len) => add(x + len, y);
  const hill = (len, dy) => {
    const x0 = x, y0 = y, steps = Math.max(2, Math.round(len));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      add(x0 + len * t, y0 + dy * (1 - Math.cos(Math.PI * t)) / 2);
    }
  };
  const bumps = (count, h) => {
    for (let k = 0; k < count; k++) {
      const w = 4 + R() * 2, x0 = x, y0 = y;
      for (let i = 1; i <= 8; i++) { const t = i / 8; add(x0 + w * t, y0 + h * Math.pow(Math.sin(Math.PI * t), 2)); }
    }
  };
  const kicker = (rise) => { add(x + 3.2, y + rise); add(x, y - rise); };
  const gap = (width, rise) => {
    add(x + 3.4, y + rise);
    const x0 = x, top = y;
    const base = top - rise - 0.5;
    pts.push([x0, base - 7]); pts.push([x0 + width, base - 7]);
    hz.push({ type: 'pit', x0, x1: x0 + width, y: base - 5.4, h: 2.2 });
    x = x0 + width; y = base;
    pts.push([x, y]); track.push([x, y]);
  };
  const spikes = (len) => {
    kicker(1.5);
    flat(0.5);
    hz.push({ type: 'spikes', x0: x, x1: x + len, y, h: 0.65 });
    flat(len);
  };
  const sawStatic = () => {
    kicker(1.7);
    flat(1.2);
    hz.push({ type: 'saw', x: x + 0.8, y: y - 0.05, r: 0.68, spin: 1 });
    flat(2.0);
  };
  const fire = (len) => {
    flat(2);
    hz.push({ type: 'fire', x0: x, x1: x + len, y, h: 2.6, period: 3.4, on: 1.2, phase: R() * 3 });
    flat(len);
  };
  const movingSaw = () => {
    flat(5);
    hz.push({ type: 'saw', x, y: y + 1.6, r: 0.65, spin: -1, ay: y + 0.5, by: y + 3.9, period: 2.4 + R() * 0.6, phase: R() * 2.6 });
    flat(5);
  };
  const tunnel = (len) => {
    flat(3);
    tunnels.push([x, x + len]);
    flat(len);
    flat(2);
  };

  const kinds = [
    { k: 'bumps', min: 1, w: 3 }, { k: 'hill', min: 1, w: 3 }, { k: 'gap', min: 2, w: 3 }, { k: 'spikes', min: 3, w: 2.4 },
    { k: 'tunnel', min: 4, w: 1.2 }, { k: 'fire', min: 5, w: 1.6 }, { k: 'gap2', min: 6, w: 1.6 }, { k: 'saw', min: 7, w: 2 }, { k: 'moving', min: 9, w: 2 },
  ];
  const count = 4 + Math.round(8 * d) + Math.floor(n / 4);
  let last = '';
  flat(12);
  for (let i = 0; i < count; i++) {
    const pool = kinds.filter((o) => n >= o.min && o.k !== last);
    let total = 0; pool.forEach((o) => { total += o.w; });
    let r = R() * total, pick = pool[0];
    for (const o of pool) { r -= o.w; if (r <= 0) { pick = o; break; } }
    const kd = pick.k;
    if (kd === 'bumps') bumps(2 + ((R() * 3) | 0), 0.3 + 0.35 * d + R() * 0.2);
    else if (kd === 'hill') { const len = 14 + R() * 14; hill(len, (R() < 0.5 ? 1 : -1) * len * (0.08 + 0.12 * d + R() * 0.07)); }
    else if (kd === 'gap') gap(2.4 + 1.9 * d + R() * 0.4, 1.5);
    else if (kd === 'gap2') { gap(2.6 + 1.6 * d, 1.5); flat(12); gap(2.6 + 1.5 * d, 1.5); }
    else if (kd === 'spikes') spikes(1.4 + 0.7 * d);
    else if (kd === 'fire') fire(3 + d * 2);
    else if (kd === 'saw') sawStatic();
    else if (kd === 'moving') movingSaw();
    else if (kd === 'tunnel') tunnel(12 + R() * 10);
    last = kd;
    flat(Math.max(11, 16 - 5 * d) + R() * 3);
  }
  flat(10);
  const finishX = x;
  flat(20);

  // plafond: volgt het spoor, behalve in tunnels
  const trackY = (px) => {
    for (let i = 1; i < track.length; i++) {
      const a = track[i - 1], b = track[i];
      if (b[0] > a[0] && px >= a[0] && px <= b[0]) return a[1] + (b[1] - a[1]) * (px - a[0]) / (b[0] - a[0]);
    }
    return track[track.length - 1][1];
  };
  const ceil = [];
  for (let px = -40; px <= x; px += 1) {
    let H = 11 + Math.sin(px * 0.07) * 1.2;
    for (const [a, b] of tunnels) {
      const e = Math.min(1, Math.max(0, Math.min(px - (a - 3), (b + 3) - px) / 3));
      H = H * (1 - e) + 3.5 * e;
    }
    ceil.push([px, trackY(px) + H]);
  }
  const torches = [];
  for (let px = 18; px < finishX; px += 24 + R() * 10) torches.push([px, trackY(px) + 3.6 + R() * 1.2]);

  const length = finishX;
  const par = length / 5.8 + 10;
  return { n, theme: themeOf(n), pts, track, hz, tunnels, ceil, finishX, startX: 3, length, par, torches, minY: Math.min(...pts.map((p) => p[1])) };
}

export function levelHeight(level, px) {
  const t = level.track;
  for (let i = 1; i < t.length; i++) {
    const a = t[i - 1], b = t[i];
    if (b[0] > a[0] && px >= a[0] && px <= b[0]) return a[1] + (b[1] - a[1]) * (px - a[0]) / (b[0] - a[0]);
  }
  return t[t.length - 1][1];
}
export function ceilAt(level, px) {
  const c = level.ceil;
  const i = Math.floor(px + 40);
  if (i < 0) return c[0][1];
  if (i >= c.length - 1) return c[c.length - 1][1];
  const f = px + 40 - i;
  return c[i][1] * (1 - f) + c[i + 1][1] * f;
}
