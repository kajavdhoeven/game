// Te-Un the Robber: de buitenkant van het gebouw (scene) en de sluip-intro.
// Alles procedureel op canvas. De statische lagen (lucht, achtergrond, gebouw, grond, lichtbronnen) worden 1 keer
// opgebouwd en per spec gecached; per frame worden alleen wolken, rook, flikkerende neon, vuur en de deur getekend.
import { drawTeUn } from './chars.js';
import { levelMeta } from './story.js';

const W = 1280, H = 720, HZ = 505, B = 596, DOORY = 596, LANE = 640;
const TAU = Math.PI * 2;
const FONT = 'Fredoka, sans-serif';

// ------------------------------------------------------------------ hulpfuncties
const rng = (s) => { let a = s >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rgb = (c) => {
  if (c[0] === '#') { let h = c.slice(1); if (h.length === 3) h = h.split('').map((x) => x + x).join(''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  const m = c.match(/[\d.]+/g); return [+m[0], +m[1], +m[2]];
};
const hx = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const A = rgb(a), C = rgb(b); return hx(A[0] + (C[0] - A[0]) * t, A[1] + (C[1] - A[1]) * t, A[2] + (C[2] - A[2]) * t); };
const sh = (c, k) => (k >= 0 ? mix(c, '#ffffff', k) : mix(c, '#000000', -k));
const al = (c, a) => { const r = rgb(c); return `rgba(${r[0]},${r[1]},${r[2]},${a})`; };
const grad = (g, x0, y0, x1, y1, st) => { const q = g.createLinearGradient(x0, y0, x1, y1); for (const [p, c] of st) q.addColorStop(p, c); return q; };
const rgrad = (g, x, y, r0, r1, st) => { const q = g.createRadialGradient(x, y, r0, x, y, r1); for (const [p, c] of st) q.addColorStop(p, c); return q; };
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
const poly = (g, pts) => { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); };
let R = rng(1); // wordt per scene opnieuw gezaaid
const rnd = (a, b) => a + R() * (b - a);
const pick = (arr) => arr[(R() * arr.length) | 0];
const newCanvas = (w = W, h = H) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

function speckle(g, x, y, w, h, n, cols, a = 0.2, sz = 2) {
  const cs = cols.map(rgb);
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  for (let i = 0; i < n; i++) {
    const c = cs[(R() * cs.length) | 0]; g.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${(a * (0.4 + R() * 0.9)).toFixed(3)})`;
    const s = 1 + R() * sz; g.fillRect(x + R() * w, y + R() * h, s, s * (0.5 + R()));
  }
  g.restore();
}
function txt(g, s, x, y, size, color, o = {}) {
  g.save(); g.font = `${o.weight || 700} ${size}px ${FONT}`; g.textAlign = o.align || 'center'; g.textBaseline = o.base || 'middle';
  if (o.spacing && 'letterSpacing' in g) g.letterSpacing = o.spacing + 'px';
  if (o.fit) { const m = g.measureText(s).width; if (m > o.fit) { size = size * o.fit / m; g.font = `${o.weight || 700} ${size}px ${FONT}`; } }
  if (o.shadow) { g.shadowColor = o.shadow; g.shadowBlur = o.blur ?? 8; g.shadowOffsetY = o.sy ?? 2; }
  if (o.stroke) { g.lineWidth = o.lw || 4; g.strokeStyle = o.stroke; g.lineJoin = 'round'; g.strokeText(s, x, y); }
  g.fillStyle = color; g.fillText(s, x, y); g.restore();
}

// ------------------------------------------------------------------ paletten per tijd van de dag
const PAL = {
  day: { key: 'day', sky: [[0, '#4f9fe6'], [0.5, '#9ecff3'], [1, '#e6f4fc']], tint: null, haze: '#d4e6f0', lights: false, sil: ['#a9c7d6', '#86ad92', '#58896a'], fog: 0.0 },
  dusk: { key: 'dusk', sky: [[0, '#1d2866'], [0.32, '#6d4a8e'], [0.62, '#e8805a'], [1, '#ffcf8f']], tint: [255, 200, 168], haze: '#e8a58a', lights: true, sil: ['#9a6a88', '#6b456e', '#3c2a52'], fog: 0.12 },
  night: { key: 'night', sky: [[0, '#03050f'], [0.5, '#0a1230'], [1, '#1d2d58']], tint: [112, 128, 184], haze: '#243665', lights: true, sil: ['#1e2c56', '#121c3e', '#0a1129'], fog: 0.18 },
};

// ------------------------------------------------------------------ texturen
function bricks(g, x, y, w, h, o = {}) {
  const bw = o.bw || 22, bh = o.bh || 9, base = o.base || '#b4503a', v = o.v ?? 0.16;
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = o.mortar || '#b5ada0'; g.fillRect(x, y, w, h);
  const rows = Math.ceil(h / bh) + 1, alt = o.alt || [];
  for (let r = 0; r < rows; r++) {
    const ry = y + r * bh, off = r % 2 ? -bw / 2 : 0;
    for (let cx = x + off; cx < x + w; cx += bw) {
      let col = alt.length && R() < 0.16 ? pick(alt) : base;
      col = sh(col, (R() - 0.5) * 2 * v);
      g.fillStyle = col; g.fillRect(cx + 1, ry + 1, bw - 2, bh - 2);
      g.fillStyle = 'rgba(255,255,255,.13)'; g.fillRect(cx + 1, ry + 1, bw - 2, 1);
      g.fillStyle = 'rgba(0,0,0,.20)'; g.fillRect(cx + 1, ry + bh - 2, bw - 2, 1);
      if (R() < 0.07) { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(cx + 1 + R() * bw * 0.5, ry + 2, bw * 0.4, bh - 4); }
    }
  }
  g.restore();
}
function stoneBlocks(g, x, y, w, h, o = {}) {
  const base = o.base || '#9a958a', bh = o.bh || 26; g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = sh(base, -0.3); g.fillRect(x, y, w, h);
  for (let ry = y, r = 0; ry < y + h; ry += bh, r++) {
    let cx = x - (r % 2 ? bh : 0) - R() * 10;
    while (cx < x + w) {
      const bw = bh * rnd(1.4, 2.6), col = sh(base, (R() - 0.5) * 0.22);
      g.fillStyle = col; rr(g, cx + 1.5, ry + 1.5, bw - 3, bh - 3, 2.5); g.fill();
      g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(cx + 3, ry + 2, bw - 6, 1.5);
      g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(cx + 3, ry + bh - 3.5, bw - 6, 1.5);
      cx += bw;
    }
  }
  speckle(g, x, y, w, h, (w * h) / 120, ['#000000', '#ffffff', '#5a6a4a'], 0.1, 2);
  g.restore();
}
function concrete(g, x, y, w, h, o = {}) {
  const base = o.base || '#9a9a96';
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = grad(g, x, y, x + w, y + h, [[0, sh(base, 0.06)], [1, sh(base, -0.08)]]); g.fillRect(x, y, w, h);
  speckle(g, x, y, w, h, (w * h) / 40, ['#000000', '#ffffff', sh(base, -0.3), sh(base, 0.3)], 0.16, 2.2);
  for (let i = 0; i < (o.stains ?? 14); i++) { const sx = x + R() * w, sw = rnd(8, 40), sy = y + R() * h * 0.4, sl = rnd(h * 0.2, h * 0.7); g.fillStyle = grad(g, 0, sy, 0, sy + sl, [[0, 'rgba(40,36,30,.0)'], [0.3, `rgba(40,36,30,${rnd(0.06, 0.16)})`], [1, 'rgba(40,36,30,0)']]); g.fillRect(sx, sy, sw, sl); }
  if (o.panels) { g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 1.5; for (let px = x + o.panels; px < x + w; px += o.panels) { g.beginPath(); g.moveTo(px, y); g.lineTo(px, y + h); g.stroke(); g.strokeStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.moveTo(px + 1.5, y); g.lineTo(px + 1.5, y + h); g.stroke(); g.strokeStyle = 'rgba(0,0,0,.22)'; } }
  for (let i = 0; i < (o.cracks ?? 4); i++) { let cx = x + R() * w, cy = y + R() * h; g.strokeStyle = 'rgba(20,20,20,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(cx, cy); for (let k = 0; k < 7; k++) { cx += rnd(-8, 8); cy += rnd(4, 14); g.lineTo(cx, cy); } g.stroke(); }
  g.restore();
}
function wood(g, x, y, w, h, o = {}) {
  const base = o.base || '#7a5230', vert = o.vert, pw = o.pw || 16;
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  const len = vert ? w : h;
  for (let p = 0; p < len; p += pw) {
    const col = sh(base, (R() - 0.5) * 0.3); const bw = Math.min(pw, len - p);
    if (vert) { g.fillStyle = col; g.fillRect(x + p, y, bw, h); g.fillStyle = 'rgba(0,0,0,.32)'; g.fillRect(x + p, y, 1.5, h); g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x + p + 1.5, y, 1, h); }
    else { g.fillStyle = col; g.fillRect(x, y + p, w, bw); g.fillStyle = 'rgba(0,0,0,.32)'; g.fillRect(x, y + p, w, 1.5); g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x, y + p + 1.5, w, 1); }
  }
  g.strokeStyle = 'rgba(30,15,5,.22)'; g.lineWidth = 1;
  for (let i = 0; i < (w * h) / 500; i++) { // nerf
    const sx = x + R() * w, sy = y + R() * h, l = rnd(10, 40); g.beginPath();
    if (vert) { g.moveTo(sx, sy); g.bezierCurveTo(sx + 2, sy + l * 0.3, sx - 2, sy + l * 0.7, sx, sy + l); } else { g.moveTo(sx, sy); g.bezierCurveTo(sx + l * 0.3, sy + 2, sx + l * 0.7, sy - 2, sx + l, sy); }
    g.stroke();
  }
  g.restore();
}
function tilesRoof(g, pts, o = {}) { // dakpannen in een willekeurige veelhoek (clip)
  const base = o.base || '#8a4a3a', tw = o.tw || 20, th = o.th || 12;
  const xs = pts.filter((_, i) => i % 2 === 0), ys = pts.filter((_, i) => i % 2 === 1);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  g.save(); poly(g, pts); g.clip(); g.fillStyle = sh(base, -0.35); g.fillRect(x0, y0, x1 - x0, y1 - y0);
  for (let ry = y0, r = 0; ry < y1 + th; ry += th, r++) {
    for (let cx = x0 - (r % 2 ? tw / 2 : 0) - tw; cx < x1 + tw; cx += tw) {
      const col = sh(base, (R() - 0.5) * 0.24);
      g.fillStyle = col; g.beginPath(); g.moveTo(cx, ry); g.lineTo(cx + tw, ry); g.lineTo(cx + tw, ry + th * 0.55); g.quadraticCurveTo(cx + tw / 2, ry + th * 1.35, cx, ry + th * 0.55); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 1; g.stroke();
      g.fillStyle = 'rgba(255,255,255,.10)'; g.fillRect(cx + 2, ry + 1, tw - 4, 1.5);
    }
  }
  g.restore();
}
function siding(g, x, y, w, h, o = {}) { // schaduwrijke liggende planken
  const base = o.base || '#c8d4dc', bh = o.bh || 10; g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  for (let ry = y; ry < y + h; ry += bh) {
    g.fillStyle = grad(g, 0, ry, 0, ry + bh, [[0, sh(base, 0.1)], [0.8, base], [1, sh(base, -0.25)]]); g.fillRect(x, ry, w, bh);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x, ry + bh - 1.5, w, 1.5);
  }
  speckle(g, x, y, w, h, (w * h) / 200, ['#000000', '#ffffff'], 0.07, 2);
  g.restore();
}
function corrugated(g, x, y, w, h, o = {}) {
  const base = o.base || '#8d9aa6', pw = o.pw || 9; g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  for (let px = x; px < x + w; px += pw) {
    g.fillStyle = grad(g, px, 0, px + pw, 0, [[0, sh(base, 0.18)], [0.5, base], [1, sh(base, -0.3)]]); g.fillRect(px, y, pw, h);
  }
  for (let i = 0; i < (o.rust ?? 14); i++) { const sx = x + R() * w, sy = y + R() * h * 0.6, l = rnd(30, h * 0.6); g.fillStyle = grad(g, 0, sy, 0, sy + l, [[0, 'rgba(120,70,30,0)'], [0.4, `rgba(120,70,30,${rnd(0.1, 0.25)})`], [1, 'rgba(120,70,30,0)']]); g.fillRect(sx, sy, rnd(4, 18), l); }
  speckle(g, x, y, w, h, (w * h) / 150, ['#000000', '#ffffff', '#7a4a2a'], 0.08, 2);
  g.restore();
}
function plaster(g, x, y, w, h, base, o = {}) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = grad(g, x, y, x + w, y + h, [[0, sh(base, 0.05)], [1, sh(base, -0.1)]]); g.fillRect(x, y, w, h);
  speckle(g, x, y, w, h, (w * h) / 35, ['#000000', '#ffffff', sh(base, -0.2)], 0.1, 2);
  for (let i = 0; i < (o.stains ?? 10); i++) { const sx = x + R() * w, sw = rnd(10, 50), sy = y + R() * h * 0.4, sl = rnd(h * 0.2, h * 0.6); g.fillStyle = grad(g, 0, sy, 0, sy + sl, [[0, 'rgba(60,50,30,0)'], [0.3, `rgba(60,50,30,${rnd(0.05, 0.14)})`], [1, 'rgba(60,50,30,0)']]); g.fillRect(sx, sy, sw, sl); }
  if (o.peel) for (let i = 0; i < o.peel; i++) { const px = x + R() * w, py = y + R() * h, pw = rnd(20, 60), ph = rnd(14, 40); g.fillStyle = o.under || '#8a5a40'; g.beginPath(); g.ellipse(px, py, pw, ph, R() * 3, 0, TAU); g.fill(); g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1.5; g.stroke(); }
  g.restore();
}
function wallAO(g, x, y, w, h, o = {}) { // schaduw van dak boven en van de grond onder, zijlicht
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = grad(g, 0, y, 0, y + h, [[0, al('#000', o.top ?? 0.32)], [Math.min(0.2, 40 / h), al('#000', 0)], [0.8, al('#000', 0)], [1, al('#000', o.bot ?? 0.34)]]); g.fillRect(x, y, w, h);
  g.fillStyle = grad(g, x, 0, x + w, 0, [[0, 'rgba(255,255,255,.08)'], [0.5, 'rgba(0,0,0,0)'], [1, al('#000', o.side ?? 0.2)]]); g.fillRect(x, y, w, h);
  g.restore();
}
function contactShadow(g, x, y, w, r = 16, a = 0.4) { g.fillStyle = grad(g, 0, y, 0, y + r, [[0, al('#000', a)], [1, al('#000', 0)]]); g.fillRect(x, y, w, r); }
function dropShadow(g, x, y, w, h, a = 0.35) { g.save(); g.filter = 'blur(6px)'; g.fillStyle = al('#000', a); g.fillRect(x, y, w, h); g.restore(); }
function ellShadow(g, x, y, rx, ry, a = 0.4) { g.save(); g.translate(x, y); g.scale(1, ry / rx); g.fillStyle = rgrad(g, 0, 0, 0, rx, [[0, al('#000', a)], [1, al('#000', 0)]]); g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.fill(); g.restore(); }

// ------------------------------------------------------------------ licht (emissief) en dynamiek
const glowAt = (g, x, y, r, col, a) => { g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = rgrad(g, x, y, 0, r, [[0, al(col, a)], [0.4, al(col, a * 0.35)], [1, al(col, 0)]]); g.fillRect(x - r, y - r, r * 2, r * 2); g.restore(); };
const poolAt = (g, x, y, rx, ry, col, a) => { g.save(); g.globalCompositeOperation = 'lighter'; g.translate(x, y); g.scale(1, ry / rx); g.fillStyle = rgrad(g, 0, 0, 0, rx, [[0, al(col, a)], [0.5, al(col, a * 0.4)], [1, al(col, 0)]]); g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.fill(); g.restore(); };
const emit = (c, fn) => { if (c.lit) c.E.push(fn); };

function win(c, x, y, w, h, o = {}) {
  const g = c.g, f = o.f ?? Math.max(3, w * 0.08), fr = o.frame || '#ece6da', day = c.P.key === 'day';
  const gl = { x: x + f, y: y + f, w: w - f * 2, h: h - f * 2 };
  if (o.shut) { for (const s of [-1, 1]) { const sx = s < 0 ? x - w * 0.5 - 2 : x + w + 2; g.fillStyle = o.shut; g.fillRect(sx, y, w * 0.5, h); g.fillStyle = 'rgba(0,0,0,.28)'; for (let ly = y + 4; ly < y + h - 2; ly += 5) g.fillRect(sx + 2, ly, w * 0.5 - 4, 1.5); g.strokeStyle = 'rgba(0,0,0,.4)'; g.strokeRect(sx + 0.5, y + 0.5, w * 0.5 - 1, h - 1); } }
  g.fillStyle = 'rgba(0,0,0,.30)'; if (o.arch) { rr(g, x - 2, y - 2, w + 4, h + 4, [w / 2 + 2, w / 2 + 2, 0, 0]); g.fill(); } else g.fillRect(x - 2, y - 2, w + 4, h + 4);
  g.fillStyle = fr; if (o.arch) { rr(g, x, y, w, h, [w / 2, w / 2, 0, 0]); g.fill(); } else g.fillRect(x, y, w, h);
  g.save(); if (o.arch) rr(g, gl.x, gl.y, gl.w, gl.h, [gl.w / 2, gl.w / 2, 0, 0]); else { g.beginPath(); g.rect(gl.x, gl.y, gl.w, gl.h); } g.clip();
  g.fillStyle = grad(g, 0, gl.y, 0, gl.y + gl.h, day ? [[0, '#86abc9'], [1, '#32485f']] : [[0, '#1b2a44'], [1, '#0a111d']]); g.fillRect(gl.x, gl.y, gl.w, gl.h);
  g.fillStyle = 'rgba(255,255,255,.14)'; g.beginPath(); g.moveTo(gl.x, gl.y + gl.h * 0.5); g.lineTo(gl.x + gl.w * 0.6, gl.y); g.lineTo(gl.x + gl.w, gl.y); g.lineTo(gl.x, gl.y + gl.h * 0.9); g.fill();
  if (o.curt) { g.fillStyle = al(o.curt, 0.85); g.beginPath(); g.moveTo(gl.x, gl.y); g.lineTo(gl.x + gl.w * 0.3, gl.y); g.quadraticCurveTo(gl.x + gl.w * 0.12, gl.y + gl.h * 0.5, gl.x + gl.w * 0.2, gl.y + gl.h); g.lineTo(gl.x, gl.y + gl.h); g.fill(); g.beginPath(); g.moveTo(gl.x + gl.w, gl.y); g.lineTo(gl.x + gl.w * 0.7, gl.y); g.quadraticCurveTo(gl.x + gl.w * 0.88, gl.y + gl.h * 0.5, gl.x + gl.w * 0.8, gl.y + gl.h); g.lineTo(gl.x + gl.w, gl.y + gl.h); g.fill(); }
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(gl.x, gl.y, gl.w, 4); g.restore();
  const cols = o.cols ?? 1, rows = o.rows ?? 2, mb = Math.max(1.5, f * 0.55);
  g.fillStyle = fr;
  for (let i = 1; i < cols; i++) g.fillRect(gl.x + (gl.w * i) / cols - mb / 2, gl.y, mb, gl.h);
  for (let i = 1; i < rows; i++) g.fillRect(gl.x, gl.y + (gl.h * i) / rows - mb / 2, gl.w, mb);
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  if (o.sill !== false) { g.fillStyle = sh(fr, 0.1); g.fillRect(x - 4, y + h, w + 8, 5); g.fillStyle = 'rgba(0,0,0,.32)'; g.fillRect(x - 4, y + h + 5, w + 8, 3); g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(x - 4, y + h, w + 8, 1); }
  if (o.lit !== undefined ? o.lit && c.P.lights : (o.p && c.P.lights && R() < o.p)) {
    const lc = o.lc || pick(['#ffd88a', '#ffd88a', '#ffe9b0', '#ffc77a']);
    c.E.push((e) => {
      e.save(); if (o.arch) rr(e, gl.x, gl.y, gl.w, gl.h, [gl.w / 2, gl.w / 2, 0, 0]); else { e.beginPath(); e.rect(gl.x, gl.y, gl.w, gl.h); } e.clip();
      e.fillStyle = grad(e, 0, gl.y, 0, gl.y + gl.h, [[0, mix(lc, '#ffffff', 0.4)], [0.5, lc], [1, mix(lc, '#8a4a1a', 0.45)]]); e.fillRect(gl.x, gl.y, gl.w, gl.h);
      if (o.curt) { e.fillStyle = al(o.curt, 0.55); e.fillRect(gl.x, gl.y, gl.w * 0.22, gl.h); e.fillRect(gl.x + gl.w * 0.78, gl.y, gl.w * 0.22, gl.h); }
      if (R() < 0.35 && gl.w > 14) { e.fillStyle = 'rgba(60,30,10,.55)'; e.beginPath(); e.arc(gl.x + gl.w * rnd(0.3, 0.7), gl.y + gl.h * 0.8, gl.w * 0.12, 0, TAU); e.fill(); e.fillRect(gl.x + gl.w * 0.45, gl.y + gl.h * 0.8, gl.w * 0.1, gl.h * 0.25); }
      e.fillStyle = 'rgba(0,0,0,.30)'; e.fillRect(gl.x, gl.y, gl.w, 3);
      e.fillStyle = fr;
      for (let i = 1; i < cols; i++) e.fillRect(gl.x + (gl.w * i) / cols - mb / 2, gl.y, mb, gl.h);
      for (let i = 1; i < rows; i++) e.fillRect(gl.x, gl.y + (gl.h * i) / rows - mb / 2, gl.w, mb);
      e.restore(); glowAt(e, x + w / 2, y + h / 2, Math.max(w, h) * 1.05, lc, 0.28);
    });
  }
}
function lampPost(c, x, base, h, o = {}) {
  const g = c.g, col = o.col || '#ffe2a0', dark = '#1d2128', dx = o.arm ?? 0;
  g.fillStyle = grad(g, x - 4, 0, x + 4, 0, [[0, '#4a525e'], [0.5, '#2a3038'], [1, '#14181e']]); g.fillRect(x - 3.5, base - h, 7, h);
  g.fillStyle = dark; g.fillRect(x - 7, base - 8, 14, 8); g.fillRect(x - 5, base - 14, 10, 6);
  const hx0 = x + dx, hy = base - h;
  if (dx) { g.strokeStyle = dark; g.lineWidth = 4; g.beginPath(); g.moveTo(x, hy + 6); g.quadraticCurveTo(x, hy - 4, hx0, hy - 3); g.stroke(); }
  g.fillStyle = dark; g.beginPath(); g.moveTo(hx0 - 14, hy); g.quadraticCurveTo(hx0, hy - 10, hx0 + 14, hy); g.lineTo(hx0 + 11, hy + 3); g.lineTo(hx0 - 11, hy + 3); g.fill();
  g.fillStyle = c.P.lights ? '#3a3226' : '#c8ccd0'; rr(g, hx0 - 9, hy + 2, 18, 5, 2); g.fill();
  emit(c, (e) => {
    glowAt(e, hx0, hy + 6, o.r ?? 120, col, 0.5);
    e.save(); e.fillStyle = col; rr(e, hx0 - 8, hy + 2, 16, 5, 2); e.fill(); e.restore();
    e.save(); e.globalCompositeOperation = 'lighter'; e.fillStyle = grad(e, 0, hy + 6, 0, base, [[0, al(col, 0.16)], [1, al(col, 0)]]); poly(e, [hx0 - 6, hy + 7, hx0 + 6, hy + 7, hx0 + (o.r ?? 120) * 0.55, base + 6, hx0 - (o.r ?? 120) * 0.55, base + 6]); e.fill(); e.restore();
    poolAt(e, hx0, base + (o.poolY ?? 22), (o.r ?? 120) * 1.3, 24, col, 0.38);
  });
}
function lantern(c, x, y, r, col = '#d8322a', o = {}) { // chinese lampion
  const g = c.g; g.strokeStyle = '#3a2a1c'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y - r * 1.5); g.lineTo(x, y - r * 0.9); g.stroke();
  g.fillStyle = '#d8b04a'; g.fillRect(x - r * 0.45, y - r * 1.0, r * 0.9, r * 0.16);
  g.fillStyle = rgrad(g, x - r * 0.3, y - r * 0.2, 1, r * 1.3, [[0, sh(col, 0.3)], [0.6, col], [1, sh(col, -0.45)]]); g.beginPath(); g.ellipse(x, y, r, r * 0.82, 0, 0, TAU); g.fill();
  g.strokeStyle = al(sh(col, -0.5), 0.5); g.lineWidth = 1; for (let i = -2; i <= 2; i++) { g.beginPath(); g.ellipse(x, y, r * (Math.abs(i) / 2.6 + 0.02) + 0.5, r * 0.82, 0, 0, TAU); if (i > -3) g.stroke(); }
  g.fillStyle = '#d8b04a'; g.fillRect(x - r * 0.4, y + r * 0.74, r * 0.8, r * 0.14);
  g.strokeStyle = '#d8b04a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y + r * 0.88); g.lineTo(x, y + r * 1.5); g.stroke();
  emit(c, (e) => { glowAt(e, x, y, r * (o.glow ?? 3.2), col, 0.45); e.save(); e.globalCompositeOperation = 'lighter'; e.fillStyle = al(mix(col, '#ffcc66', 0.5), 0.5); e.beginPath(); e.ellipse(x, y, r * 0.8, r * 0.64, 0, 0, TAU); e.fill(); e.restore(); });
}
function neonText(c, s, x, y, size, col, o = {}) { // neon: donkere buizen overdag, gloed 's nachts
  const g = c.g;
  txt(g, s, x, y, size, mix(col, '#303038', 0.7), { stroke: '#15151a', lw: 5, fit: o.fit, spacing: o.spacing, weight: o.weight });
  emit(c, (e) => {
    e.save(); e.shadowColor = col; e.shadowBlur = 24; txt(e, s, x, y, size, mix(col, '#ffffff', 0.55), { fit: o.fit, spacing: o.spacing, weight: o.weight, shadow: col, blur: 22, sy: 0 });
    e.shadowBlur = 0; e.globalCompositeOperation = 'lighter'; txt(e, s, x, y, size, al(col, 0.7), { fit: o.fit, spacing: o.spacing, weight: o.weight, shadow: col, blur: 50, sy: 0 }); e.restore();
  });
}
function flicker(c, x, y, w, h, seed, o = {}) { // dynamisch: kort uitvallen van een neonbord
  if (!c.lit) return; const r = rng(seed);
  const ph = r() * 100, rate = o.rate ?? 7, depth = o.depth ?? 0.6;
  c.D.push((g, t) => { const v = Math.sin(t * rate + ph) + Math.sin(t * rate * 2.7 + ph * 3); if (v > 1.45 || (v < -1.7 && o.double)) { g.fillStyle = `rgba(6,8,16,${depth})`; g.fillRect(x, y, w, h); } });
}
function sign(c, x, y, w, h, s, o = {}) {
  const g = c.g, bg = o.bg || '#1f5fa8', fg = o.fg || '#ffffff';
  if (o.shadow !== false) { g.fillStyle = 'rgba(0,0,0,.35)'; rr(g, x + 3, y + 5, w, h, o.r ?? 8); g.fill(); }
  g.fillStyle = grad(g, 0, y, 0, y + h, [[0, sh(bg, 0.18)], [0.5, bg], [1, sh(bg, -0.25)]]); rr(g, x, y, w, h, o.r ?? 8); g.fill();
  g.strokeStyle = o.rim || sh(bg, -0.5); g.lineWidth = 3; g.stroke();
  g.fillStyle = 'rgba(255,255,255,.14)'; rr(g, x + 3, y + 3, w - 6, h * 0.38, [o.r ?? 8, o.r ?? 8, 0, 0]); g.fill();
  if (o.bolts !== false) { g.fillStyle = '#c4c8cc'; for (const [bx, by] of [[x + 8, y + 8], [x + w - 8, y + 8], [x + 8, y + h - 8], [x + w - 8, y + h - 8]]) { g.beginPath(); g.arc(bx, by, 2.4, 0, TAU); g.fill(); } }
  const size = o.size || h * 0.6;
  if (o.neon) neonText(c, s, x + w / 2, y + h / 2 + 2, size, fg, { fit: w - 28, spacing: o.spacing });
  else {
    txt(g, s, x + w / 2, y + h / 2 + 2, size, fg, { fit: w - 28, spacing: o.spacing, shadow: 'rgba(0,0,0,.4)', blur: 2, sy: 2 });
    if (o.lightText) emit(c, (e) => { e.save(); e.globalCompositeOperation = 'lighter'; txt(e, s, x + w / 2, y + h / 2 + 2, size, al(fg, 0.35), { fit: w - 28, spacing: o.spacing, shadow: fg, blur: 12, sy: 0 }); e.restore(); });
  }
  if (o.lit && c.lit) emit(c, (e) => { glowAt(e, x + w / 2, y + h / 2, w * 0.62, bg, 0.22); });
}
function floodLight(c, x, y, tx, ty, col = '#fff4d8', spread = 90, a = 0.14) { // lamp met lichtkegel naar (tx,ty)
  const g = c.g; g.fillStyle = '#20252b'; g.beginPath(); g.arc(x, y, 6, 0, TAU); g.fill(); g.fillStyle = '#5a626c'; g.fillRect(x - 6, y - 2, 12, 3);
  emit(c, (e) => { glowAt(e, x, y, 70, col, 0.55); e.save(); e.globalCompositeOperation = 'lighter'; const q = grad(e, x, y, tx, ty, [[0, al(col, a * 1.5)], [1, al(col, 0)]]); e.fillStyle = q; poly(e, [x - 4, y, x + 4, y, tx + spread, ty, tx - spread, ty]); e.fill(); e.restore(); poolAt(e, tx, ty, spread * 1.3, spread * 0.28, col, 0.3); });
}
function smoke(c, x, y, o = {}) { // rookpluim (dynamisch)
  const n = o.n ?? 9, sp = o.speed ?? 26, col = o.col || (c.P.key === 'day' ? '#e9edf0' : '#9aa6bf'), size = o.size ?? 9, rise = o.rise ?? 120, drift = o.drift ?? 40;
  c.D.push((g, t) => {
    for (let i = 0; i < n; i++) {
      const k = ((t * (sp / rise) + i / n) % 1), px = x + k * drift + Math.sin(t * 0.8 + i) * 4 * k, py = y - k * rise, r = size * (0.5 + k * 2.2);
      g.fillStyle = al(col, (1 - k) * (o.a ?? 0.5) * Math.min(1, k * 6)); g.beginPath(); g.arc(px, py, r, 0, TAU); g.fill();
    }
  });
}
function fire(c, x, y, s = 1, col = '#ff8a2a') {
  c.D.push((g, t) => {
    g.save(); g.translate(x, y); g.scale(s, s);
    const f = 1 + Math.sin(t * 17 + x) * 0.12 + Math.sin(t * 29 + x * 2) * 0.08;
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = rgrad(g, 0, -10, 0, 80, [[0, al(col, 0.38)], [1, al(col, 0)]]); g.fillRect(-80, -90, 160, 160);
    g.globalCompositeOperation = 'source-over';
    for (const [rx, ry, cc, off] of [[9, 20, col, 0], [6, 14, '#ffd24a', 2], [3, 8, '#fff6b0', 3]]) { g.fillStyle = cc; g.beginPath(); g.moveTo(-rx, -off); g.quadraticCurveTo(-rx * 1.1, -ry * f * 0.6, Math.sin(t * 11 + x) * 2, -ry * f * 1.8); g.quadraticCurveTo(rx * 1.1, -ry * f * 0.6, rx, -off); g.closePath(); g.fill(); }
    g.restore();
  });
}
function beam(c, x, y, len, w, col, speed, ph = 0, a = 0.13, range = 0.5) { // draaiende zoeklichtstraal
  c.D.push((g, t) => { const ang = -Math.PI / 2 + Math.sin(t * speed + ph) * range; g.save(); g.translate(x, y); g.rotate(ang + Math.PI / 2); g.globalCompositeOperation = 'lighter'; g.fillStyle = grad(g, 0, 0, 0, -len, [[0, al(col, a * 1.6)], [1, al(col, 0)]]); poly(g, [-3, 0, 3, 0, w, -len, -w, -len]); g.fill(); g.restore(); });
}

// ------------------------------------------------------------------ props
const ps = (y) => 0.45 + ((y - HZ) / (H - HZ)) * 0.9; // perspectiefschaal op hoogte y

function tree(c, x, base, h, o = {}) {
  const g = c.g, type = o.type || 'round', day = c.P.key === 'day';
  ellShadow(g, x + h * 0.12, base, h * 0.32, h * 0.06, 0.35);
  if (type === 'palm') {
    const lean = o.lean ?? 30, tx = x + lean, ty = base - h;
    g.strokeStyle = '#6a4a2a'; g.lineWidth = h * 0.06; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, base); g.quadraticCurveTo(x + lean * 0.1, base - h * 0.55, tx, ty); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1.5; for (let i = 1; i < 14; i++) { const k = i / 14, px = lerp(x, tx, k * k), py = lerp(base, ty, k); g.beginPath(); g.moveTo(px - h * 0.03, py); g.lineTo(px + h * 0.03, py - 3); g.stroke(); }
    const leaf = o.col || '#3f8a3a';
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI + (i / 8) * Math.PI + rnd(-0.12, 0.12), L = h * rnd(0.38, 0.52);
      const ex = tx + Math.cos(a) * L, ey = ty + Math.sin(a) * L * 0.55 + L * 0.45;
      g.fillStyle = sh(leaf, rnd(-0.2, 0.1)); g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo(tx + Math.cos(a) * L * 0.5, ty + Math.sin(a) * L * 0.9 - 6, ex, ey); g.quadraticCurveTo(tx + Math.cos(a) * L * 0.5, ty + Math.sin(a) * L * 0.9 + 12, tx, ty + 3); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1; g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo(tx + Math.cos(a) * L * 0.5, ty + Math.sin(a) * L * 0.9 + 2, ex, ey); g.stroke();
    }
    g.fillStyle = '#5a3a1a'; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(tx - 5 + i * 5, ty + 6, 4.5, 0, TAU); g.fill(); }
    return;
  }
  if (type === 'pine') {
    const col = o.col || '#2f6a44'; g.fillStyle = '#4a3220'; g.fillRect(x - h * 0.03, base - h * 0.15, h * 0.06, h * 0.15);
    const layers = 6;
    for (let i = 0; i < layers; i++) {
      const k = i / layers, yy = base - h * 0.12 - k * h * 0.86, w = h * (0.34 - k * 0.27), th = h * 0.26;
      g.fillStyle = grad(g, x - w, 0, x + w, 0, [[0, sh(col, 0.12)], [0.55, col], [1, sh(col, -0.3)]]); g.beginPath(); g.moveTo(x, yy - th); g.lineTo(x + w, yy); g.quadraticCurveTo(x, yy + th * 0.14, x - w, yy); g.closePath(); g.fill();
      g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.moveTo(x, yy - th * 0.2); g.lineTo(x + w, yy); g.quadraticCurveTo(x, yy + th * 0.14, x, yy); g.fill();
    }
    return;
  }
  if (type === 'dead') {
    g.strokeStyle = o.col || '#2a2420'; g.lineCap = 'round';
    const br = (bx, by, len, ang, wd, d) => { const ex = bx + Math.cos(ang) * len, ey = by + Math.sin(ang) * len; g.lineWidth = wd; g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo((bx + ex) / 2 + rnd(-6, 6), (by + ey) / 2, ex, ey); g.stroke(); if (d > 0) { br(ex, ey, len * 0.7, ang + rnd(0.3, 0.8), wd * 0.65, d - 1); br(ex, ey, len * 0.65, ang - rnd(0.3, 0.8), wd * 0.65, d - 1); } };
    br(x, base, h * 0.38, -Math.PI / 2 + rnd(-0.1, 0.1), h * 0.07, 4); return;
  }
  const col = o.col || (day ? '#4d9a46' : '#3d8a3f');
  g.fillStyle = grad(g, x - h * 0.05, 0, x + h * 0.05, 0, [[0, '#6a4a2c'], [1, '#2e1e10']]); g.beginPath(); g.moveTo(x - h * 0.045, base); g.quadraticCurveTo(x - h * 0.03, base - h * 0.3, x - h * 0.02, base - h * 0.55); g.lineTo(x + h * 0.025, base - h * 0.55); g.quadraticCurveTo(x + h * 0.03, base - h * 0.3, x + h * 0.05, base); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1; for (let i = 0; i < 6; i++) { const bx = x + rnd(-h * 0.03, h * 0.03); g.beginPath(); g.moveTo(bx, base); g.lineTo(bx + rnd(-3, 3), base - h * rnd(0.2, 0.5)); g.stroke(); }
  const cy = base - h * 0.68, rx = h * (o.wide ?? 0.3), ry = h * 0.3, blobs = [];
  for (let i = 0; i < 38; i++) { const a = R() * TAU, d = Math.sqrt(R()); blobs.push([x + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, h * rnd(0.07, 0.13)]); }
  blobs.sort((p, q) => p[1] - q[1]);
  for (const [bx, by, br] of blobs) { const lit = clamp((by - (cy - ry)) / (ry * 2), 0, 1); g.fillStyle = sh(col, 0.18 - lit * 0.5 + rnd(-0.06, 0.06)); g.beginPath(); g.arc(bx, by, br, 0, TAU); g.fill(); }
  for (let i = 0; i < 28; i++) { const a = R() * TAU, d = Math.sqrt(R()) * 0.9; g.fillStyle = al(sh(col, 0.4), 0.5); g.beginPath(); g.arc(x - rx * 0.15 + Math.cos(a) * rx * d * 0.8, cy - ry * 0.4 + Math.sin(a) * ry * d * 0.7, h * 0.028, 0, TAU); g.fill(); }
  if (o.fruit) { g.fillStyle = o.fruit; for (let i = 0; i < 18; i++) { const a = R() * TAU, d = Math.sqrt(R()); g.beginPath(); g.arc(x + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, 2.6, 0, TAU); g.fill(); } }
}
function bush(c, x, base, w, h, col = '#3f8a3f', o = {}) {
  const g = c.g; ellShadow(g, x + 4, base, w * 0.55, h * 0.12, 0.3);
  const n = Math.max(6, (w / 9) | 0), bl = [];
  for (let i = 0; i < n; i++) { const t = i / (n - 1); bl.push([x - w / 2 + t * w + rnd(-4, 4), base - h * (0.35 + 0.35 * Math.sin(t * Math.PI)) * rnd(0.7, 1.1), h * rnd(0.28, 0.45)]); }
  for (const [bx, by, br] of bl) { g.fillStyle = sh(col, rnd(-0.28, -0.05)); g.beginPath(); g.arc(bx, by, br, 0, TAU); g.fill(); }
  for (const [bx, by, br] of bl) { g.fillStyle = sh(col, rnd(0.0, 0.2)); g.beginPath(); g.arc(bx - br * 0.2, by - br * 0.25, br * 0.62, 0, TAU); g.fill(); }
  if (o.flowers) { g.fillStyle = o.flowers; for (let i = 0; i < w / 6; i++) { g.beginPath(); g.arc(x + rnd(-w / 2, w / 2), base - rnd(h * 0.2, h * 0.9), 2, 0, TAU); g.fill(); } }
}
function hedge(c, x, base, w, h, col = '#3a7a3a') {
  const g = c.g; ellShadow(g, x + w / 2, base, w * 0.52, 7, 0.3);
  g.fillStyle = grad(g, 0, base - h, 0, base, [[0, sh(col, 0.15)], [1, sh(col, -0.35)]]); rr(g, x, base - h, w, h, h * 0.28); g.fill();
  for (let i = 0; i < w * h / 26; i++) { g.fillStyle = al(sh(col, R() < 0.5 ? 0.3 : -0.4), 0.35); g.fillRect(x + R() * w, base - h + R() * h, 2, 2); }
}
function tulips(c, x, base, w, cols = ['#e83a3a', '#f5c42a', '#e86aa8', '#ffffff']) {
  const g = c.g; g.fillStyle = '#4a3220'; g.fillRect(x, base - 5, w, 8); g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(x, base - 5, w, 1.5);
  for (let i = 0; i < w / 7; i++) {
    const px = x + 4 + i * 7 + rnd(-1.5, 1.5), ph = rnd(14, 24), col = cols[(R() * cols.length) | 0];
    g.strokeStyle = '#2f7a2a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(px, base - 4); g.quadraticCurveTo(px + rnd(-2, 2), base - ph / 2, px, base - ph); g.stroke();
    g.fillStyle = '#3a8a34'; g.beginPath(); g.moveTo(px, base - 4); g.quadraticCurveTo(px - 7, base - 13, px - 4, base - 20); g.quadraticCurveTo(px - 1, base - 12, px, base - 4); g.fill();
    g.fillStyle = col; g.beginPath(); g.moveTo(px - 3.6, base - ph + 1); g.quadraticCurveTo(px - 4.5, base - ph - 7, px - 2, base - ph - 8); g.lineTo(px, base - ph - 4); g.lineTo(px + 2, base - ph - 8); g.quadraticCurveTo(px + 4.5, base - ph - 7, px + 3.6, base - ph + 1); g.quadraticCurveTo(px, base - ph + 4, px - 3.6, base - ph + 1); g.fill();
    g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(px - 1, base - ph - 6, 2, 6);
  }
}
function flowers(c, x, base, w, h, cols) {
  const g = c.g;
  for (let i = 0; i < w * h / 55; i++) { const px = x + R() * w, py = base - R() * h; g.strokeStyle = '#3a7a30'; g.lineWidth = 1; g.beginPath(); g.moveTo(px, py); g.lineTo(px, py + 8); g.stroke(); g.fillStyle = pick(cols); g.beginPath(); g.arc(px, py, 2.4, 0, TAU); g.fill(); g.fillStyle = '#ffe66a'; g.fillRect(px - 0.5, py - 0.5, 1.2, 1.2); }
}
function wheel(g, x, y, r) {
  g.fillStyle = '#111317'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  g.fillStyle = grad(g, x - r, y - r, x + r, y + r, [[0, '#d8dde2'], [1, '#6a727c']]); g.beginPath(); g.arc(x, y, r * 0.62, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = r * 0.07; for (let i = 0; i < 5; i++) { const a = i * TAU / 5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6); g.stroke(); }
  g.fillStyle = '#2a2e34'; g.beginPath(); g.arc(x, y, r * 0.16, 0, TAU); g.fill();
}
function car(c, x, base, len, o = {}) { // zijaanzicht, x = midden
  const g = c.g, face = o.face || 1, col = o.col || '#c8302a', type = o.type || 'car';
  const L = type === 'limo' ? 320 : 200, s = len / L;
  g.save(); g.translate(x, base); g.scale(s * face, s); g.translate(-L / 2, 0);
  ellShadow(g, L / 2, 2, L / 2 + 8, 9, 0.45);
  g.fillStyle = grad(g, 0, -80, 0, -14, [[0, sh(col, 0.35)], [0.3, col], [0.75, sh(col, -0.25)], [1, sh(col, -0.55)]]);
  g.beginPath(); g.moveTo(6, -22);
  if (type === 'van') { g.lineTo(6, -60); g.quadraticCurveTo(10, -70, 30, -74); g.lineTo(150, -84); g.quadraticCurveTo(186, -84, 192, -58); g.lineTo(196, -24); }
  else { g.lineTo(5, -38); g.quadraticCurveTo(8, -47, 30, -50); g.lineTo(62, -55); g.quadraticCurveTo(80, -80, 108, -80); g.lineTo(L - 52, -80); g.quadraticCurveTo(L - 28, -78, L - 18, -56); g.lineTo(L - 5, -50); g.quadraticCurveTo(L, -44, L - 2, -24); }
  g.lineTo(L - 6, -16); g.lineTo(6, -16); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 2; g.stroke();
  g.fillStyle = grad(g, 0, -78, 0, -54, [[0, '#2a3a52'], [1, '#0c121c']]);
  if (type === 'van') { poly(g, [40, -70, 150, -80, 178, -76, 184, -56, 40, -56]); g.fill(); }
  else { poly(g, [68, -56, 84, -76, 108, -77, 108, -56]); g.fill(); poly(g, [114, -56, 114, -77, L - 54, -77, L - 36, -56]); g.fill(); }
  g.fillStyle = 'rgba(255,255,255,.18)'; poly(g, [76, -56, 90, -75, 98, -75, 84, -56]); g.fill();
  g.fillStyle = sh(col, -0.4); g.fillRect(110, -78, 3, 24);
  g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(112, -54); g.lineTo(112, -17); g.stroke(); g.fillStyle = sh(col, 0.4); g.fillRect(122, -46, 12, 3);
  g.fillStyle = 'rgba(255,255,255,.16)'; g.beginPath(); g.moveTo(8, -46); g.quadraticCurveTo(100, -60, L - 10, -46); g.lineTo(L - 10, -43); g.quadraticCurveTo(100, -57, 8, -43); g.fill();
  if (o.stripe) { g.fillStyle = o.stripe; g.fillRect(8, -40, L - 14, 7); }
  if (type === 'police') { g.fillStyle = '#f4f4f4'; g.fillRect(6, -40, L - 10, 20); g.fillStyle = '#1d4fa8'; g.fillRect(6, -34, L - 10, 7); txt(g, 'POLITIE', L / 2 + 4, -26, 13, '#1d4fa8'); g.fillStyle = '#222'; g.fillRect(L / 2 - 14, -86, 28, 6); }
  g.fillStyle = '#20242a'; g.fillRect(4, -24, 10, 8); g.fillRect(L - 12, -24, 10, 8);
  g.fillStyle = c.P.lights ? '#8a8260' : '#f4efd0'; g.beginPath(); g.ellipse(L - 6, -38, 6, 4.5, 0, 0, TAU); g.fill();
  g.fillStyle = c.P.lights ? '#4a1410' : '#d02a22'; g.beginPath(); g.ellipse(8, -38, 4.5, 4, 0, 0, TAU); g.fill();
  const wr = 19; wheel(g, 42, -wr + 1, wr); wheel(g, L - 46, -wr + 1, wr); if (type === 'limo') wheel(g, L / 2 + 10, -wr + 1, wr);
  g.restore();
  if (o.lights) { const fx = x + face * (L / 2 - 6) * s, bx = x - face * (L / 2 - 8) * s; emit(c, (e) => { glowAt(e, fx, base - 38 * s, 60 * s, '#fff2c0', 0.5); poolAt(e, fx + face * 50 * s, base + 4, 80 * s, 8 * s, '#ffe9a8', 0.3); glowAt(e, bx, base - 38 * s, 26 * s, '#ff3a2a', 0.5); }); }
  return { x, base, s, face, L };
}
function bike(c, x, base, s = 1, col = '#2a5aa8', face = 1) {
  const g = c.g; g.save(); g.translate(x, base); g.scale(s * face, s); g.lineCap = 'round'; g.lineJoin = 'round';
  const wh = (cx) => { g.strokeStyle = '#15171b'; g.lineWidth = 3.4; g.beginPath(); g.arc(cx, -17, 17, 0, TAU); g.stroke(); g.strokeStyle = 'rgba(200,205,210,.7)'; g.lineWidth = 0.8; for (let i = 0; i < 8; i++) { const a = i * TAU / 8; g.beginPath(); g.moveTo(cx, -17); g.lineTo(cx + Math.cos(a) * 15, -17 + Math.sin(a) * 15); g.stroke(); } };
  wh(-24); wh(26);
  g.strokeStyle = col; g.lineWidth = 3.6; g.beginPath(); g.moveTo(-24, -17); g.lineTo(-6, -40); g.lineTo(16, -40); g.lineTo(26, -17); g.moveTo(-6, -40); g.lineTo(0, -17); g.lineTo(-24, -17); g.moveTo(0, -17); g.lineTo(16, -40); g.stroke();
  g.strokeStyle = '#20242a'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(-6, -40); g.lineTo(-8, -48); g.moveTo(-14, -48); g.lineTo(-2, -48); g.moveTo(16, -40); g.lineTo(20, -52); g.lineTo(14, -54); g.stroke();
  g.fillStyle = '#5a3a1c'; g.fillRect(34, -42, 10, 10); g.strokeStyle = '#8a6a3a'; g.lineWidth = 1; g.strokeRect(34, -42, 10, 10);
  g.restore();
}
function cart(c, x, base, s = 1, col = '#b8bec6') {
  const g = c.g; g.save(); g.translate(x, base); g.scale(s, s); g.strokeStyle = col; g.lineWidth = 2;
  g.beginPath(); g.moveTo(-24, -44); g.lineTo(-18, -22); g.lineTo(20, -22); g.lineTo(26, -44); g.closePath(); g.stroke();
  for (let i = -18; i <= 22; i += 6) { g.beginPath(); g.moveTo(i, -44); g.lineTo(i * 0.82, -22); g.stroke(); }
  g.beginPath(); g.moveTo(-23, -34); g.lineTo(25, -34); g.moveTo(-20, -28); g.lineTo(22, -28); g.stroke();
  g.beginPath(); g.moveTo(-24, -44); g.lineTo(-32, -50); g.lineTo(-24, -50); g.stroke(); g.fillStyle = '#d83a2a'; g.fillRect(-34, -52, 12, 4);
  g.fillStyle = '#16181c'; for (const wx of [-14, 15]) { g.beginPath(); g.arc(wx, -6, 4, 0, TAU); g.fill(); g.strokeStyle = col; g.beginPath(); g.moveTo(wx, -10); g.lineTo(wx, -22); g.stroke(); }
  g.restore();
}
function crate(g, x, base, w, h, col = '#a07a46') {
  g.fillStyle = grad(g, 0, base - h, 0, base, [[0, sh(col, 0.1)], [1, sh(col, -0.25)]]); g.fillRect(x, base - h, w, h);
  g.strokeStyle = sh(col, -0.45); g.lineWidth = 2; g.strokeRect(x + 1, base - h + 1, w - 2, h - 2);
  g.beginPath(); g.moveTo(x, base - h); g.lineTo(x + w, base); g.moveTo(x + w, base - h); g.lineTo(x, base); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(x + 2, base - h + 2, w - 4, 2);
}
function box(g, x, base, w, h, col = '#c8a468', label) {
  g.fillStyle = grad(g, x, 0, x + w, 0, [[0, sh(col, 0.08)], [1, sh(col, -0.2)]]); g.fillRect(x, base - h, w, h);
  g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(x, base - h, w, 3); g.fillStyle = 'rgba(235,225,200,.7)'; g.fillRect(x + w / 2 - 4, base - h, 8, h);
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.2; g.strokeRect(x + 0.5, base - h + 0.5, w - 1, h - 1);
  if (label && w > 30) { g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(x + 4, base - h * 0.4, w * 0.28, h * 0.22); }
}
function barrel(g, x, base, w, h, col = '#2a5aa0') {
  g.fillStyle = grad(g, x, 0, x + w, 0, [[0, sh(col, 0.25)], [0.45, col], [1, sh(col, -0.45)]]); rr(g, x, base - h, w, h, 4); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.5; for (const k of [0.2, 0.5, 0.8]) { g.beginPath(); g.moveTo(x, base - h * k); g.lineTo(x + w, base - h * k); g.stroke(); }
}
function pallet(g, x, base, w) { g.fillStyle = '#a07a46'; g.fillRect(x, base - 12, w, 4); g.fillStyle = '#7a5a30'; for (let i = 0; i < 3; i++) g.fillRect(x + (w - 8) * (i / 2), base - 8, 8, 8); g.fillStyle = '#b8935a'; g.fillRect(x, base - 12, w, 1.5); }
function fenceMesh(c, x0, x1, base, h) {
  const g = c.g; g.save(); g.beginPath(); g.rect(x0, base - h, x1 - x0, h); g.clip(); g.strokeStyle = 'rgba(190,198,206,.5)'; g.lineWidth = 1; g.beginPath();
  for (let xx = x0 - h; xx < x1 + h; xx += 9) { g.moveTo(xx, base); g.lineTo(xx + h, base - h); g.moveTo(xx + h, base); g.lineTo(xx, base - h); }
  g.stroke(); g.restore();
  g.fillStyle = '#4a525a'; for (let xx = x0; xx <= x1; xx += 90) g.fillRect(xx - 2, base - h - 6, 4, h + 6);
  g.fillRect(x0, base - h - 3, x1 - x0, 3);
  g.strokeStyle = '#8a929a'; g.lineWidth = 1.2; g.beginPath(); for (let xx = x0; xx < x1; xx += 7) { g.moveTo(xx, base - h - 8); g.lineTo(xx + 3.5, base - h - 14); g.lineTo(xx + 7, base - h - 8); } g.stroke();
}
function picket(c, x0, x1, base, h, col = '#f2f0e8') {
  const g = c.g; for (let xx = x0; xx < x1; xx += 11) { g.fillStyle = grad(g, xx, 0, xx + 8, 0, [[0, sh(col, 0.05)], [1, sh(col, -0.25)]]); g.beginPath(); g.moveTo(xx, base); g.lineTo(xx, base - h + 4); g.lineTo(xx + 4, base - h); g.lineTo(xx + 8, base - h + 4); g.lineTo(xx + 8, base); g.fill(); }
  g.fillStyle = sh(col, -0.1); g.fillRect(x0, base - h * 0.75, x1 - x0, 4); g.fillRect(x0, base - h * 0.3, x1 - x0, 4); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x0, base - h * 0.75 + 4, x1 - x0, 2); g.fillRect(x0, base - h * 0.3 + 4, x1 - x0, 2);
}
function bollard(g, x, base, h = 26, col = '#c8c8c0') { g.fillStyle = grad(g, x - 5, 0, x + 5, 0, [[0, sh(col, 0.2)], [1, sh(col, -0.4)]]); rr(g, x - 5, base - h, 10, h, 4); g.fill(); g.fillStyle = '#d8b030'; g.fillRect(x - 5, base - h + 5, 10, 3); }
function bench(g, x, base, w = 70) { g.fillStyle = '#5a3a20'; for (let i = 0; i < 3; i++) g.fillRect(x, base - 26 - i * 6, w, 4); g.fillRect(x, base - 20, w, 4); g.fillStyle = '#2a2a2e'; g.fillRect(x + 4, base - 20, 4, 20); g.fillRect(x + w - 8, base - 20, 4, 20); g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(x, base - 26, w, 1.2); }
function flag(c, x, base, h, col, o = {}) { // wapperende vlag (dynamisch)
  const g = c.g; g.fillStyle = '#b8bcc2'; g.fillRect(x - 2, base - h, 4, h); g.fillStyle = '#e8c64a'; g.beginPath(); g.arc(x, base - h - 2, 4, 0, TAU); g.fill();
  const fw = o.w ?? 56, fh = o.h ?? 34, fy = base - h + 6, sx = x + 2, dim = c.P.tint ? c.P.tint.map((v) => v / 255) : [1, 1, 1];
  const cc = mix(col, hx(...[0, 1, 2].map((i) => 255 * dim[i])), 0.0), c2 = o.col2 ? o.col2 : null;
  const tc = (z) => { const r = rgb(z); return `rgb(${r[0] * dim[0] | 0},${r[1] * dim[1] | 0},${r[2] * dim[2] | 0})`; };
  c.D.push((gg, t) => {
    const N = 10; for (let i = 0; i < N; i++) {
      const k = i / N, wv = Math.sin(t * 3 + k * 5 + x) * 4 * k, x0 = sx + k * fw;
      gg.fillStyle = tc(c2 && k > 0.5 ? c2 : col); gg.fillRect(x0, fy + wv, fw / N + 1, fh);
      gg.fillStyle = `rgba(0,0,0,${0.05 + 0.12 * (Math.sin(t * 3 + k * 5 + x + 1) > 0 ? 1 : 0)})`; gg.fillRect(x0, fy + wv, fw / N + 1, fh);
      if (o.stripe) { gg.fillStyle = tc(o.stripe); gg.fillRect(x0, fy + wv + fh * 0.4, fw / N + 1, fh * 0.2); }
    }
  });
}

// ------------------------------------------------------------------ lucht, wolken, achtergrondlagen (parallax)
function buildSky(c) {
  const g = c.sk, P = c.P, n = c.n; g.save(); g.translate(40, 0);
  g.fillStyle = grad(g, 0, 0, 0, HZ + 30, P.sky); g.fillRect(-40, 0, W + 80, HZ + 40);
  const cel = [[1030, 118], [230, 128], [860, 92]][n % 3];
  if (P.key === 'night') {
    for (let i = 0; i < 300; i++) {
      const sx = rnd(-40, W + 40), sy = Math.pow(R(), 1.5) * (HZ - 30), big = R() < 0.06, r = big ? 1.7 : R() < 0.3 ? 1.1 : 0.65;
      g.fillStyle = al(pick(['#ffffff', '#cfe0ff', '#fff2cf', '#ffffff']), 0.35 + R() * 0.6); g.beginPath(); g.arc(sx, sy, r, 0, TAU); g.fill();
      if (big) glowAt(g, sx, sy, 9, '#bcd4ff', 0.5);
      if (R() < 0.05) c.twinkle.push({ x: sx, y: sy, ph: R() * 9 });
    }
    g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = grad(g, 0, 60, 0, HZ, [[0, 'rgba(70,90,160,0)'], [0.6, 'rgba(60,80,150,.10)'], [1, 'rgba(190,120,70,.30)']]); g.fillRect(-40, 60, W + 80, HZ); g.restore();
    glowAt(g, cel[0], cel[1], 300, '#9ab4ff', 0.38);
    g.fillStyle = grad(g, cel[0] - 40, cel[1] - 40, cel[0] + 40, cel[1] + 40, [[0, '#fffbe8'], [1, '#d8dcc8']]); g.beginPath(); g.arc(cel[0], cel[1], 40, 0, TAU); g.fill();
    g.fillStyle = 'rgba(120,125,110,.28)'; for (const [dx, dy, r] of [[-12, -10, 9], [14, 8, 12], [-6, 18, 6], [18, -16, 6], [-22, 8, 5]]) { g.beginPath(); g.arc(cel[0] + dx, cel[1] + dy, r, 0, TAU); g.fill(); }
    g.fillStyle = 'rgba(20,30,70,.18)'; g.beginPath(); g.arc(cel[0] + 14, cel[1] + 6, 40, 0, TAU); g.arc(cel[0], cel[1], 40, 0, TAU, true); g.fill('evenodd');
    glowAt(g, W / 2, HZ + 10, 520, '#e08a50', 0.2);
  } else if (P.key === 'dusk') {
    for (let i = 0; i < 70; i++) { g.fillStyle = al('#ffffff', R() * 0.5); g.beginPath(); g.arc(rnd(-40, W + 40), Math.pow(R(), 2) * 220, R() < 0.1 ? 1.3 : 0.7, 0, TAU); g.fill(); }
    const sx = cel[0] > 640 ? 880 : 380, sy = HZ - 38;
    glowAt(g, sx, sy, 520, '#ff9a4a', 0.65); glowAt(g, sx, sy, 190, '#ffe0a0', 0.8);
    g.fillStyle = grad(g, 0, sy - 44, 0, sy + 44, [[0, '#fff3c0'], [1, '#ffb050']]); g.beginPath(); g.arc(sx, sy, 44, 0, TAU); g.fill();
    g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = grad(g, 0, HZ - 120, 0, HZ + 20, [[0, 'rgba(255,140,80,0)'], [1, 'rgba(255,170,90,.35)']]); g.fillRect(-40, HZ - 120, W + 80, 140); g.restore();
  } else {
    glowAt(g, cel[0], cel[1], 380, '#fff6d0', 0.7); glowAt(g, cel[0], cel[1], 120, '#ffffff', 0.9);
    g.fillStyle = '#fffdf0'; g.beginPath(); g.arc(cel[0], cel[1], 34, 0, TAU); g.fill();
    g.fillStyle = grad(g, 0, HZ - 150, 0, HZ + 20, [[0, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,.35)']]); g.fillRect(-40, HZ - 150, W + 80, 170);
  }
  g.restore();
  // wolken-sprites
  const N = P.key === 'night' ? 4 : 6;
  for (let i = 0; i < N; i++) {
    const sp = newCanvas(380, 150), s = sp.getContext('2d'); const top = { day: '#ffffff', dusk: '#ffc9a8', night: '#6a7cae' }[P.key], bot = { day: '#c3d4e4', dusk: '#7a4a80', night: '#161f48' }[P.key];
    for (let k = 0; k < 20; k++) { const bx = 70 + R() * 240, by = 78 - Math.sin(((bx - 70) / 240) * Math.PI) * 26 + rnd(-10, 12), br = rnd(24, 52); s.fillStyle = rgrad(s, bx, by - br * 0.3, 2, br, [[0, al(top, 0.9)], [0.6, al(mix(top, bot, 0.45), 0.7)], [1, al(bot, 0)]]); s.beginPath(); s.arc(bx, by, br, 0, TAU); s.fill(); }
    s.globalCompositeOperation = 'source-atop'; s.fillStyle = grad(s, 0, 40, 0, 130, [[0, al(bot, 0)], [1, al(bot, P.key === 'night' ? 0.7 : 0.45)]]); s.fillRect(0, 0, 380, 150);
    c.clouds.push({ img: sp, x: R() * (W + 600), y: 30 + R() * 250 + (i % 2) * 20, sp: rnd(4, 14), s: rnd(0.7, 1.5), a: P.key === 'night' ? 0.8 : 0.95 });
  }
}
function treeBand(g, y, size, seed, col, o = {}) {
  const r = rng(seed); g.fillStyle = col;
  if (o.pine) { for (let x = -50; x < W + 90; x += size * (0.45 + r() * 0.5)) { const h = size * (1.2 + r() * 1.8), w = size * 0.5; g.beginPath(); g.moveTo(x, y + 6); g.lineTo(x - w / 2, y + 6); for (let k = 1; k < 5; k++) { const kk = k / 5; g.lineTo(x - w * (0.5 - kk * 0.4) - 3, y - h * kk * 0.9 + 2); g.lineTo(x - w * (0.5 - kk * 0.4), y - h * kk * 0.9 + 6); } g.lineTo(x, y - h); g.lineTo(x + w * 0.1, y - h * 0.8); for (let k = 4; k >= 1; k--) { const kk = k / 5; g.lineTo(x + w * (0.5 - kk * 0.4), y - h * kk * 0.9 + 6); g.lineTo(x + w * (0.5 - kk * 0.4) + 3, y - h * kk * 0.9 + 2); } g.lineTo(x + w / 2, y + 6); g.closePath(); g.fill(); } }
  else { g.beginPath(); g.moveTo(-50, y + 30); for (let x = -50; x < W + 90; x += size * (0.5 + r() * 0.5)) { const rr0 = size * (0.7 + r() * 0.6); g.moveTo(x, y + 20); g.arc(x, y - rr0 * 0.4, rr0, 0, TAU); } g.fill(); g.fillRect(-50, y, W + 140, 30); }
}
function skyline(g, y, seed, col, o = {}) {
  const r = rng(seed), P = o.P; let x = -60;
  while (x < W + 80) {
    const w = (o.w0 ?? 40) + r() * (o.w1 ?? 80), h = (o.h0 ?? 40) + r() * (o.h1 ?? 120), tall = r() < (o.tallP ?? 0.12);
    const hh = tall ? h * 1.8 : h; g.fillStyle = col; g.fillRect(x, y - hh, w, hh + 12);
    if (o.roof === 'gable' && !tall) { g.beginPath(); g.moveTo(x, y - hh); g.lineTo(x + w / 2, y - hh - w * 0.3); g.lineTo(x + w, y - hh); g.fill(); }
    if (tall && o.ant) { g.fillRect(x + w / 2 - 1, y - hh - 24, 2, 24); }
    if (o.lit && P.lights) { const lc = o.litCol || '#ffd88a'; g.fillStyle = al(lc, o.litA ?? 0.65); for (let wy = y - hh + 8; wy < y - 4; wy += 11) for (let wx = x + 5; wx < x + w - 6; wx += 9) if (r() < (o.litP ?? 0.35)) g.fillRect(wx, wy, 4, 5); }
    x += w + (o.gap ?? 2) + r() * (o.gapR ?? 4);
  }
}
function ridge(g, y, amp, seed, col, f = 0.006) { g.fillStyle = col; g.beginPath(); g.moveTo(-50, HZ + 20); for (let x = -50; x <= W + 90; x += 6) g.lineTo(x, y - (Math.sin(x * f + seed) * 0.5 + 0.5) * amp - Math.sin(x * f * 2.7 + seed * 3) * amp * 0.25); g.lineTo(W + 90, HZ + 20); g.fill(); }
function hazeBand(g, y0, y1, col, a) { g.fillStyle = grad(g, 0, y0, 0, y1, [[0, al(col, 0)], [1, al(col, a)]]); g.fillRect(-50, y0, W + 140, y1 - y0); }

function buildBG(c) {
  const g = c.bg, P = c.P, ground = c.spec.ground, [far, mid, near] = P.sil, hz = P.haze, n = c.n;
  g.save(); g.translate(40, 0);
  const T = (t) => (P.key === 'night' ? t * 0.6 : t);
  switch (ground) {
    case 'garden': case 'pond': case 'path': {
      ridge(g, HZ - 60, 55, n, far); hazeBand(g, HZ - 120, HZ, hz, T(0.45));
      ridge(g, HZ - 22, 40, n + 3, mid, 0.009); treeBand(g, HZ - 18, 30, n + 7, mid); hazeBand(g, HZ - 90, HZ, hz, T(0.3));
      treeBand(g, HZ + 2, 46, n + 11, near, { pine: ground === 'path' }); treeBand(g, HZ + 8, 34, n + 2, sh(near, -0.1));
      break;
    }
    case 'grass': { // kasteel: ruige bergen en donkere dennen
      for (let k = 0; k < 2; k++) { g.fillStyle = k ? mid : far; g.beginPath(); g.moveTo(-50, HZ + 10); const r = rng(n + k * 9); let x = -50; while (x < W + 90) { const w = 90 + r() * 130, h = 70 + r() * 160 - k * 30; g.lineTo(x + w / 2, HZ - 30 - h - k * 10); g.lineTo(x + w, HZ - 10 - r() * 20); x += w; } g.lineTo(W + 90, HZ + 10); g.fill(); if (k === 0) hazeBand(g, HZ - 220, HZ, hz, T(0.5)); }
      hazeBand(g, HZ - 120, HZ, hz, T(0.35)); treeBand(g, HZ + 4, 44, n + 5, near, { pine: true }); break;
    }
    case 'street': case 'parking': {
      skyline(g, HZ - 10, n + 1, far, { P, h0: 60, h1: 140, tallP: 0.15, lit: true, litP: 0.25, litA: 0.35, ant: true }); hazeBand(g, HZ - 230, HZ, hz, T(0.55));
      skyline(g, HZ + 4, n + 5, mid, { P, h0: 36, h1: 90, w1: 70, lit: true, litP: 0.35, litA: 0.55 }); hazeBand(g, HZ - 100, HZ, hz, T(0.3));
      treeBand(g, HZ + 8, 26, n + 4, near); break;
    }
    case 'neon': case 'plaza': {
      skyline(g, HZ - 8, n + 2, far, { P, h0: 90, h1: 190, tallP: 0.22, lit: true, litP: 0.3, litA: 0.4, ant: true, w0: 34, w1: 56 }); hazeBand(g, HZ - 280, HZ, hz, T(0.55));
      skyline(g, HZ + 4, n + 6, mid, { P, h0: 50, h1: 120, lit: true, litP: 0.4, litA: 0.6, w0: 38, w1: 60 }); hazeBand(g, HZ - 130, HZ, hz, T(0.28));
      if (P.lights) for (let i = 0; i < 26; i++) { const nx = rnd(0, W), ny = rnd(HZ - 150, HZ - 10); glowAt(g, nx, ny, 28, pick(['#ff3a8a', '#30d0ff', '#ffd030', '#a060ff']), 0.28); }
      break;
    }
    case 'canal': {
      skyline(g, HZ - 4, n + 3, far, { P, h0: 60, h1: 80, w0: 36, w1: 30, roof: 'gable', lit: true, litP: 0.3, litA: 0.4 }); hazeBand(g, HZ - 170, HZ, hz, T(0.5));
      treeBand(g, HZ + 6, 30, n + 8, mid); hazeBand(g, HZ - 60, HZ, hz, T(0.25)); break;
    }
    case 'courtyard': case 'market': {
      ridge(g, HZ - 70, 40, n + 4, far); hazeBand(g, HZ - 140, HZ, hz, T(0.5));
      // dakkammen met opgekrulde hoeken
      const r = rng(n + 20); let x = -60; g.fillStyle = mid;
      while (x < W + 80) { const w = 110 + r() * 110, h = 50 + r() * 70, y0 = HZ - h; g.fillRect(x + 8, y0 + 18, w - 16, h + 8); g.beginPath(); g.moveTo(x - 10, y0 + 22); g.quadraticCurveTo(x + w * 0.2, y0 + 20, x + w / 2, y0 - 8); g.quadraticCurveTo(x + w * 0.8, y0 + 20, x + w + 10, y0 + 22); g.quadraticCurveTo(x + w * 0.6, y0 + 28, x + w / 2, y0 + 30); g.quadraticCurveTo(x + w * 0.4, y0 + 28, x - 10, y0 + 22); g.fill(); x += w + r() * 20; }
      hazeBand(g, HZ - 90, HZ, hz, T(0.3)); treeBand(g, HZ + 6, 34, n + 9, near); break;
    }
    case 'yard': {
      skyline(g, HZ - 4, n + 2, far, { P, h0: 30, h1: 60, w0: 60, w1: 100, lit: true, litP: 0.15, litA: 0.4 });
      g.fillStyle = far; for (let x = 60; x < W; x += rnd(160, 260)) { g.fillRect(x, HZ - 170, 14, 170); g.fillRect(x - 3, HZ - 175, 20, 8); } // schoorstenen
      hazeBand(g, HZ - 220, HZ, hz, T(0.55)); skyline(g, HZ + 4, n + 9, mid, { P, h0: 24, h1: 40, w0: 70, w1: 120 }); treeBand(g, HZ + 8, 24, n + 4, near);
      g.strokeStyle = mid; g.lineWidth = 3; g.beginPath(); g.moveTo(90, HZ); g.lineTo(90, HZ - 140); g.lineTo(330, HZ - 140); g.moveTo(330, HZ - 140); g.lineTo(330, HZ); g.moveTo(90, HZ - 140); g.lineTo(60, HZ - 120); g.stroke();
      break;
    }
    case 'beach': case 'harbor': {
      g.fillStyle = grad(g, 0, HZ - 80, 0, HZ + 8, P.key === 'day' ? [[0, '#7ac0e0'], [1, '#3a8ab8']] : P.key === 'dusk' ? [[0, '#e07a6a'], [0.5, '#8a5a8a'], [1, '#3a3a6a']] : [[0, '#1a2a52'], [1, '#0a1230']]); g.fillRect(-50, HZ - 80, W + 140, 90);
      // glitterpad van zon/maan
      const cel = [[1030, 118], [230, 128], [860, 92]][n % 3], sx = P.key === 'dusk' ? (cel[0] > 640 ? 880 : 380) : cel[0];
      if (P.lights || P.key === 'day') { g.save(); g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 60; i++) { const yy = HZ - 78 + i * 1.4, ww = 6 + i * 2.4; g.fillStyle = al(P.key === 'dusk' ? '#ffb060' : P.key === 'night' ? '#aac0ff' : '#ffffff', (0.05 + R() * 0.2) * (1 - i / 80)); g.fillRect(sx - ww / 2 + rnd(-8, 8), yy, ww * rnd(0.2, 0.7), 1.6); } g.restore(); }
      ridge(g, HZ - 78, 14, n + 2, far, 0.003);
      if (ground === 'harbor') { skyline(g, HZ - 70, n + 3, mid, { P, h0: 14, h1: 30, w0: 24, w1: 40, lit: true, litP: 0.4, litA: 0.5 }); g.fillStyle = mid; for (const mx of [160, 520, 930, 1190]) { g.fillRect(mx, HZ - 110, 3, 40); g.fillRect(mx - 18, HZ - 98, 40, 2); } }
      else { treeBand(g, HZ - 60, 20, n + 1, mid, {}); g.fillStyle = far; g.beginPath(); g.ellipse(960, HZ - 76, 110, 22, 0, Math.PI, 0); g.fill(); }
      hazeBand(g, HZ - 120, HZ - 60, hz, T(0.3)); break;
    }
    case 'jungle': {
      ridge(g, HZ - 90, 70, n, far); hazeBand(g, HZ - 200, HZ, hz, T(0.55));
      treeBand(g, HZ - 30, 44, n + 3, mid); hazeBand(g, HZ - 130, HZ, hz, T(0.35)); treeBand(g, HZ + 6, 56, n + 6, near); treeBand(g, HZ + 14, 40, n + 8, sh(near, -0.15));
      break;
    }
    default: { ridge(g, HZ - 40, 40, n, far); treeBand(g, HZ + 4, 40, n, near); }
  }
  g.restore();
}

// ------------------------------------------------------------------ gronden
function distHaze(c, y0 = HZ, y1 = HZ + 100) { const g = c.g; g.fillStyle = grad(g, 0, y0, 0, y1, [[0, al(c.P.haze, c.P.key === 'night' ? 0.35 : 0.55)], [1, al(c.P.haze, 0)]]); g.fillRect(0, y0, W, y1 - y0); }
function lawn(c, y0, y1, a = '#6cb052', b = '#3d7a34', o = {}) {
  const g = c.g; g.fillStyle = grad(g, 0, y0, 0, y1, [[0, a], [1, b]]); g.fillRect(0, y0, W, y1 - y0);
  let alt = 0; for (let y = y0; y < y1; y += 14 * ps(y), alt++) { if (alt % 2) { g.fillStyle = 'rgba(0,0,0,.06)'; g.fillRect(0, y, W, 14 * ps(y)); } else { g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(0, y, W, 14 * ps(y)); } }
  for (let i = 0; i < (W * (y1 - y0)) / 40; i++) { const y = rnd(y0, y1), s = ps(y), x = R() * W; g.strokeStyle = al(R() < 0.5 ? sh(a, 0.25) : sh(b, -0.3), 0.55); g.lineWidth = 1 + s * 0.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + rnd(-2, 2) * s, y - 3 - R() * 5 * s); g.stroke(); }
  if (o.dots) for (let i = 0; i < o.dots; i++) { const y = rnd(y0 + 10, y1), s = ps(y); g.fillStyle = pick(['#ffffff', '#ffe34a', '#ff8ac0']); g.beginPath(); g.arc(R() * W, y, 1.4 * s, 0, TAU); g.fill(); }
}
function pavement(c, y0, y1, col = '#b9b5ac', o = {}) {
  const g = c.g; g.save(); g.beginPath(); g.rect(0, y0, W, y1 - y0); g.clip(); g.fillStyle = col; g.fillRect(0, y0, W, y1 - y0);
  const sw = o.sw ?? 46; let ry = y0, row = 0; const rh = o.rh ?? 22;
  while (ry < y1) { const h = rh; for (let x = -(row % 2) * sw / 2; x < W; x += sw) { g.fillStyle = sh(col, (R() - 0.5) * 0.12); g.fillRect(x + 1, ry + 1, sw - 2, h - 2); g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(x + 1, ry + 1, sw - 2, 1.5); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(x + 1, ry + h - 2.5, sw - 2, 1.5); } ry += h; row++; }
  speckle(g, 0, y0, W, y1 - y0, (W * (y1 - y0)) / 60, ['#000000', '#ffffff', '#4a3a20'], 0.12, 2);
  for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(0,0,0,.08)'; g.beginPath(); g.ellipse(R() * W, rnd(y0, y1), rnd(10, 40), rnd(3, 8), 0, 0, TAU); g.fill(); }
  g.restore();
}
function asphalt(c, y0, y1, col = '#4a4d55', o = {}) {
  const g = c.g; g.save(); g.beginPath(); g.rect(0, y0, W, y1 - y0); g.clip(); g.fillStyle = grad(g, 0, y0, 0, y1, [[0, sh(col, 0.04)], [1, sh(col, -0.1)]]); g.fillRect(0, y0, W, y1 - y0);
  speckle(g, 0, y0, W, y1 - y0, (W * (y1 - y0)) / 18, ['#000000', '#ffffff', '#8a8a92', '#2a2a30'], 0.22, 2);
  for (let i = 0; i < 5; i++) { g.fillStyle = al('#000', rnd(0.05, 0.12)); g.beginPath(); g.ellipse(R() * W, rnd(y0, y1), rnd(30, 120), rnd(4, 14), 0, 0, TAU); g.fill(); }
  g.strokeStyle = 'rgba(10,10,12,.45)'; g.lineWidth = 1.2; for (let i = 0; i < 6; i++) { let x = R() * W, y = rnd(y0, y1); g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 8; k++) { x += rnd(6, 20); y += rnd(-6, 6); g.lineTo(x, y); } g.stroke(); }
  if (o.wet) { g.fillStyle = grad(g, 0, y0, 0, y1, [[0, 'rgba(120,150,210,.0)'], [1, 'rgba(120,150,210,.12)']]); g.fillRect(0, y0, W, y1 - y0); }
  g.restore();
}
function cobbles(c, y0, y1, col = '#8f8a80', o = {}) {
  const g = c.g; g.save(); g.beginPath(); g.rect(0, y0, W, y1 - y0); g.clip(); g.fillStyle = sh(col, -0.45); g.fillRect(0, y0, W, y1 - y0);
  let y = y0, row = 0; while (y < y1) { const s = o.flat ? 1 : ps(y), h = (o.h ?? 11) * s, w = (o.w ?? 17) * s; for (let x = -(row % 2) * w / 2 - R() * 4; x < W; x += w * rnd(0.9, 1.15)) { g.fillStyle = sh(col, (R() - 0.5) * 0.3); g.beginPath(); g.ellipse(x + w / 2, y + h / 2, w / 2 - 1, h / 2 - 0.5, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.16)'; g.fillRect(x + w * 0.25, y + 1, w * 0.4, 1.2); } y += h; row++; }
  g.restore();
}
function slabs(c, y0, y1, col, o = {}) { // grote vloertegels met perspectief
  const g = c.g; g.save(); g.beginPath(); g.rect(0, y0, W, y1 - y0); g.clip(); g.fillStyle = col; g.fillRect(0, y0, W, y1 - y0);
  const cx = o.cx ?? W / 2; let y = y0; const f = o.f ?? 1;
  while (y < y1) { const s = ps(y), h = (o.h ?? 34) * s * f, wd = (o.w ?? 60) * s * f; for (let x = cx - Math.ceil(cx / wd) * wd - wd / 2; x < W; x += wd) { g.fillStyle = sh(col, (R() - 0.5) * (o.v ?? 0.07)); g.fillRect(x + 1, y + 1, wd - 2, h - 2); g.fillStyle = 'rgba(255,255,255,.10)'; g.fillRect(x + 1, y + 1, wd - 2, 2); } y += h; }
  if (o.shine) { g.fillStyle = grad(g, 0, y0, 0, y1, [[0, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,.10)']]); g.fillRect(0, y0, W, y1 - y0); }
  speckle(g, 0, y0, W, y1 - y0, (W * (y1 - y0)) / 90, ['#000000', '#ffffff'], 0.08, 2); g.restore();
}
function planks(c, y0, y1, col = '#7a5a38') { // houten steiger
  const g = c.g; g.save(); g.beginPath(); g.rect(0, y0, W, y1 - y0); g.clip(); let y = y0;
  while (y < y1) { const s = ps(y), h = 17 * s; g.fillStyle = grad(g, 0, y, 0, y + h, [[0, sh(col, 0.08)], [1, sh(col, -0.22)]]); g.fillRect(0, y, W, h); for (let x = rnd(0, 200); x < W; x += rnd(180, 420)) { g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(x, y, 2, h); } g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, y + h - 1.5, W, 1.5); g.fillStyle = 'rgba(30,20,10,.5)'; for (let x = 20; x < W; x += 140) { g.beginPath(); g.arc(x + (y % 7), y + h / 2, 1.3, 0, TAU); g.fill(); } y += h; }
  speckle(g, 0, y0, W, y1 - y0, 1400, ['#000000', '#ffffff', '#3a2a14'], 0.14, 3); g.restore();
}
function sandGround(c, y0, y1) {
  const g = c.g; g.fillStyle = grad(g, 0, y0, 0, y1, [[0, '#e6d29c'], [0.5, '#e2cc92'], [1, '#c8b078']]); g.fillRect(0, y0, W, y1 - y0);
  g.strokeStyle = 'rgba(120,90,40,.12)'; g.lineWidth = 2; for (let y = y0 + 8; y < y1; y += 14 * ps(y)) { g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= W; x += 40) g.lineTo(x, y + Math.sin(x * 0.02 + y) * 3 * ps(y)); g.stroke(); g.strokeStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.moveTo(0, y + 2); for (let x = 0; x <= W; x += 40) g.lineTo(x, y + 2 + Math.sin(x * 0.02 + y) * 3 * ps(y)); g.stroke(); g.strokeStyle = 'rgba(120,90,40,.12)'; }
  speckle(g, 0, y0, W, y1 - y0, 5000, ['#8a6a30', '#ffffff', '#c8a060'], 0.22, 2);
}
function waterRect(c, x, y, w, h, o = {}) {
  const g = c.g, day = c.P.key === 'day'; g.save(); g.beginPath(); if (o.ell) g.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, TAU); else g.rect(x, y, w, h); g.clip();
  const [t, b] = o.cols || (day ? ['#5aa8c8', '#2a6a90'] : ['#2a4a70', '#0c1c38']);
  g.fillStyle = grad(g, 0, y, 0, y + h, [[0, t], [1, b]]); g.fillRect(x, y, w, h);
  g.fillStyle = grad(g, 0, y, 0, y + h * 0.5, [[0, 'rgba(255,255,255,.22)'], [1, 'rgba(255,255,255,0)']]); g.fillRect(x, y, w, h * 0.5);
  g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 1.2; for (let i = 0; i < (w * h) / 700; i++) { const rx = x + R() * w, ry = y + R() * h, l = rnd(10, 40) * (o.ell ? 0.8 : 1); g.beginPath(); g.moveTo(rx, ry); g.quadraticCurveTo(rx + l / 2, ry - 1.5, rx + l, ry); g.stroke(); }
  g.strokeStyle = 'rgba(0,0,0,.2)'; for (let i = 0; i < (w * h) / 1200; i++) { const rx = x + R() * w, ry = y + R() * h, l = rnd(8, 30); g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx + l, ry); g.stroke(); }
  g.restore();
}
function lilyPad(g, x, y, r) { g.fillStyle = '#2f7a34'; g.beginPath(); g.ellipse(x, y, r, r * 0.4, 0, 0.25, TAU); g.lineTo(x, y); g.fill(); g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1; g.stroke(); }
function reeds(g, x, base, n, h) { for (let i = 0; i < n; i++) { const px = x + rnd(-16, 16), hh = h * rnd(0.6, 1.1); g.strokeStyle = pick(['#4a7a3a', '#5a8a44', '#3a6a30']); g.lineWidth = 2; g.beginPath(); g.moveTo(px, base); g.quadraticCurveTo(px + rnd(-6, 6), base - hh * 0.6, px + rnd(-8, 8), base - hh); g.stroke(); if (R() < 0.45) { g.fillStyle = '#5a3a20'; const tx = px + rnd(-3, 3); g.beginPath(); g.ellipse(tx, base - hh, 2.6, 8, 0, 0, TAU); g.fill(); } } }
function stepping(c, pts, col = '#a8a49a') { const g = c.g; for (const [x, y, w] of pts) { g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(x + 2, y + 3, w / 2, w * 0.18, 0, 0, TAU); g.fill(); g.fillStyle = sh(col, (R() - 0.5) * 0.2); g.beginPath(); g.ellipse(x, y, w / 2, w * 0.18, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.ellipse(x - w * 0.1, y - 1, w * 0.3, w * 0.07, 0, 0, TAU); g.fill(); } }

function buildGround(c) {
  const g = c.g, spec = c.spec, n = c.n, dx = c.doorX;
  const lane = (a, b) => { };
  switch (spec.ground) {
    case 'garden': {
      lawn(c, HZ, H, '#6cb052', '#3f7e36', { dots: 160 });
      // pad van natuursteen naar de deur
      for (let i = 0; i < 9; i++) { const y = B + 16 + i * 17 * (1 + i * 0.08), s = ps(y); stepping(c, [[dx + Math.sin(i * 1.7) * 6, y, 78 * s], ], '#b0aca0'); }
      break;
    }
    case 'pond': {
      lawn(c, HZ, H, '#5faa50', '#2f7a3a', { dots: 100 });
      for (let i = 0; i < 7; i++) { const y = B + 16 + i * 16; stepping(c, [[dx + Math.sin(i * 1.3) * 10, y, 64 * ps(y)]], '#a8a49a'); }
      break;
    }
    case 'path': {
      lawn(c, HZ, H, '#5f9a48', '#355f2e', { dots: 80 });
      g.fillStyle = grad(g, 0, B, 0, H, [[0, '#8a6a46'], [1, '#6a4c30']]); g.beginPath(); g.moveTo(dx - 70, B + 6); g.quadraticCurveTo(dx - 120, 650, 120, 692); g.lineTo(0, 700); g.lineTo(0, H); g.lineTo(W, H); g.lineTo(W, 690); g.quadraticCurveTo(1100, 640, dx + 80, B + 6); g.closePath(); g.fill();
      speckle(g, 0, B, W, H - B, 3000, ['#3a2a18', '#c8a470', '#8a8a80'], 0.4, 3);
      for (let i = 0; i < 40; i++) { const y = rnd(620, 718), x = rnd(0, W); g.fillStyle = sh('#8a8478', rnd(-0.2, 0.2)); g.beginPath(); g.ellipse(x, y, rnd(3, 8), rnd(2, 4), 0, 0, TAU); g.fill(); }
      g.strokeStyle = 'rgba(30,20,10,.35)'; g.lineWidth = 2; for (const off of [-24, 22]) { g.beginPath(); g.moveTo(dx + off, B + 6); g.quadraticCurveTo(dx + off * 1.5, 640, off > 0 ? 1260 : 20, 705); g.stroke(); }
      break;
    }
    case 'grass': {
      lawn(c, HZ, H, '#4d8a3e', '#274e28', { dots: 40 });
      g.fillStyle = grad(g, 0, B, 0, H, [[0, '#6a6a70'], [1, '#4a4a52']]); g.beginPath(); g.moveTo(dx - 90, B + 4); g.lineTo(dx - 230, H); g.lineTo(dx + 230, H); g.lineTo(dx + 90, B + 4); g.fill();
      let y = B + 6, r = 0; g.save(); g.beginPath(); g.moveTo(dx - 90, B + 4); g.lineTo(dx - 230, H); g.lineTo(dx + 230, H); g.lineTo(dx + 90, B + 4); g.clip();
      while (y < H) { const s = ps(y), h = 18 * s, wd = 40 * s; for (let x = dx - 300 - (r % 2) * wd / 2; x < dx + 300; x += wd) { g.fillStyle = sh('#6e6e76', (R() - 0.5) * 0.25); g.fillRect(x + 1, y + 1, wd - 2, h - 2); g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(x + 1, y + 1, wd - 2, 1.5); } y += h; r++; } g.restore();
      break;
    }
    case 'square': {
      cobbles(c, HZ, H, '#9a9488', { h: 12, w: 18 });
      g.save(); g.translate(W / 2, 668); g.scale(1, 0.22); g.strokeStyle = 'rgba(80,60,40,.35)'; g.lineWidth = 10; for (const rr0 of [300, 400, 500]) { g.beginPath(); g.arc(0, 0, rr0, 0, TAU); g.stroke(); } g.restore();
      break;
    }
    case 'street': {
      asphalt(c, HZ, B, '#3a3d44'); pavement(c, B, 668, '#b8b4aa'); contactShadow(g, 0, B, W, 12, 0.4);
      g.fillStyle = grad(g, 0, 668, 0, 682, [[0, '#d0ccc2'], [1, '#8a867c']]); g.fillRect(0, 668, W, 12); g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(0, 680, W, 3);
      asphalt(c, 683, H, '#3e4148', { wet: c.P.lights }); g.fillStyle = 'rgba(240,240,230,.85)'; for (let x = 30; x < W; x += 140) g.fillRect(x, 708, 70, 5);
      break;
    }
    case 'parking': {
      asphalt(c, HZ, H, '#44474e'); pavement(c, B, 646, '#c0bcb0'); contactShadow(g, 0, B, W, 12, 0.4);
      g.fillStyle = grad(g, 0, 646, 0, 658, [[0, '#d8d4c8'], [1, '#8a867c']]); g.fillRect(0, 646, W, 12); g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(0, 658, W, 3);
      // parkeervakken (lijnen lopen licht uit)
      g.fillStyle = 'rgba(240,240,232,.85)';
      for (let i = -1; i < 11; i++) { const x0 = 40 + i * 132, x1 = x0 + (x0 - W / 2) * 0.07; poly(g, [x0, 666, x0 + 5, 666, x1 + 9, H, x1 - 2, H]); g.fill(); }
      g.fillRect(0, 666, W, 4);
      for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(240,240,232,.8)'; g.fillRect(W / 2 - 200 + i * 130, HZ + 42, 90, 3); }
      for (let x = 60; x < W; x += 170) { g.fillStyle = 'rgba(240,240,232,.4)'; g.fillRect(x, HZ + 26, 60, 2); }
      // gele zebra + pijl
      g.fillStyle = 'rgba(240,235,200,.8)'; for (let i = 0; i < 9; i++) g.fillRect(dx - 100 + i * 24, 647, 12, 10);
      break;
    }
    case 'canal': {
      cobbles(c, HZ, 668, '#8e7f70', { h: 10, w: 15 }); contactShadow(g, 0, B, W, 14, 0.45);
      g.fillStyle = grad(g, 0, 662, 0, 678, [[0, '#a8a296'], [1, '#6a665c']]); g.fillRect(0, 662, W, 16); g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(0, 662, W, 2);
      waterRect(c, 0, 678, W, H - 678, { cols: c.P.key === 'day' ? ['#6a8a78', '#2c4a46'] : ['#2a3c58', '#0a1424'] });
      g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(0, 678, W, 6);
      for (let i = 0; i < 12; i++) lilyPad(g, rnd(40, W - 40), rnd(690, 716), rnd(6, 11));
      break;
    }
    case 'courtyard': {
      slabs(c, HZ, H, '#8a8a88', { w: 64, h: 30, v: 0.1 }); contactShadow(g, 0, B, W, 14, 0.45);
      g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 2; g.strokeRect(220, 612, W - 440, 100);
      break;
    }
    case 'market': {
      cobbles(c, HZ, H, '#8c7f6e', { h: 12, w: 18 }); contactShadow(g, 0, B, W, 14, 0.45);
      for (let i = 0; i < 9; i++) { g.fillStyle = 'rgba(40,60,90,.18)'; g.beginPath(); g.ellipse(rnd(60, W - 60), rnd(640, 715), rnd(30, 70), rnd(4, 9), 0, 0, TAU); g.fill(); }
      break;
    }
    case 'neon': {
      asphalt(c, HZ, B, '#2e3038'); pavement(c, B, 668, '#8d8a96'); contactShadow(g, 0, B, W, 12, 0.5);
      g.fillStyle = '#6a6872'; g.fillRect(0, 668, W, 12); asphalt(c, 680, H, '#25272d', { wet: true });
      g.fillStyle = 'rgba(235,235,225,.7)'; for (let x = 30; x < W; x += 140) g.fillRect(x, 706, 70, 4);
      break;
    }
    case 'yard': {
      slabs(c, HZ, H, '#7e8084', { w: 110, h: 60, v: 0.08, f: 1 }); contactShadow(g, 0, B, W, 14, 0.45);
      speckle(g, 0, HZ, W, H - HZ, 1200, ['#2a1a0a', '#000000'], 0.16, 4);
      g.fillStyle = 'rgba(230,190,40,.8)'; for (let x = 20; x < W; x += 100) poly(g, [x, 700, x + 40, 700, x + 30, 712, x - 10, 712]), g.fill();
      for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(20,20,30,.15)'; g.beginPath(); g.ellipse(rnd(80, W - 80), rnd(630, 710), rnd(30, 80), rnd(4, 10), 0, 0, TAU); g.fill(); }
      break;
    }
    case 'plaza': {
      slabs(c, HZ, H, c.spec.kind === 'tower' ? '#62666e' : '#a5a29a', { w: 80, h: 40, v: 0.06, shine: true }); contactShadow(g, 0, B, W, 14, 0.4);
      if (c.spec.kind === 'tower') { g.fillStyle = 'rgba(240,200,40,.85)'; g.fillRect(0, 666, W, 5); for (let x = 20; x < W; x += 60) g.fillRect(x, 700, 28, 4); }
      break;
    }
    case 'beach': {
      sandGround(c, HZ, H);
      // schuimlijn waar de zee eindigt
      g.fillStyle = grad(g, 0, HZ, 0, HZ + 22, [[0, '#cdb88a'], [1, 'rgba(230,210,160,0)']]); g.fillRect(0, HZ, W, 22);
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 3; g.beginPath(); for (let x = 0; x <= W; x += 20) g.lineTo(x, HZ + 3 + Math.sin(x * 0.03) * 2.5); g.stroke();
      for (let i = 0; i < 12; i++) { g.fillStyle = al(pick(['#f4d8c8', '#e8b8a0', '#fff']), 0.9); g.beginPath(); g.ellipse(rnd(30, W - 30), rnd(560, 716), 3.5, 2.2, 0, 0, TAU); g.fill(); }
      break;
    }
    case 'harbor': {
      waterRect(c, 0, HZ, W, B - HZ, { cols: c.P.key === 'day' ? ['#4a8ab0', '#24607f'] : ['#15264a', '#08122a'] });
      planks(c, B, H, '#7a5a38'); contactShadow(g, 0, B, W, 12, 0.5);
      g.fillStyle = '#5a4026'; g.fillRect(0, B - 6, W, 8); g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(0, B + 2, W, 3);
      break;
    }
    case 'jungle': {
      g.fillStyle = grad(g, 0, HZ, 0, H, [[0, '#2a4a28'], [1, '#2a2218']]); g.fillRect(0, HZ, W, H - HZ);
      speckle(g, 0, HZ, W, H - HZ, 5000, ['#000000', '#4a7a3a', '#6a4a28', '#2a1a10'], 0.4, 3);
      for (let i = 0; i < 70; i++) { const y = rnd(HZ + 6, H), x = R() * W, s = ps(y), l = rnd(20, 50) * s; g.fillStyle = sh(pick(['#2f7a34', '#3f8f3a', '#226a2e']), rnd(-0.2, 0.15)); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x - l * 0.5, y - l * 0.7, x - l * 0.9 * (R() < 0.5 ? 1 : -1), y - l * 0.2); g.quadraticCurveTo(x - l * 0.3, y - l * 0.5, x, y); g.fill(); }
      g.fillStyle = grad(g, 0, B, 0, H, [[0, 'rgba(70,50,30,0)'], [0.4, 'rgba(90,64,38,.55)'], [1, 'rgba(70,50,30,.3)']]); g.beginPath(); g.moveTo(0, 640); g.quadraticCurveTo(W / 2, 600, W, 640); g.lineTo(W, 700); g.quadraticCurveTo(W / 2, 680, 0, 700); g.fill();
      break;
    }
    default: lawn(c, HZ, H);
  }
  distHaze(c);
}

// ------------------------------------------------------------------ grade (kleurtoon van het tijdstip) en deur
function gradeCanvas(cv, P) {
  if (!P.tint) return;
  const g = cv.getContext('2d'), cp = newCanvas(cv.width, cv.height); cp.getContext('2d').drawImage(cv, 0, 0);
  g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = `rgb(${P.tint[0]},${P.tint[1]},${P.tint[2]})`; g.fillRect(0, 0, cv.width, cv.height);
  g.globalCompositeOperation = 'destination-in'; g.drawImage(cp, 0, 0); g.restore();
}

function doorArt(c) { // 1 keer het deurblad tekenen
  const d = c.door, w = Math.round(d.w), h = Math.round(d.h), cv = newCanvas(w, h), g = cv.getContext('2d'), col = d.col || '#7a4a2a', st = d.style || 'panel';
  const save = R; R = rng(hash(st + w)); // eigen zaad
  const sub = { g, P: c.P, E: [], D: [], lit: false, spec: c.spec };
  if (st === 'wood' || st === 'gate' || st === 'round') {
    wood(g, 0, 0, w, h, { base: col, vert: true, pw: Math.max(10, w / 7) });
    g.fillStyle = '#2a2a2e'; for (const yy of [h * 0.18, h * 0.78]) { g.fillRect(0, yy, w, 8); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(0, yy, w, 1.5); g.fillStyle = '#2a2a2e'; for (let x = 8; x < w; x += 16) { g.fillStyle = '#4a4a52'; g.beginPath(); g.arc(x, yy + 4, 2.2, 0, TAU); g.fill(); } g.fillStyle = '#2a2a2e'; }
    if (st === 'round') { g.fillStyle = '#1a1a1e'; g.beginPath(); g.arc(w * 0.5, h * 0.4, w * 0.14, 0, TAU); g.fill(); g.fillStyle = '#ffd88a'; g.beginPath(); g.arc(w * 0.5, h * 0.4, w * 0.1, 0, TAU); g.fill(); }
    g.fillStyle = '#d8b04a'; g.beginPath(); g.arc(w * 0.84, h * 0.56, w * 0.05, 0, TAU); g.fill(); g.strokeStyle = '#2a1a0a'; g.lineWidth = 1.2; g.stroke();
  } else if (st === 'red') {
    g.fillStyle = grad(g, 0, 0, w, 0, [[0, sh(col, 0.15)], [1, sh(col, -0.2)]]); g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; g.strokeRect(3, 3, w - 6, h - 6);
    const cols = Math.max(3, Math.round(w / 22)), rows = Math.max(4, Math.round(h / 24));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { const px = ((i + 0.5) / cols) * w, py = ((j + 0.5) / rows) * h; g.fillStyle = '#f0c84a'; g.beginPath(); g.arc(px, py, 3.4, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.arc(px - 0.9, py - 0.9, 1.2, 0, TAU); g.fill(); }
    g.fillStyle = '#e8c04a'; g.beginPath(); g.arc(w * 0.82, h * 0.5, 7, 0, TAU); g.fill(); g.strokeStyle = '#6a4a10'; g.lineWidth = 2; g.stroke(); g.beginPath(); g.arc(w * 0.82, h * 0.5 + 12, 5, 0, TAU); g.stroke();
  } else if (st === 'glass') {
    g.fillStyle = grad(g, 0, 0, 0, h, [[0, '#9ac0dc'], [1, '#2a4560']]); g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.22)'; poly(g, [0, h * 0.7, w * 0.7, 0, w, 0, 0, h]); g.fill(); g.fillStyle = 'rgba(255,255,255,.1)'; poly(g, [w * 0.4, h, w, h * 0.3, w, h * 0.55, w * 0.7, h]); g.fill();
    g.strokeStyle = '#aab2bc'; g.lineWidth = 5; g.strokeRect(2.5, 2.5, w - 5, h - 5); g.fillStyle = '#aab2bc'; g.fillRect(0, h * 0.82, w, 6);
    g.fillStyle = '#d8dee4'; g.fillRect(w * 0.84, h * 0.3, 3.5, h * 0.3);
  } else if (st === 'steel') {
    g.fillStyle = grad(g, 0, 0, w, 0, [[0, sh(col, 0.2)], [0.5, col], [1, sh(col, -0.25)]]); g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 2; g.strokeRect(4, 4, w - 8, h - 8); g.fillStyle = '#20262c'; g.fillRect(w * 0.2, h * 0.1, w * 0.6, h * 0.2); g.fillStyle = '#6a8aa8'; g.fillRect(w * 0.22, h * 0.12, w * 0.56, h * 0.16);
    for (let y = h * 0.85; y < h; y += 14) { g.fillStyle = '#e0b81a'; poly(g, [0, y, 14, y, 28, y + 14, 14, y + 14]); g.fill(); for (let x = 28; x < w; x += 28) { poly(g, [x, y, x + 14, y, x + 28, y + 14, x + 14, y + 14]); g.fill(); } }
    g.fillStyle = '#c8ccd0'; g.fillRect(w * 0.1, h * 0.52, w * 0.8, 6); g.fillStyle = 'rgba(0,0,0,.4)'; for (const [px, py] of [[8, 8], [w - 8, 8], [8, h - 24], [w - 8, h - 24]]) { g.beginPath(); g.arc(px, py, 2, 0, TAU); g.fill(); }
  } else { // 'panel'
    g.fillStyle = grad(g, 0, 0, w, h, [[0, sh(col, 0.12)], [1, sh(col, -0.2)]]); g.fillRect(0, 0, w, h);
    for (const [px, py, pw, ph] of [[0.14, 0.07, 0.72, 0.36], [0.14, 0.5, 0.72, 0.42]]) { g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(w * px, h * py, w * pw, h * ph); g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1.5; g.strokeRect(w * px, h * py, w * pw, h * ph); g.strokeStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.moveTo(w * px, h * (py + ph)); g.lineTo(w * (px + pw), h * (py + ph)); g.lineTo(w * (px + pw), h * py); g.stroke(); }
    if (d.win) { g.fillStyle = '#1a2230'; g.fillRect(w * 0.2, h * 0.12, w * 0.6, h * 0.24); g.fillStyle = '#6a8aa8'; g.fillRect(w * 0.22, h * 0.14, w * 0.56, h * 0.2); g.fillStyle = 'rgba(255,255,255,.3)'; poly(g, [w * 0.22, h * 0.3, w * 0.5, h * 0.14, w * 0.62, h * 0.14, w * 0.3, h * 0.34]); g.fill(); }
    g.fillStyle = '#d8b04a'; g.beginPath(); g.arc(w * 0.84, h * 0.52, w * 0.045, 0, TAU); g.fill(); g.fillStyle = '#c8cdd2'; g.fillRect(w * 0.1, h * 0.46, w * 0.18, 4);
  }
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 0, 2, h); g.fillRect(0, 0, w, 2); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(w - 2, 0, 2, h);
  R = save; gradeCanvas(cv, c.P); return cv;
}
function doorInterior(c) {
  const d = c.door, w = Math.round(d.w), h = Math.round(d.h), cv = newCanvas(w, h), g = cv.getContext('2d'), kind = d.int || 'dark';
  const top = kind === 'cool' ? '#f4f9ff' : kind === 'warm' ? '#ffeec0' : '#0d0906', bot = kind === 'cool' ? '#a8c0d4' : kind === 'warm' ? '#d89a48' : '#241709';
  g.fillStyle = grad(g, 0, 0, 0, h, [[0, top], [1, bot]]); g.fillRect(0, 0, w, h);
  // achterwand, vloer en perspectief
  g.fillStyle = kind === 'dark' ? 'rgba(60,40,24,.5)' : 'rgba(255,255,255,.3)'; g.fillRect(w * 0.12, h * 0.1, w * 0.76, h * 0.62);
  g.fillStyle = kind === 'dark' ? 'rgba(0,0,0,.6)' : 'rgba(80,50,20,.35)'; poly(g, [0, h, w, h, w * 0.88, h * 0.72, w * 0.12, h * 0.72]); g.fill();
  if (kind !== 'dark') { g.fillStyle = 'rgba(90,60,30,.25)'; for (let i = 0; i < 4; i++) g.fillRect(w * (0.2 + i * 0.16), h * 0.3, w * 0.08, h * 0.42); }
  g.fillStyle = grad(g, 0, 0, w, 0, [[0, 'rgba(0,0,0,.55)'], [0.25, 'rgba(0,0,0,0)'], [0.75, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.55)']]); g.fillRect(0, 0, w, h);
  g.fillStyle = grad(g, 0, 0, 0, h * 0.25, [[0, 'rgba(0,0,0,.55)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(0, 0, w, h * 0.25);
  return cv;
}
function drawDoor(g, c, o, t) {
  const d = c.door, op = clamp(o.doorOpen || 0, 0, 1), x0 = d.x - d.w / 2, y0 = d.y - d.h, P = c.P;
  const kind = d.int || 'dark', lc = kind === 'cool' ? '#d8ecff' : '#ffd890';
  g.save();
  if (d.rot) { g.translate(d.x, d.y); g.rotate(d.rot); g.translate(-d.x, -d.y); }
  // lichtstraal naar buiten (onder de deur, op de grond)
  if (op > 0.02 && kind !== 'dark') {
    g.save(); g.globalCompositeOperation = 'lighter';
    const reach = 90 + 120 * op, a = (P.lights ? 0.5 : 0.22) * op;
    g.fillStyle = grad(g, 0, d.y, 0, d.y + reach, [[0, al(lc, a)], [1, al(lc, 0)]]); poly(g, [x0 + 4, d.y - 2, x0 + d.w - 4, d.y - 2, x0 + d.w + reach * 0.55, d.y + reach, x0 - reach * 0.55, d.y + reach]); g.fill();
    if (P.lights) glowAt(g, d.x, d.y - d.h * 0.45, d.h * 1.1, lc, 0.3 * op);
    g.restore();
  }
  g.save();
  const path = () => { g.beginPath(); if (d.round) { g.moveTo(x0, d.y); g.lineTo(x0, y0 + d.w / 2); g.arc(d.x, y0 + d.w / 2, d.w / 2, Math.PI, 0); g.lineTo(x0 + d.w, d.y); g.closePath(); } else g.rect(x0, y0, d.w, d.h); };
  path(); g.clip();
  g.drawImage(c.doorInt, x0, y0);
  if (d.type === 'slide') {
    const half = d.w / 2, sl = op * (half - 2);
    g.drawImage(c.doorArt, 0, 0, half, d.h, x0 - sl, y0, half, d.h); g.drawImage(c.doorArt, half, 0, half, d.h, x0 + half + sl, y0, half, d.h);
  } else if (d.type === 'double') {
    const a = op * 1.2, cs = Math.cos(a), half = d.w / 2, pv = 1 - 0.09 * Math.sin(a);
    for (const side of [-1, 1]) {
      g.save(); g.translate(side < 0 ? x0 : x0 + d.w, y0 + d.h / 2); g.scale(cs, pv); g.translate(0, -d.h / 2);
      const px = side < 0 ? 0 : -half; g.drawImage(c.doorArt, side < 0 ? 0 : half, 0, half, d.h, px, 0, half, d.h);
      g.fillStyle = `rgba(0,0,0,${0.55 * op})`; g.fillRect(px, 0, half, d.h); g.restore();
    }
  } else { // hinge / round
    const a = op * 1.25, cs = Math.cos(a), hl = d.hinge !== 1, pv = 1 - 0.09 * Math.sin(a);
    g.save(); g.translate(hl ? x0 : x0 + d.w, y0 + d.h / 2); g.scale(cs, pv); g.translate(0, -d.h / 2);
    const px = hl ? 0 : -d.w; g.drawImage(c.doorArt, px, 0); g.fillStyle = `rgba(0,0,0,${0.55 * op})`; g.fillRect(px, 0, d.w, d.h); g.restore();
    g.fillStyle = grad(g, hl ? x0 : x0 + d.w, 0, hl ? x0 + 14 : x0 + d.w - 14, 0, [[0, 'rgba(0,0,0,.5)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(hl ? x0 : x0 + d.w - 14, y0, 14, d.h);
  }
  g.restore();
  g.restore();
}

// ------------------------------------------------------------------ scene opbouwen en cachen
const KINDS = {};
const cache = new Map();
const KEEP = 4;
function build(spec, n) {
  const P = PAL[spec.time] || PAL.night;
  R = rng(hash(`${spec.kind}|${spec.ground}|${spec.time}|${n}`));
  const scene = newCanvas(), g = scene.getContext('2d'), skyC = newCanvas(W + 80, H), bgC = newCanvas(W + 80, H);
  const tint = P.tint, tc = (col) => { if (!tint) return col; const r = rgb(col); return `rgb(${(r[0] * tint[0]) / 255 | 0},${(r[1] * tint[1]) / 255 | 0},${(r[2] * tint[2]) / 255 | 0})`; };
  const c = { spec, n, P, g, sk: skyC.getContext('2d'), bg: bgC.getContext('2d'), E: [], D: [], clouds: [], twinkle: [], lit: P.lights, door: null, doorX: 640, scale: 2.3, tc };
  const K = KINDS[spec.kind] || KINDS.house;
  c.doorX = K.doorX ?? 640; c.scale = K.scale ?? 2.3;
  buildSky(c); buildBG(c); buildGround(c);
  K.build(c);
  if (!c.door) c.door = { x: c.doorX, y: DOORY, w: 90, h: 170, type: 'hinge', style: 'panel', col: '#7a4a2a', int: 'dark' };
  groundDeco(c);
  gradeCanvas(scene, P);
  for (const fn of c.E) { g.save(); fn(g); g.restore(); }
  g.save(); g.fillStyle = rgrad(g, W / 2, H * 0.46, H * 0.36, H * 0.98, [[0, 'rgba(0,0,0,0)'], [1, `rgba(0,0,0,${P.key === 'night' ? 0.5 : P.key === 'dusk' ? 0.38 : 0.22})`]]); g.fillRect(0, 0, W, H); g.restore();
  c.doorArt = doorArt(c); c.doorInt = doorInterior(c); c.skyCv = skyC; c.bgCv = bgC; c.sceneCv = scene;
  return c;
}
function getScene(spec, n) {
  const key = [spec.kind, spec.ground, spec.time, spec.color || '', spec.sign || '', n | 0].join('|');
  let c = cache.get(key);
  if (!c) { c = build(spec, n | 0); cache.set(key, c); while (cache.size > KEEP) cache.delete(cache.keys().next().value); }
  return c;
}
export function prepareExterior(spec, n = 1) { getScene(spec, n); }

function groundDeco(c) {
  const g = c.g, gr = c.spec.ground, day = c.P.key === 'day';
  if (gr === 'pond') {
    waterRect(c, 150, 664, 430, 50, { ell: true }); g.strokeStyle = 'rgba(70,60,50,.6)'; g.lineWidth = 4; g.beginPath(); g.ellipse(365, 689, 215, 25, 0, 0, TAU); g.stroke();
    for (let i = 0; i < 40; i++) { const a = R() * TAU; g.fillStyle = sh('#8a8478', rnd(-0.2, 0.15)); g.beginPath(); g.ellipse(365 + Math.cos(a) * 218, 689 + Math.sin(a) * 27, rnd(4, 9), rnd(2.5, 5), 0, 0, TAU); g.fill(); }
    for (const [x, y, r] of [[300, 690, 14], [350, 700, 11], [430, 684, 13], [470, 696, 10], [250, 696, 9]]) lilyPad(g, x, y, r);
    g.fillStyle = '#f2a0c0'; for (const [x, y] of [[300, 688], [430, 682]]) { g.beginPath(); g.arc(x, y, 4, 0, TAU); g.fill(); }
    reeds(g, 160, 686, 8, 52); reeds(g, 575, 690, 7, 46);
    if (c.lit) c.E.push((e) => { e.save(); e.globalCompositeOperation = 'lighter'; for (let i = 0; i < 16; i++) { e.fillStyle = al('#cfe0ff', 0.28 * (1 - i / 18)); e.fillRect(365 - 30 + rnd(-8, 8) - i * 0.5, 670 + i * 2.2, 40 + i * 2, 1.6); } e.restore(); });
  }
  if (gr === 'path') {
    for (const [x, y, s] of [[110, 684, 1], [1180, 676, 1.2], [880, 705, 0.8], [260, 710, 0.9]]) { g.fillStyle = '#f1ead8'; g.fillRect(x - 3 * s, y - 10 * s, 6 * s, 11 * s); g.fillStyle = pick(['#d8362a', '#d8362a', '#b8802a']); g.beginPath(); g.ellipse(x, y - 10 * s, 11 * s, 7 * s, 0, Math.PI, 0); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(x - 3 * s, y - 13 * s, 1.5 * s, 0, TAU); g.arc(x + 4 * s, y - 12 * s, 1.2 * s, 0, TAU); g.fill(); }
    for (const x of [60, 1230, 520, 760]) { for (let i = 0; i < 7; i++) { g.strokeStyle = '#3a8a3a'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, 700); g.quadraticCurveTo(x + (i - 3) * 8, 676, x + (i - 3) * 14, 690 + Math.abs(i - 3) * 3); g.stroke(); } }
  }
  if (gr === 'beach') {
    tree(c, 90, 700, 270, { type: 'palm', lean: 40 }); tree(c, 1210, 692, 230, { type: 'palm', lean: -40 });
    // parasol
    g.fillStyle = '#6a4a2a'; g.fillRect(1000, 600, 4, 90); g.fillStyle = '#e84a4a'; g.beginPath(); g.moveTo(940, 604); g.quadraticCurveTo(1002, 540, 1064, 604); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(972, 580); g.quadraticCurveTo(1002, 556, 1032, 580); g.lineTo(1002, 604); g.fill();
    g.fillStyle = '#f4f0e0'; g.fillRect(940, 676, 70, 14); g.fillStyle = '#3a8ac8'; g.fillRect(950, 676, 12, 14); g.fillRect(974, 676, 12, 14);
  }
  if (gr === 'harbor') {
    for (const x of [60, 400, 880, 1230]) { g.fillStyle = grad(g, x - 8, 0, x + 8, 0, [[0, '#6a6a72'], [1, '#26262c']]); rr(g, x - 9, 590, 18, 22, 5); g.fill(); g.fillStyle = '#16161a'; g.fillRect(x - 12, 608, 24, 6); }
    g.strokeStyle = '#a08a5a'; g.lineWidth = 3; g.beginPath(); g.moveTo(60, 598); g.quadraticCurveTo(200, 640, 400, 598); g.stroke();
    barrel(g, 1130, 700, 36, 46, '#7a4a2a'); barrel(g, 1170, 706, 36, 46, '#6a3a1a'); crate(g, 100, 712, 60, 48, '#8a6a3a'); crate(g, 118, 668, 40, 34, '#9a7a46');
  }
  if (gr === 'jungle') {
    for (const [x, y, s, f] of [[0, 722, 1.6, 1], [1280, 722, 1.6, -1], [260, 724, 1, 1], [1060, 726, 1.1, -1]]) for (let i = 0; i < 7; i++) { g.fillStyle = sh(pick(['#2f7a34', '#3f9f44', '#226a2e']), rnd(-0.2, 0.1)); const a = -0.3 - i * 0.28; g.save(); g.translate(x, y); g.rotate(f * (a + (f < 0 ? 0.5 : 0))); g.scale(s, s); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(70, -30, 150 - i * 6, 4); g.quadraticCurveTo(70, 14, 0, 0); g.fill(); g.strokeStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(70, -10, 140 - i * 6, 4); g.stroke(); g.restore(); }
  }
  if (gr === 'grass') {
    for (const x of [90, 1190]) { g.strokeStyle = '#2a2420'; g.lineWidth = 4; g.beginPath(); g.moveTo(x, 600); g.lineTo(x, 692); g.stroke(); g.fillStyle = '#3a2a1a'; g.fillRect(x - 12, 590, 24, 14); fire(c, x, 590, 1.2, '#ff9a3a'); if (c.lit) c.E.push((e) => glowAt(e, x, 584, 150, '#ff9a3a', 0.4)); }
  }
  if (gr === 'canal') {
    tree(c, 70, 662, 300, { wide: 0.34 }); tree(c, 1215, 662, 280, { wide: 0.34 });
    bike(c, 1040, 664, 1.1, '#7a2a2a'); bike(c, 1100, 664, 1.1, '#2a4a7a', -1);
    g.fillStyle = '#1a1c20'; for (let x = 20; x < W; x += 80) g.fillRect(x, 654, 5, 12); g.fillRect(0, 654, W, 3);
  }
  if (gr === 'courtyard') {
    for (const x of [200, 1080]) { g.fillStyle = '#6a6862'; rr(g, x - 26, 650, 52, 40, 4); g.fill(); g.fillStyle = '#4a3a28'; g.fillRect(x - 24, 650, 48, 6); bush(c, x, 652, 50, 40, '#3f8a44'); }
  }
}

// ------------------------------------------------------------------ gebouwen: paddenstoelen (huisjes, gemeentehuis, bank)
function stem(c, tx, ty, bx, by, wt, wb, col = '#f1e8d4', o = {}) {
  const g = c.g, mxl = (tx + bx) / 2 - Math.max(wt, wb) / 2 - (o.bulge ?? 16), mxr = (tx + bx) / 2 + Math.max(wt, wb) / 2 + (o.bulge ?? 16), my = (ty + by) / 2;
  const path = () => { g.beginPath(); g.moveTo(tx - wt / 2, ty); g.quadraticCurveTo(mxl, my, bx - wb / 2 - 14, by); g.quadraticCurveTo(bx - wb / 2 - 4, by + 4, bx - wb / 2 + 2, by + 6); g.lineTo(bx + wb / 2 - 2, by + 6); g.quadraticCurveTo(bx + wb / 2 + 4, by + 4, bx + wb / 2 + 14, by); g.quadraticCurveTo(mxr, my, tx + wt / 2, ty); g.closePath(); };
  path(); g.fillStyle = grad(g, tx - wt / 2 - 20, 0, tx + wt / 2 + 20, 0, [[0, sh(col, 0.12)], [0.35, col], [1, sh(col, -0.42)]]); g.fill();
  g.save(); path(); g.clip();
  g.strokeStyle = 'rgba(120,90,50,.13)'; g.lineWidth = 1.4; for (let i = 0; i < 46; i++) { const k = R(), x1 = lerp(tx - wt / 2, tx + wt / 2, k), x2 = lerp(bx - wb / 2, bx + wb / 2, k); g.beginPath(); g.moveTo(x1, ty); g.bezierCurveTo(x1 + rnd(-5, 5), lerp(ty, by, 0.35), x2 + rnd(-5, 5), lerp(ty, by, 0.7), x2, by); g.stroke(); }
  speckle(g, Math.min(tx, bx) - 200, ty, 400 + Math.abs(tx - bx), by - ty + 10, 1100, ['#8a6a3a', '#ffffff', '#c8a878'], 0.22, 2);
  g.fillStyle = grad(g, 0, ty, 0, ty + 70, [[0, 'rgba(40,20,10,.65)'], [1, 'rgba(40,20,10,0)']]); g.fillRect(Math.min(tx, bx) - 200, ty, 400 + Math.abs(tx - bx), 70);
  g.fillStyle = grad(g, 0, by - 40, 0, by + 6, [[0, 'rgba(30,50,20,0)'], [1, 'rgba(30,50,20,.45)']]); g.fillRect(Math.min(tx, bx) - 200, by - 40, 400 + Math.abs(tx - bx), 50);
  g.restore();
}
function cap(c, cx, cy, rx, ry, col, o = {}) {
  const g = c.g, spots = o.spots ?? 9, sc = o.spot || '#fbf8ee';
  g.save(); g.translate(cx, cy); if (o.rot) g.rotate(o.rot);
  ellShadow(g, 0, 8, rx * 0.95, 16, 0.4); // schaduw onder de rand
  // buik van de hoed (onderrand met plooien)
  g.fillStyle = grad(g, 0, -4, 0, ry * 0.22, [[0, sh(col, -0.45)], [1, sh(col, -0.7)]]); g.beginPath(); g.moveTo(-rx, 0); g.quadraticCurveTo(0, ry * 0.45, rx, 0); g.quadraticCurveTo(0, ry * 0.18, -rx, 0); g.fill();
  const dome = () => { g.beginPath(); g.moveTo(-rx, 2); g.bezierCurveTo(-rx * 1.02, -ry * 0.8, -rx * 0.55, -ry * 1.02, 0, -ry); g.bezierCurveTo(rx * 0.55, -ry * 1.02, rx * 1.02, -ry * 0.8, rx, 2); g.quadraticCurveTo(0, ry * 0.3, -rx, 2); g.closePath(); };
  dome(); g.fillStyle = rgrad(g, -rx * 0.32, -ry * 0.62, ry * 0.05, rx * 1.1, [[0, sh(col, 0.4)], [0.35, sh(col, 0.08)], [0.7, col], [1, sh(col, -0.5)]]); g.fill();
  g.save(); dome(); g.clip();
  speckle(g, -rx, -ry, rx * 2, ry * 1.4, rx * 5, ['#000000', '#ffffff', sh(col, -0.3)], 0.12, 2);
  const r2 = rng(hash(col) + (o.seed ?? 0));
  for (let i = 0; i < spots; i++) {
    const u = (r2() * 2 - 1) * 0.86, v = 0.12 + r2() * 0.74, sx = u * rx * 0.97, sy = -v * ry * Math.sqrt(Math.max(0.05, 1 - u * u * 0.8)) + ry * 0.04, rad = (0.05 + r2() * 0.07) * rx, sq = 1 - Math.abs(u) * 0.55;
    g.save(); g.translate(sx, sy); g.rotate(u * 0.5); g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(rad * 0.15, rad * 0.22, rad * sq, rad * 0.78, 0, 0, TAU); g.fill();
    g.fillStyle = rgrad(g, -rad * 0.3, -rad * 0.3, 1, rad * 1.1, [[0, '#ffffff'], [1, sh(sc, -0.12)]]); g.beginPath(); g.ellipse(0, 0, rad * sq, rad * 0.78, 0, 0, TAU); g.fill(); g.restore();
  }
  g.fillStyle = grad(g, 0, -ry, 0, ry * 0.3, [[0, 'rgba(255,255,255,.24)'], [0.45, 'rgba(255,255,255,0)'], [0.85, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.4)']]); g.fillRect(-rx, -ry, rx * 2, ry * 1.4);
  g.restore();
  g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = Math.max(2, rx * 0.012); g.beginPath(); g.moveTo(-rx * 0.8, -ry * 0.62); g.bezierCurveTo(-rx * 0.62, -ry * 0.92, -rx * 0.28, -ry * 1.0, -rx * 0.08, -ry * 0.995); g.stroke();
  g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 2.5; dome(); g.stroke();
  g.fillStyle = al(sh(col, 0.5), 0.35); g.beginPath(); g.moveTo(-rx * 0.98, 4); g.quadraticCurveTo(0, ry * 0.3 + 3, rx * 0.98, 4); g.lineTo(rx * 0.98, 1); g.quadraticCurveTo(0, ry * 0.3 - 1, -rx * 0.98, 1); g.fill();
  g.restore();
}
function chimney(c, x, y, w, h) {
  const g = c.g; bricks(g, x, y, w, h, { base: '#8a4a34', bw: 12, bh: 6, v: 0.15 }); wallAO(g, x, y, w, h, { top: 0.1, bot: 0.3, side: 0.35 });
  g.fillStyle = '#4a3a34'; g.fillRect(x - 3, y - 5, w + 6, 6); g.fillStyle = 'rgba(0,0,0,.8)'; g.fillRect(x + 2, y - 4, w - 4, 3);
}
function roundWin(c, x, y, r, o = {}) {
  const g = c.g, fr = o.frame || '#8a5a30';
  if (o.shut) for (const s of [-1, 1]) { g.fillStyle = o.shut; g.beginPath(); g.ellipse(x + s * (r + 12), y, 11, r * 1.04, 0, 0, TAU); g.fill(); g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1.5; g.stroke(); g.fillStyle = 'rgba(0,0,0,.2)'; for (let k = -2; k <= 2; k++) g.fillRect(x + s * (r + 12) - 7, y + k * 8 - 1, 14, 2); }
  g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(x, y + 2, r + 5, 0, TAU); g.fill();
  g.fillStyle = grad(g, x - r, y - r, x + r, y + r, [[0, sh(fr, 0.2)], [1, sh(fr, -0.35)]]); g.beginPath(); g.arc(x, y, r + 4, 0, TAU); g.fill();
  g.fillStyle = grad(g, 0, y - r, 0, y + r, c.P.key === 'day' ? [[0, '#86abc9'], [1, '#2c425a']] : [[0, '#1b2a44'], [1, '#0a111d']]); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.arc(x, y, r, Math.PI * 1.1, Math.PI * 1.75); g.lineTo(x, y); g.fill();
  g.strokeStyle = fr; g.lineWidth = 3; g.beginPath(); g.moveTo(x - r, y); g.lineTo(x + r, y); g.moveTo(x, y - r); g.lineTo(x, y + r); g.stroke();
  g.fillStyle = sh(fr, 0.1); rr(g, x - r - 6, y + r + 3, r * 2 + 12, 6, 2); g.fill();
  if (o.pot) { g.fillStyle = '#b8643a'; g.beginPath(); g.moveTo(x - 9, y + r + 12); g.lineTo(x + 9, y + r + 12); g.lineTo(x + 6, y + r + 24); g.lineTo(x - 6, y + r + 24); g.fill(); for (let i = 0; i < 5; i++) { g.fillStyle = pick(['#e84a4a', '#f5c42a', '#e86aa8']); g.beginPath(); g.arc(x - 10 + i * 5, y + r + 8 + (i % 2) * 3, 3.4, 0, TAU); g.fill(); } }
  if (c.P.lights && (o.lit ?? true)) c.E.push((e) => { e.save(); e.beginPath(); e.arc(x, y, r, 0, TAU); e.clip(); e.fillStyle = grad(e, 0, y - r, 0, y + r, [[0, '#fff0c0'], [0.5, '#ffd078'], [1, '#c8802a']]); e.fillRect(x - r, y - r, r * 2, r * 2); e.strokeStyle = fr; e.lineWidth = 3; e.beginPath(); e.moveTo(x - r, y); e.lineTo(x + r, y); e.moveTo(x, y - r); e.lineTo(x, y + r); e.stroke(); e.restore(); glowAt(e, x, y, r * 3.6, '#ffc060', 0.34); });
}
function stoneStep(c, x, w, y = B, n = 2) { const g = c.g; for (let i = 0; i < n; i++) { const yy = y + 4 + i * 8, ww = w + (n - i) * 8; g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x - ww / 2 + 2, yy + 5, ww, 4); g.fillStyle = grad(g, 0, yy, 0, yy + 9, [[0, '#cfc9ba'], [1, '#8f897c']]); g.fillRect(x - ww / 2, yy, ww, 9); g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(x - ww / 2, yy, ww, 1.5); } }
function mushDoorFrame(c, x, w, h, col = '#7a4a24') { const g = c.g, y0 = B - h; g.fillStyle = 'rgba(0,0,0,.5)'; g.beginPath(); g.moveTo(x - w / 2 - 8, B); g.lineTo(x - w / 2 - 8, y0 + w / 2); g.arc(x, y0 + w / 2, w / 2 + 8, Math.PI, 0); g.lineTo(x + w / 2 + 8, B); g.fill(); g.strokeStyle = sh(col, 0.15); g.lineWidth = 6; g.beginPath(); g.moveTo(x - w / 2 - 3, B); g.lineTo(x - w / 2 - 3, y0 + w / 2); g.arc(x, y0 + w / 2, w / 2 + 3, Math.PI, 0); g.lineTo(x + w / 2 + 3, B); g.stroke(); }

KINDS.mushroom = {
  doorX: 640, scale: 1.7,
  build(c) {
    const g = c.g, n = c.n, col = c.spec.color || '#d8362a', variant = n === 2 ? 2 : n === 3 ? 3 : 1;
    if (variant === 1) {
      tree(c, 130, 600, 250, { wide: 0.36 }); tree(c, 1180, 600, 210, { wide: 0.34, fruit: '#e84a4a' });
      stem(c, 640, 372, 640, B, 240, 292, '#f1e8d4');
      mushDoorFrame(c, 640, 110, 150);
      roundWin(c, 548, 450, 23, { shut: '#4a8a3a', pot: true }); roundWin(c, 732, 450, 23, { shut: '#4a8a3a', pot: true });
      // slakkenhuisje-bord, lantaarn en brievenbus
      lantern(c, 566, 405, 9, '#ffb84a', { glow: 4 }); g.strokeStyle = '#3a2a1c'; g.lineWidth = 2; g.beginPath(); g.moveTo(566, 395); g.lineTo(566, 380); g.stroke();
      g.fillStyle = '#6a4a2a'; g.fillRect(748, 520, 4, 76); g.fillStyle = '#d8362a'; rr(g, 736, 500, 28, 22, 8); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(744, 508, 2.4, 0, TAU); g.arc(756, 512, 2, 0, TAU); g.fill();
      stoneStep(c, 640, 120, B, 2);
      cap(c, 640, 372, 320, 218, col, { spots: 11 });
      chimney(c, 806, 168, 34, 70); smoke(c, 823, 160, { n: 10, rise: 170, drift: 50, size: 11 });
      cap(c, 236, 598, 56, 38, '#e8c84a', { spots: 4, spot: '#fff' }); stem(c, 236, 600, 236, B, 20, 24, '#efe6d0');
      // paddestoeltjes en bloemen in het gras
      for (const [x, y, s, cc] of [[400, 618, 1.1, '#d8362a'], [440, 626, 0.7, '#e8c84a'], [900, 622, 1, '#d8362a'], [1000, 632, 0.8, '#c85a2a']]) { g.fillStyle = '#efe6d0'; g.fillRect(x - 3 * s, y - 14 * s, 6 * s, 14 * s); cap(c, x, y - 12 * s, 14 * s, 11 * s, cc, { spots: 3, spot: '#fff' }); }
      flowers(c, 0, 700, 360, 70, ['#ffffff', '#ffe34a', '#ff8ac0']); flowers(c, 920, 700, 360, 70, ['#ffffff', '#ffe34a', '#a0a0ff']);
      c.door = { x: 640, y: B, w: 110, h: 150, type: 'hinge', style: 'round', round: true, col: '#7a4a24', int: 'warm' };
    } else if (variant === 2) {
      tree(c, 90, 600, 230, { type: 'pine', col: '#2a6a4a' }); tree(c, 1200, 600, 260, { type: 'pine', col: '#2a6a4a' });
      stem(c, 640, 262, 640, B, 180, 250, '#e8eef2', { bulge: 10 });
      mushDoorFrame(c, 640, 110, 150, '#3a4a6a');
      // omlopende balkonring met leuning
      g.fillStyle = '#6a4a2a'; g.beginPath(); g.ellipse(640, 392, 150, 20, 0, 0, TAU); g.fill(); g.fillStyle = '#8a6a3a'; g.beginPath(); g.ellipse(640, 388, 150, 18, 0, 0, TAU); g.fill();
      g.strokeStyle = '#3a2a1a'; g.lineWidth = 2; for (let a = 0; a < 24; a++) { const ax = 640 + Math.cos(a / 24 * TAU) * 146, ay = 388 + Math.sin(a / 24 * TAU) * 16; if (Math.sin(a / 24 * TAU) > -0.2) { g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax, ay - 20); g.stroke(); } }
      g.strokeStyle = '#3a2a1a'; g.lineWidth = 3; g.beginPath(); g.ellipse(640, 368, 146, 16, 0, 0, Math.PI); g.stroke();
      roundWin(c, 640, 320, 24, { frame: '#3a4a6a', lit: true }); roundWin(c, 640, 454, 22, { frame: '#3a4a6a', shut: '#d8362a' });
      // trap om de steel
      g.strokeStyle = '#6a4a2a'; g.lineWidth = 5; g.beginPath(); g.moveTo(560, 590); for (let i = 0; i < 6; i++) { g.lineTo(540 + (i % 2) * 20, 570 - i * 20); g.lineTo(536 + ((i + 1) % 2) * 22, 560 - i * 20 - 4); } g.stroke();
      stoneStep(c, 640, 110, B, 2);
      cap(c, 640, 258, 270, 178, col, { spots: 9, spot: '#f8f0ff' });
      cap(c, 640, 150, 86, 56, sh(col, 0.15), { spots: 3, spot: '#fff', seed: 4 });
      cap(c, 640, 470, 100, 34, sh(col, -0.1), { spots: 3, spot: '#fff', seed: 6 });
      chimney(c, 790, 118, 28, 60); smoke(c, 804, 110, { n: 10, rise: 150, drift: 40, size: 10 });
      flowers(c, 0, 700, 140, 60, ['#ffffff', '#a0c8ff']); flowers(c, 700, 700, 580, 60, ['#ffffff', '#ffe34a']);
      c.door = { x: 640, y: B, w: 110, h: 150, type: 'hinge', style: 'round', round: true, col: '#3a5a8a', int: 'warm' };
    } else {
      tree(c, 1230, 600, 220, { type: 'dead' }); tree(c, 40, 600, 200, { type: 'pine', col: '#3a5a34' });
      // linkerhuisje
      stem(c, 280, 470, 270, B, 80, 100, '#efe0c0', { bulge: 6 }); roundWin(c, 280, 540, 14, { frame: '#6a4a2a' });
      cap(c, 270, 470, 130, 92, '#c8502a', { spots: 6, rot: -0.12, seed: 3 });
      // rechterhuisje
      stem(c, 1010, 480, 1020, B, 90, 110, '#efe0c0'); roundWin(c, 1016, 540, 16, { frame: '#6a4a2a' });
      cap(c, 1020, 480, 150, 104, '#6a8a3a', { spots: 6, rot: 0.1, seed: 9, spot: '#f4ffd8' });
      // hoofdhuis: scheve steel, scheve hoed, mini-hoedje bovenop
      stem(c, 600, 380, 650, B, 210, 260, '#f1e4c8', { bulge: 22 });
      mushDoorFrame(c, 650, 100, 140, '#6a4a24');
      g.save(); g.translate(565, 470); g.rotate(-0.12); roundWin(c, 0, 0, 22, { frame: '#6a4a2a', shut: '#8a5a2a' }); g.restore();
      g.save(); g.translate(735, 440); g.rotate(0.1); roundWin(c, 0, 0, 19, { frame: '#6a4a2a', shut: '#8a5a2a' }); g.restore();
      stoneStep(c, 650, 110, B, 2);
      cap(c, 560, 380, 292, 202, col, { spots: 10, rot: -0.14, seed: 1 });
      cap(c, 590, 140, 96, 62, '#d8722a', { spots: 4, rot: -0.3, seed: 2 }); stem(c, 596, 150, 606, 168, 34, 44, '#efe0c0');
      chimney(c, 795, 240, 30, 60); g.save(); g.translate(0, 0); smoke(c, 810, 232, { n: 9, rise: 150, drift: 60, size: 10 }); g.restore();
      for (const [x, y, s, cc] of [[420, 628, 1.4, '#c8502a'], [860, 626, 1.2, '#8a5aa8'], [940, 640, 0.8, '#e8c84a'], [130, 640, 1, '#b8802a']]) { g.fillStyle = '#efe6d0'; g.save(); g.translate(x, y); g.rotate(0.15); g.fillRect(-3 * s, -14 * s, 6 * s, 14 * s); g.restore(); cap(c, x + 2, y - 12 * s, 14 * s, 11 * s, cc, { spots: 3, spot: '#fff', rot: 0.2 }); }
      lantern(c, 585, 462, 9, '#ffb84a', { glow: 4 });
      c.door = { x: 650, y: B, w: 100, h: 140, type: 'hinge', style: 'round', round: true, col: '#7a4a24', int: 'warm', rot: -0.045 };
    }
    contactShadow(g, 0, B, 0, 0);
  },
};

KINDS.townhall = {
  doorX: 640, scale: 2.2,
  build(c) {
    const g = c.g;
    // vleugels: kleinere paddenstoelen
    stem(c, 240, 470, 240, B, 150, 190, '#efe2c6'); win(c, 215, 500, 36, 56, { frame: '#6a4a2a', arch: true, p: 0.9, cols: 1, rows: 2 }); cap(c, 240, 470, 190, 130, '#d87a2a', { spots: 7, seed: 3 });
    stem(c, 1040, 470, 1040, B, 150, 190, '#efe2c6'); win(c, 1015, 500, 36, 56, { frame: '#6a4a2a', arch: true, p: 0.9, cols: 1, rows: 2 }); cap(c, 1040, 470, 190, 130, '#b8302a', { spots: 7, seed: 5 });
    // hoofdstam: steen onderin, bepleisterd erboven
    stem(c, 640, 340, 640, B, 380, 440, '#efe4cc', { bulge: 8 });
    g.save(); g.beginPath(); g.rect(440, B - 44, 400, 50); g.clip(); stoneBlocks(g, 420, B - 44, 440, 48, { base: '#9a9488', bh: 16 }); g.restore();
    for (let i = 0; i < 5; i++) win(c, 508 + i * 66 - (i > 2 ? -0 : 0) + (i >= 3 ? 100 : 0) - (i < 2 ? 0 : 0), 400, 34, 62, { frame: '#6a4a2a', arch: true, p: 0.85, shut: i % 2 ? '#8a4a2a' : '#2a6a4a' });
    // tweede rij ramen
    for (const x of [470, 560, 720, 810]) win(c, x - 15, 478, 30, 52, { frame: '#6a4a2a', arch: true, p: 0.7, cols: 1, rows: 2 });
    // klokkentoren op de hoed
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(612, 150, 70, 60);
    bricks(g, 600, 70, 80, 140, { base: '#9a5a44', bw: 14, bh: 7, v: 0.12 }); wallAO(g, 600, 70, 80, 140, { top: 0.1, bot: 0.1, side: 0.35 });
    g.fillStyle = '#e8e0d0'; g.beginPath(); g.arc(640, 112, 29, 0, TAU); g.fill(); g.strokeStyle = '#4a3a2a'; g.lineWidth = 4; g.stroke();
    g.fillStyle = '#20242a'; for (let i = 0; i < 12; i++) { const a = i * TAU / 12; g.fillRect(640 + Math.cos(a) * 22 - 1.2, 112 + Math.sin(a) * 22 - 1.2, 2.4, 2.4); }
    g.strokeStyle = '#20242a'; g.lineWidth = 3; g.beginPath(); g.moveTo(640, 112); g.lineTo(640, 92); g.moveTo(640, 112); g.lineTo(654, 118); g.stroke();
    win(c, 622, 160, 36, 26, { frame: '#6a4a2a', arch: true, p: 1 });
    cap(c, 640, 70, 72, 54, '#b8302a', { spots: 4, seed: 7 }); g.fillStyle = '#c8a030'; g.fillRect(639, 6, 3, 20); flag(c, 641, 22, 22, '#ffd02a', { w: 34, h: 20, col2: '#e84a2a' });
    cap(c, 640, 342, 400, 210, '#c8402a', { spots: 13, seed: 11 });
    // bord met GEMEENTEHUIS
    g.strokeStyle = '#3a2a1a'; g.lineWidth = 2; g.beginPath(); g.moveTo(540, 342); g.lineTo(540, 372); g.moveTo(740, 342); g.lineTo(740, 372); g.stroke();
    sign(c, 520, 366, 240, 36, c.spec.sign || 'GEMEENTEHUIS', { bg: '#6a4a2a', fg: '#ffe8a8', size: 22, lit: true, lightText: true, r: 5 });
    mushDoorFrame(c, 640, 130, 188, '#5a3a1a'); stoneStep(c, 640, 150, B, 3);
    for (const x of [532, 748]) { g.fillStyle = grad(g, x - 7, 0, x + 7, 0, [[0, '#d8d0c0'], [1, '#8a8478']]); g.fillRect(x - 7, 420, 14, 176); g.fillStyle = '#c8c0ae'; g.fillRect(x - 10, 412, 20, 8); g.fillRect(x - 10, 590, 20, 8); }
    lampPost(c, 420, 620, 170, { arm: 14, col: '#ffd890' }); lampPost(c, 860, 620, 170, { arm: -14, col: '#ffd890' });
    flag(c, 100, 618, 220, '#d8362a', { stripe: '#fff' }); flag(c, 1180, 618, 220, '#2a5aa8', { stripe: '#fff' });
    bench(g, 160, 660, 80); bench(g, 1040, 660, 80);
    tree(c, 60, 640, 150, { wide: 0.3 });
    c.door = { x: 640, y: B, w: 130, h: 188, type: 'double', style: 'wood', round: true, col: '#6a4020', int: 'warm' };
  },
};

KINDS.mushroombank = {
  doorX: 640, scale: 2.3,
  build(c) {
    const g = c.g, day = c.P.key === 'day';
    // zijvleugels met vaste ramen
    for (const [x0, x1] of [[110, 400], [880, 1170]]) { stoneBlocks(g, x0, 300, x1 - x0, B - 300, { base: '#a8a094', bh: 26 }); wallAO(g, x0, 300, x1 - x0, B - 300, { top: 0.35 }); for (let i = 0; i < 3; i++) win(c, x0 + 40 + i * 80, 380, 40, 90, { frame: '#cfc8b8', arch: true, p: 0.55, cols: 2, rows: 3 }); g.fillStyle = '#7a7468'; g.fillRect(x0 - 6, 290, x1 - x0 + 12, 14); g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(x0 - 6, 290, x1 - x0 + 12, 2); }
    // hoofdgebouw
    stoneBlocks(g, 400, 250, 480, B - 250, { base: '#b6ae9e', bh: 28 }); wallAO(g, 400, 250, 480, B - 250, { top: 0.3 });
    // fries + zuilen
    g.fillStyle = '#9a9282'; g.fillRect(380, 238, 520, 22); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(380, 238, 520, 2);
    for (let i = 0; i < 6; i++) { const x = 440 + i * 80; g.fillStyle = grad(g, x - 14, 0, x + 14, 0, [[0, '#f4efe4'], [0.45, '#d8d2c2'], [1, '#8a8474']]); g.fillRect(x - 14, 262, 28, B - 276); g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 1.2; for (let k = -8; k <= 8; k += 5) { g.beginPath(); g.moveTo(x + k, 264); g.lineTo(x + k, B - 16); g.stroke(); } g.fillStyle = '#ddd7c8'; g.fillRect(x - 19, 258, 38, 10); g.fillRect(x - 19, B - 20, 38, 10); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x + 14, 270, 8, B - 290); }
    // donkere ruimte tussen zuilen
    for (let i = 0; i < 5; i++) { const x = 454 + i * 80; if (i !== 2) win(c, x + 2, 330, 52, 130, { frame: '#bdb6a6', arch: true, p: 0.75, cols: 2, rows: 4, lit: undefined }); }
    // mushroom-hoed als fronton
    cap(c, 640, 242, 320, 150, '#b8302a', { spots: 12, seed: 8 });
    // gouden munt met dollarteken in het fronton
    const mx = 640, my = 160; g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(mx + 3, my + 4, 46, 0, TAU); g.fill();
    g.fillStyle = grad(g, mx - 46, my - 46, mx + 46, my + 46, [[0, '#fff0a0'], [0.5, '#e8b83a'], [1, '#9a6a18']]); g.beginPath(); g.arc(mx, my, 46, 0, TAU); g.fill(); g.strokeStyle = '#7a5410'; g.lineWidth = 3; g.stroke(); g.beginPath(); g.arc(mx, my, 37, 0, TAU); g.stroke();
    txt(g, '$', mx, my + 3, 56, '#7a5410', { shadow: 'rgba(255,255,200,.7)', blur: 1, sy: 1 });
    emit(c, (e) => { glowAt(e, mx, my, 120, '#ffd860', 0.25); });
    // bord PADDENSTOELENBANK
    sign(c, 470, 262, 340, 34, c.spec.sign || 'PADDENSTOELENBANK', { bg: '#1f3a2a', fg: '#f4d878', rim: '#c8a030', size: 22, lit: true, lightText: true, r: 4 });
    // trappen
    for (let i = 0; i < 4; i++) { g.fillStyle = grad(g, 0, B - 10 + i * 8, 0, B - 2 + i * 8, [[0, '#d8d2c2'], [1, '#8a8474']]); g.fillRect(400 - i * 14, B - 6 + i * 8, 480 + i * 28, 9); g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(400 - i * 14, B - 6 + i * 8, 480 + i * 28, 1.5); }
    // deuropening (brons) tussen middelste zuilen
    g.fillStyle = '#20180e'; g.fillRect(588, B - 200, 104, 200); g.strokeStyle = '#c8a030'; g.lineWidth = 5; g.strokeRect(586, B - 202, 108, 202);
    for (const x of [420, 860]) lampPost(c, x, 640, 190, { arm: x < 640 ? 16 : -16, col: '#ffe0a0' });
    for (const x of [280, 1000]) { g.fillStyle = '#6a4a2a'; g.fillRect(x - 3, 600, 6, 60); }
    bush(c, 160, 652, 90, 40, '#2f7a3a'); bush(c, 1120, 652, 90, 40, '#2f7a3a');
    for (let x = 60; x < 1280; x += 220) if (x < 300 || x > 980) bollard(g, x, 660);
    c.door = { x: 640, y: B, w: 100, h: 198, type: 'double', style: 'red', col: '#8a5a1a', int: 'warm' };
  },
};

// ------------------------------------------------------------------ publieke functie 1: de buitenscene
const FALLBACK = { kind: 'house', ground: 'street', time: 'night' };
let lastFrameMs = 0;
export function drawExterior(g, spec, t = 0, o = {}) {
  spec = spec && KINDS[spec.kind] ? spec : { ...FALLBACK, ...(spec || {}) };
  const c = getScene(spec, o.n || 1), cam = clamp(o.cam || 0, -1, 1), d = c.door;
  g.drawImage(c.skyCv, -40 - cam * 5, 0);
  for (const s of c.twinkle) { const a = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.7 + s.ph)); g.fillStyle = `rgba(255,255,255,${a * 0.8})`; g.fillRect(s.x - cam * 5 - 1, s.y - 1, 2.2, 2.2); g.fillStyle = `rgba(200,220,255,${a * 0.35})`; g.fillRect(s.x - cam * 5 - 4, s.y - 0.4, 8, 0.9); g.fillRect(s.x - cam * 5 - 0.4, s.y - 4, 0.9, 8); }
  for (const cl of c.clouds) { const x = ((cl.x + t * cl.sp) % (W + 700)) - 350 - cam * 9; g.globalAlpha = cl.a; g.drawImage(cl.img, x, cl.y, 380 * cl.s, 150 * cl.s); }
  g.globalAlpha = 1;
  g.drawImage(c.bgCv, -40 - cam * 14, 0);
  g.drawImage(c.sceneCv, 0, 0);
  for (const fn of c.D) { g.save(); fn(g, t); g.restore(); }
  drawDoor(g, c, o, t);
  return { doorX: d.x, doorY: d.y, groundY: LANE, scale: c.scale, door: { x: d.x, y: d.y, w: d.w, h: d.h, type: d.type, round: !!d.round }, kind: spec.kind };
}

// ------------------------------------------------------------------ publieke functie 2: de intro
const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
const seg = (T, a, b) => clamp((T - a) / (b - a), 0, 1);
export function playIntro(canvas, spec, n, onDone, opts = {}) {
  const g = canvas.getContext('2d'), meta = levelMeta(n) || { name: '', sub: '' };
  spec = spec || meta.ext || FALLBACK;
  const speed = opts.fast ? 2 : 1;
  const sfx = (nm) => { try { if (opts.sfx) opts.sfx(nm); } catch (e) { /* geluid mag nooit de intro breken */ } };
  const tmp = newCanvas(420, 420), tg = tmp.getContext('2d');
  const info0 = drawExterior(g, spec, 0, { n, doorOpen: 0 });
  const door = info0.door, s0 = info0.scale, gy = info0.groundY, doorY = info0.doorY;
  const dir = door.x > 520 ? 1 : -1;
  const startX = dir > 0 ? -90 : W + 90, restX = clamp(door.x - dir * 300, 220, 1060), standX = door.x - dir * (door.w / 2 + 44 * s0 / 2.3);
  const slide = door.type === 'slide';
  let done = false, raf = 0, last = 0, T = 0, rt = 0, walk = 0;
  const fired = {};
  const once = (k, fn) => { if (!fired[k]) { fired[k] = 1; fn(); } };
  let lastStep = 0;
  const finish = () => {
    if (done) return; done = true; cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKey); canvas.removeEventListener('pointerdown', onPtr);
    try { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); } catch (e) { /* */ }
    onDone && onDone();
  };
  function onKey(e) { if (e.repeat) return; if (e.code === 'Space' || e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); finish(); } }
  function onPtr(e) { e.preventDefault(); finish(); }
  window.addEventListener('keydown', onKey); canvas.addEventListener('pointerdown', onPtr);

  const shadowCol = { day: null, dusk: 'rgba(120,50,70,0.22)', night: 'rgba(24,40,96,0.3)' }[(PAL[spec.time] || PAL.night).key];
  function drawChar(o, clipRect, dark) {
    tg.clearRect(0, 0, 420, 420);
    tg.save(); tg.translate(210 - o.x, 330 - o.y); drawTeUn(tg, o); tg.restore();
    if (shadowCol) { tg.globalCompositeOperation = 'source-atop'; tg.fillStyle = shadowCol; tg.fillRect(0, 0, 420, 420); tg.globalCompositeOperation = 'source-over'; }
    if (dark) { tg.globalCompositeOperation = 'source-atop'; tg.fillStyle = `rgba(0,0,0,${dark})`; tg.fillRect(0, 0, 420, 420); tg.globalCompositeOperation = 'source-over'; }
    g.save();
    if (clipRect) { g.beginPath(); g.rect(clipRect.x, clipRect.y, clipRect.w, clipRect.h); g.clip(); }
    g.drawImage(tmp, o.x - 210, o.y - 330); g.restore();
  }
  function frame(now) {
    if (done) return;
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now; rt += dt; T += dt * speed;
    // toestand uit de tijdlijn (T in seconden, normale snelheid)
    const dirF = dir;
    let x, y = gy, face = dir, pose = 'stand', outfit = 'classic', mask = 0, gloves = 0, rolled = false, s = s0, alpha = 1, op = 0, hat = null, dark = 0, clip = null;
    const wk = seg(T, 0.2, 2.1);
    if (T < 2.1) { x = lerp(startX, restX, wk); pose = 'walk'; walk += dt * speed * 9; }
    else if (T < 2.9) { x = restX; const k = T - 2.1; face = k < 0.3 ? dir : k < 0.6 ? -dir : dir; pose = 'stand'; }
    else { x = restX; }
    if (T >= 2.9) outfit = T >= 3.05 ? 'black' : 'classic';
    if (T >= 3.1 && T < 3.65) hat = seg(T, 3.1, 3.65);
    if (T >= 3.6) { pose = 'pullmask'; mask = T < 4.05 ? 0 : ease(seg(T, 4.05, 4.25)); rolled = T >= 3.75 && T < 4.1; }
    if (T >= 4.4) { pose = 'door'; mask = 1; gloves = ease(seg(T, 4.6, 5.0)); }
    if (T >= 5.1 && T < 6.4) { pose = 'sneak'; const k = ease(seg(T, 5.1, 6.4)); x = lerp(restX, standX, k); y = lerp(gy, doorY + 10, k); walk += dt * speed * 6.5; }
    if (T >= 6.4) { x = standX; y = doorY + 10; pose = 'door'; }
    if (T >= 7.3) { const k = ease(seg(T, 7.3, 7.75)); x = lerp(standX, door.x, k); pose = 'sneak'; walk += dt * speed * 6; }
    let enter = 0;
    if (T >= 7.75) { enter = ease(seg(T, 7.75, 8.2)); x = door.x; y = lerp(doorY + 10, doorY - 6, enter); s = s0 * lerp(1, 0.78, enter); pose = 'sneak'; walk += dt * speed * 5; alpha = 1 - enter * 0.35; dark = enter * 0.8; clip = { x: door.x - door.w / 2 - 2, y: doorY - door.h - 4, w: door.w + 4, h: door.h + 8 }; }
    if (outfit === 'black' && mask === 0 && !rolled && T < 3.6) pose = 'stand';
    // geluiden
    if (pose === 'walk' || pose === 'sneak') { const st = Math.floor(walk / Math.PI); if (st !== lastStep) { lastStep = st; sfx('step'); } }
    if (T >= 3.0) once('puff', () => sfx('puff'));
    if (T >= 4.15) once('zip1', () => sfx('zip'));
    if (T >= 4.7) once('zip2', () => sfx('zip'));
    const openStart = slide ? 6.1 : 6.4, openEnd = slide ? 6.9 : 7.5;
    if (T >= openStart) once('creak', () => sfx(slide ? 'zip' : 'creak'));
    const doorOpen = ease(seg(T, openStart, openEnd));
    const cam = clamp((x - 640) / 640, -1, 1) * 0.6;
    drawExterior(g, spec, rt, { n, doorOpen, cam });
    // schaduw onder Te-Un
    const sc = enter > 0 ? 1 - enter : 1; if (sc > 0.01) ellShadow(g, x, y + 2, 34 * s / 2.3 * 1.1, 9 * s / 2.3, 0.4 * sc);
    drawChar({ x, y, s, face, walk, t: rt, outfit, mask, gloves, sack: true, pose, alpha, rolled }, clip, dark);
    // praatwolkje bij het rondkijken
    if (T > 2.2 && T < 2.95) { const a = Math.min(1, (T - 2.2) * 5, (2.95 - T) * 5), bx = x + 26, by = y - 92 * s / 2.3 * 1.0 - 30; g.save(); g.globalAlpha = a; g.fillStyle = 'rgba(255,255,255,.95)'; rr(g, bx, by - 30, 188, 36, 14); g.fill(); g.beginPath(); g.moveTo(bx + 18, by + 5); g.lineTo(bx + 8, by + 18); g.lineTo(bx + 34, by + 5); g.fill(); txt(g, 'Niemand te zien...', bx + 94, by - 11, 19, '#20242c', { weight: 600 }); g.restore(); }
    // poef: rookwolkje
    if (T > 2.95 && T < 3.8) { const k = (T - 2.95) / 0.85, cx = x, cy = y - 46 * s / 2.3 * 1.3; g.save(); for (let i = 0; i < 11; i++) { const a = (i / 11) * TAU + 0.3, r0 = (18 + k * 52) * s / 2.3, px = cx + Math.cos(a) * r0 * 0.9, py = cy + Math.sin(a) * r0 * 0.9 * 0.9, rad = (20 + 26 * Math.sin(k * 3) + 24 * k) * s / 2.3; g.fillStyle = `rgba(${230 - i * 6},${230 - i * 6},${236 - i * 4},${(1 - k) * 0.95 * (k < 0.15 ? k / 0.15 : 1)})`; g.beginPath(); g.arc(px, py, Math.max(2, rad), 0, TAU); g.fill(); } for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + k, d = 30 + k * 90; g.fillStyle = `rgba(255,${200 + i * 5},120,${(1 - k) * 0.9})`; g.beginPath(); g.arc(cx + Math.cos(a) * d * s / 2.3, cy + Math.sin(a) * d * s / 2.3, 4 * (1 - k) + 1, 0, TAU); g.fill(); } g.restore(); }
    // rode muts die in de zak vliegt
    if (hat !== null) { const k = hat, hx0 = x + 0, hy0 = y - 78 * s / 2.3 * 1.2 * 0.9, hx1 = x - dir * 20 * s / 2.3, hy1 = y - 28 * s / 2.3; const px = lerp(hx0, hx1, k), py = lerp(hy0, hy1, k) - Math.sin(k * Math.PI) * 60, sc2 = s / 2.3 * (1 - k * 0.6); g.save(); g.translate(px, py); g.rotate(k * 5); g.scale(sc2 * 1.6, sc2 * 1.6); g.fillStyle = '#e0442e'; g.beginPath(); g.moveTo(-13, 0); g.quadraticCurveTo(-8, -8, 2, -28); g.quadraticCurveTo(9, -10, 13, 0); g.quadraticCurveTo(0, 4, -13, 0); g.fill(); g.strokeStyle = '#0d0f14'; g.lineWidth = 2; g.stroke(); g.restore(); }
    // glinstering bij de handschoenen
    if (T > 4.85 && T < 5.4) { const k = (T - 4.85) / 0.55, hx0 = x + dir * 18 * s, hy0 = y - 32 * s; g.save(); g.translate(hx0, hy0); g.globalAlpha = Math.sin(k * Math.PI); g.fillStyle = '#fff'; for (const [dx, dy, r] of [[0, 0, 9], [14, -12, 5], [-12, -10, 4]]) { g.beginPath(); g.moveTo(dx, dy - r); g.lineTo(dx + r * 0.25, dy - r * 0.25); g.lineTo(dx + r, dy); g.lineTo(dx + r * 0.25, dy + r * 0.25); g.lineTo(dx, dy + r); g.lineTo(dx - r * 0.25, dy + r * 0.25); g.lineTo(dx - r, dy); g.lineTo(dx - r * 0.25, dy - r * 0.25); g.closePath(); g.fill(); } g.restore(); }
    // titel (levelnaam + ondertitel)
    const ta = Math.min(ease(seg(T, 0.45, 1.1)), 1 - ease(seg(T, 6.6, 7.3)));
    if (ta > 0.01) { g.save(); g.globalAlpha = ta; g.fillStyle = grad(g, 0, 0, 0, 150, [[0, 'rgba(0,0,0,.55)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(0, 0, W, 150); txt(g, meta.name, W / 2, 52, 44, '#ffffff', { shadow: 'rgba(0,0,0,.8)', blur: 10, sy: 3, fit: W - 120 }); txt(g, meta.sub, W / 2, 96, 24, '#ffe9b8', { weight: 500, shadow: 'rgba(0,0,0,.8)', blur: 8, sy: 2, fit: W - 140 }); g.restore(); }
    // overslaan-tekst
    g.save(); g.globalAlpha = 0.8 * ease(seg(T, 0.8, 1.4)); txt(g, 'Overslaan (spatie)', W - 24, H - 26, 20, '#ffffff', { align: 'right', weight: 500, shadow: 'rgba(0,0,0,.9)', blur: 6, sy: 2 }); g.restore();
    // zwart: fade in en fade uit
    const blk = Math.max(1 - ease(seg(T, 0, 0.5)), ease(seg(T, 8.0, 8.6)));
    if (blk > 0.004) { g.fillStyle = `rgba(0,0,0,${blk})`; g.fillRect(0, 0, W, H); }
    if (T >= 8.6) { finish(); return; }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  return { skip: finish };
}
