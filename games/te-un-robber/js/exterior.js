// Te-Un the Robber: de buitenkant van het gebouw (scene) en de sluip-intro.
// Alles procedureel op canvas. De statische lagen (lucht, achtergrond, gebouw, grond, lichtbronnen) worden 1 keer
// opgebouwd en per spec gecached; per frame worden alleen wolken, rook, flikkerende neon, vuur en de deur getekend.
import { drawTeUn, drawSuitcase } from './chars.js';
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
    const lc = o.lc || pick(['#ffd88a', '#ffd88a', '#ffe9b0', '#ffc77a']), tm = g.getTransform();
    c.E.push((e) => {
      e.setTransform(tm); e.save(); if (o.arch) rr(e, gl.x, gl.y, gl.w, gl.h, [gl.w / 2, gl.w / 2, 0, 0]); else { e.beginPath(); e.rect(gl.x, gl.y, gl.w, gl.h); } e.clip();
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
  if (type === 'police') { g.fillStyle = '#f4f4f4'; g.fillRect(6, -40, L - 10, 20); g.fillStyle = '#1d4fa8'; g.fillRect(6, -34, L - 10, 7); g.save(); g.translate(L / 2 + 4, -26); if (face < 0) g.scale(-1, 1); txt(g, 'POLITIE', 0, 0, 13, '#1d4fa8'); g.restore(); g.fillStyle = '#222'; g.fillRect(L / 2 - 14, -86, 28, 6); }
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
const KEEP = 2;
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
  if (gr === 'jungle') {
    for (const [x, dir] of [[40, 1], [1240, -1], [300, 1], [1000, -1]]) for (let k = 0; k < 3; k++) { g.strokeStyle = sh('#2a5a2a', rnd(-0.2, 0.1)); g.lineWidth = rnd(2, 4); g.beginPath(); g.moveTo(x + k * 20 * dir, -4); g.bezierCurveTo(x + k * 20 * dir + rnd(-20, 20), 60, x + rnd(-30, 30) * dir, 140, x + k * 18 * dir + rnd(-14, 14), rnd(150, 260)); g.stroke(); for (let q = 0; q < 6; q++) { g.fillStyle = sh(pick(['#2f7a34', '#3f9f44']), rnd(-0.2, 0.1)); g.beginPath(); g.ellipse(x + k * 20 * dir + rnd(-18, 18), rnd(20, 240), 9, 4, rnd(0, 3), 0, TAU); g.fill(); } }
  }
  if (gr === 'grass') {
    for (const x of [90, 1190]) { g.strokeStyle = '#2a2420'; g.lineWidth = 4; g.beginPath(); g.moveTo(x, 600); g.lineTo(x, 692); g.stroke(); g.fillStyle = '#3a2a1a'; g.fillRect(x - 12, 590, 24, 14); fire(c, x, 590, 1.2, '#ff9a3a'); if (c.lit) c.E.push((e) => glowAt(e, x, 584, 150, '#ff9a3a', 0.4)); }
  }
  if (gr === 'canal') {
    tree(c, 28, 662, 300, { wide: 0.3 }); tree(c, 1255, 662, 280, { wide: 0.3 });
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
  if (c.P.lights && (o.lit ?? true)) { const tm = g.getTransform(); c.E.push((e) => { e.setTransform(tm); e.save(); e.beginPath(); e.arc(x, y, r, 0, TAU); e.clip(); e.fillStyle = grad(e, 0, y - r, 0, y + r, [[0, '#fff0c0'], [0.5, '#ffd078'], [1, '#c8802a']]); e.fillRect(x - r, y - r, r * 2, r * 2); e.strokeStyle = fr; e.lineWidth = 3; e.beginPath(); e.moveTo(x - r, y); e.lineTo(x + r, y); e.moveTo(x, y - r); e.lineTo(x, y + r); e.stroke(); e.restore(); glowAt(e, x, y, r * 3.6, '#ffc060', 0.34); }); }
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
      g.fillStyle = '#6a4a2a'; g.fillRect(748, 520, 4, 76); g.fillStyle = '#d8362a'; rr(g, 736, 500, 28, 22, 8); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(744, 508, 2.4, 0, TAU); g.arc(756, 512, 2, 0, TAU); g.fill();
      stoneStep(c, 640, 120, B, 2);
      cap(c, 640, 372, 320, 218, col, { spots: 11 });
      chimney(c, 806, 168, 34, 70); smoke(c, 823, 160, { n: 10, rise: 170, drift: 50, size: 11 });
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
      roundWin(c, 640, 320, 24, { frame: '#3a4a6a', lit: true }); roundWin(c, 566, 490, 16, { frame: '#3a4a6a', shut: '#d8362a', pot: true }); roundWin(c, 714, 490, 16, { frame: '#3a4a6a', shut: '#d8362a', pot: true });
      // trap om de steel
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
      cap(c, 590, 140, 96, 62, '#d8722a', { spots: 4, rot: -0.3, seed: 2 });
      chimney(c, 795, 240, 30, 60); g.save(); g.translate(0, 0); smoke(c, 810, 232, { n: 9, rise: 150, drift: 60, size: 10 }); g.restore();
      for (const [x, y, s, cc] of [[420, 628, 1.4, '#c8502a'], [860, 626, 1.2, '#8a5aa8'], [940, 640, 0.8, '#e8c84a'], [130, 640, 1, '#b8802a']]) { g.fillStyle = '#efe6d0'; g.save(); g.translate(x, y); g.rotate(0.15); g.fillRect(-3 * s, -14 * s, 6 * s, 14 * s); g.restore(); cap(c, x + 2, y - 12 * s, 14 * s, 11 * s, cc, { spots: 3, spot: '#fff', rot: 0.2 }); }
      c.door = { x: 650, y: B, w: 100, h: 140, type: 'hinge', style: 'round', round: true, col: '#7a4a24', int: 'warm', rot: -0.045 };
    }
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
    for (const x of [466, 520, 760, 814]) win(c, x - 18, 418, 36, 70, { frame: '#6a4a2a', arch: true, p: 0.9, shut: x < 640 ? '#2a6a4a' : '#8a4a2a' });
    for (const x of [470, 810]) win(c, x - 15, 512, 30, 44, { frame: '#6a4a2a', arch: true, p: 0.6 });
    cap(c, 640, 342, 400, 210, '#c8402a', { spots: 13, seed: 11 });
    // klokkentoren bovenop de hoed
    ellShadow(g, 640, 214, 62, 9, 0.5);
    bricks(g, 600, 96, 80, 120, { base: '#9a5a44', bw: 14, bh: 7, v: 0.12 }); wallAO(g, 600, 96, 80, 120, { top: 0.1, bot: 0.35, side: 0.35 });
    g.fillStyle = '#e8e0d0'; g.beginPath(); g.arc(640, 140, 28, 0, TAU); g.fill(); g.strokeStyle = '#4a3a2a'; g.lineWidth = 4; g.stroke();
    g.fillStyle = '#20242a'; for (let i = 0; i < 12; i++) { const a = i * TAU / 12; g.fillRect(640 + Math.cos(a) * 21 - 1.2, 140 + Math.sin(a) * 21 - 1.2, 2.4, 2.4); }
    g.strokeStyle = '#20242a'; g.lineWidth = 3; g.beginPath(); g.moveTo(640, 140); g.lineTo(640, 121); g.moveTo(640, 140); g.lineTo(653, 146); g.stroke();
    emit(c, (e) => { glowAt(e, 640, 140, 60, '#fff0c0', 0.3); });
    cap(c, 640, 100, 66, 50, '#b8302a', { spots: 4, seed: 7 }); g.fillStyle = '#c8a030'; g.fillRect(639, 30, 3, 22); flag(c, 641, 52, 22, '#ffd02a', { w: 30, h: 16, col2: '#e84a2a' });
    // bord met GEMEENTEHUIS
    g.strokeStyle = '#3a2a1a'; g.lineWidth = 2; g.beginPath(); g.moveTo(540, 342); g.lineTo(540, 372); g.moveTo(740, 342); g.lineTo(740, 372); g.stroke();
    sign(c, 520, 366, 240, 36, c.spec.sign || 'GEMEENTEHUIS', { bg: '#6a4a2a', fg: '#ffe8a8', size: 22, lit: true, lightText: true, r: 5 });
    mushDoorFrame(c, 640, 130, 188, '#5a3a1a'); stoneStep(c, 640, 150, B, 3);
    for (const x of [556, 724]) { g.fillStyle = grad(g, x - 7, 0, x + 7, 0, [[0, '#d8d0c0'], [1, '#8a8478']]); g.fillRect(x - 7, 420, 14, 176); g.fillStyle = '#c8c0ae'; g.fillRect(x - 10, 412, 20, 8); g.fillRect(x - 10, 590, 20, 8); }
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
    bush(c, 160, 652, 90, 40, '#2f7a3a'); bush(c, 1120, 652, 90, 40, '#2f7a3a');
    for (let x = 60; x < 1280; x += 220) if (x < 300 || x > 980) bollard(g, x, 660);
    c.door = { x: 640, y: B, w: 100, h: 198, type: 'double', style: 'red', col: '#8a5a1a', int: 'warm' };
  },
};

// ------------------------------------------------------------------ gebouwen: Nederland
function roofSlope(c, x0, x1, yEave, yRidge, base, o = {}) { // dakvlak in vooraanzicht met pannen en dakgoot
  const g = c.g, ins = o.inset ?? 0;
  tilesRoof(g, [x0 + ins, yRidge, x1 - ins, yRidge, x1 + 6, yEave, x0 - 6, yEave], { base, tw: 18, th: 11 });
  g.save(); poly(g, [x0 + ins, yRidge, x1 - ins, yRidge, x1 + 6, yEave, x0 - 6, yEave]); g.clip(); g.fillStyle = grad(g, 0, yRidge, 0, yEave, [[0, 'rgba(255,255,255,.12)'], [0.5, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.3)']]); g.fillRect(x0 - 10, yRidge, x1 - x0 + 20, yEave - yRidge); g.restore();
  g.fillStyle = sh(base, -0.35); g.fillRect(x0 - 8, yEave - 2, x1 - x0 + 16, 7); g.fillStyle = '#d8d4cc'; g.fillRect(x0 - 6, yEave + 4, x1 - x0 + 12, 6); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x0 - 6, yEave + 10, x1 - x0 + 12, 5);
  g.fillStyle = sh(base, -0.2); g.fillRect(x0 + ins, yRidge - 5, x1 - x0 - ins * 2, 6);
}
function dormer(c, x, y, w, h, base) {
  const g = c.g; g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x + 3, y + 4, w, h);
  plaster(g, x, y, w, h, '#e8e2d2', { stains: 2 }); win(c, x + w * 0.2, y + h * 0.18, w * 0.6, h * 0.62, { frame: '#f6f2ea', p: 0.8, cols: 2, rows: 2, curt: '#d8c8a8' });
  tilesRoof(g, [x - 6, y, x + w / 2, y - h * 0.5, x + w + 6, y], { base, tw: 12, th: 8 }); g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 6, y); g.lineTo(x + w / 2, y - h * 0.5); g.lineTo(x + w + 6, y); g.stroke();
}
KINDS.rowhouse = {
  doorX: 640, scale: 2.3,
  build(c) {
    const g = c.g; const defs = [[-110, 190, '#8a5a46'], [190, 490, '#b0452f'], [490, 790, '#b5513b'], [790, 1090, '#c27a4a'], [1090, 1390, '#99503c']];
    // gevels van achter naar voren
    for (let i = 0; i < defs.length; i++) {
      const [x0, x1, col] = defs[i], ours = i === 2, wall = ours ? 0 : 0;
      const eave = 336 + (i % 2) * 8, ridge = 196 + (i % 2) * 16;
      bricks(g, x0, eave, x1 - x0, B - eave, { base: col, mortar: '#b5ab9c', bw: 20, bh: 8, v: 0.14, alt: [sh(col, 0.12), sh(col, -0.12), '#7a3a2a'] });
      // metselwerk-banden en stootvoeg
      g.fillStyle = 'rgba(235,225,205,.5)'; g.fillRect(x0, 462, x1 - x0, 6); g.fillRect(x0, eave + 10, x1 - x0, 5); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x0, 468, x1 - x0, 3);
      wallAO(g, x0, eave, x1 - x0, B - eave, { top: 0.32, bot: 0.4, side: 0.15 });
      roofSlope(c, x0, x1, eave, ridge, i % 2 ? '#6d4640' : '#58403f');
      g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(x1 - 3, eave - 150, 3, B - eave + 150); g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(x0, eave - 150, 2, B - eave + 150);
      if (!ours) {
        const mid = (x0 + x1) / 2;
        win(c, mid - 100, 366, 54, 80, { frame: '#f4f0e6', p: 0.7, cols: 2, rows: 3, curt: i % 2 ? '#e8c0a0' : '#c8d8e8' }); win(c, mid + 46, 366, 54, 80, { frame: '#f4f0e6', p: 0.55, cols: 2, rows: 3, curt: '#e8d8a8' });
        win(c, mid - 110, 492, 100, 70, { frame: '#f4f0e6', p: 0.7, cols: 3, rows: 2, curt: '#d8b8a0' });
        // deur van de buren
        const dx2 = mid + 70; g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(dx2 - 30, B - 128, 60, 128); g.fillStyle = i % 2 ? '#2a5a7a' : '#2a6a4a'; g.fillRect(dx2 - 27, B - 124, 54, 124); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(dx2 - 20, B - 114, 40, 44); g.fillStyle = '#d8b04a'; g.beginPath(); g.arc(dx2 + 16, B - 60, 3, 0, TAU); g.fill();
        dormer(c, mid - 30, 268, 60, 54, i % 2 ? '#6d4640' : '#58403f');
      }
    }
    // schoorstenen
    for (const x of [190, 790]) { bricks(g, x - 18, 130, 36, 92, { base: '#8a4a36', bw: 12, bh: 6 }); wallAO(g, x - 18, 130, 36, 92, { top: 0.1, bot: 0.3, side: 0.4 }); g.fillStyle = '#5a4a44'; g.fillRect(x - 22, 124, 44, 8); }
    smoke(c, 190, 122, { n: 8, rise: 130, drift: 40, size: 9, a: 0.4 });
    // onze woning (midden): ramen, luifel, deur
    win(c, 530, 366, 66, 84, { frame: '#f8f5ee', p: 0.85, cols: 2, rows: 3, curt: '#e8c8a8' }); win(c, 684, 366, 66, 84, { frame: '#f8f5ee', p: 0.45, cols: 2, rows: 3, curt: '#c8d8e8' });
    win(c, 520, 490, 82, 66, { frame: '#f8f5ee', p: 0.9, cols: 2, rows: 2, curt: '#d8c8a0' }); win(c, 678, 490, 82, 66, { frame: '#f8f5ee', p: 0.7, cols: 2, rows: 2, curt: '#e8b8a8' });
    dormer(c, 610, 262, 60, 56, '#58403f');
    // deurkozijn + luifel
    g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(604, B - 160, 72, 160); g.fillStyle = '#f2eee4'; g.fillRect(600, B - 164, 80, 6); g.fillRect(600, B - 164, 6, 164); g.fillRect(674, B - 164, 6, 164);
    g.fillStyle = grad(g, 0, B - 186, 0, B - 168, [[0, '#9a9a96'], [1, '#6a6a68']]); poly(g, [592, B - 180, 688, B - 180, 700, B - 166, 580, B - 166]); g.fill(); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(582, B - 166, 116, 6);
    g.fillStyle = '#f2eee4'; rr(g, 697, 458, 24, 18, 3); g.fill(); txt(g, '12', 709, 467, 14, '#202428');
    g.fillStyle = '#3a3a3c'; g.fillRect(588, 520, 12, 4);
    g.fillStyle = '#2a2a2e'; rr(g, 616 - 20, 436, 14, 20, 3); g.fill(); emit(c, (e) => { glowAt(e, 603, 446, 70, '#ffd890', 0.45); e.fillStyle = '#ffe8b0'; e.fillRect(598, 440, 10, 12); });
    stoneStep(c, 640, 92, B, 2);
    // voortuinen: haagjes, tulpenbedden, fietsen, kliko's
    tulips(c, 520, B + 22, 150, ['#e83a3a', '#f5c42a', '#e86aa8', '#ffffff', '#ff8a2a']); tulips(c, 690, B + 22, 140);
    hedge(c, 330, B + 14, 140, 20, '#3d7a3a'); hedge(c, 870, B + 14, 140, 20, '#3d7a3a'); tulips(c, 340, B + 24, 120, ['#f5c42a', '#e83a3a']); tulips(c, 880, B + 24, 120, ['#ffffff', '#e86aa8']);
    bike(c, 430, B + 6, 1.35, '#2a5aa8'); bike(c, 466, B + 4, 1.3, '#b8302a', -1);
    barrel(g, 1010, B + 4, 30, 50, '#3a7a4a'); barrel(g, 1048, B + 4, 30, 50, '#5a5a62');
    g.fillStyle = '#5a5a62'; g.fillRect(1012, B - 52, 26, 4);
    lampPost(c, 130, 668, 190, { arm: 16, col: '#ffd890' }); lampPost(c, 1160, 668, 190, { arm: -16, col: '#ffd890' });
    // wasgoed-achtig detail: zonnepanelen op het dak links
    g.fillStyle = '#16223a'; for (let i = 0; i < 3; i++) { poly(g, [230 + i * 40, 290, 266 + i * 40, 290, 268 + i * 40, 320, 228 + i * 40, 320]); g.fill(); g.strokeStyle = '#7a8aa8'; g.lineWidth = 1; g.stroke(); }
    c.door = { x: 640, y: B, w: 68, h: 152, type: 'hinge', style: 'panel', win: true, col: '#2a5a8a', int: 'warm' };
  },
};

function gable(c, x0, x1, yEave, yTop, kind, col, trim = '#e8e2d2') {
  const g = c.g, w = x1 - x0, cx = (x0 + x1) / 2;
  const pts = () => { g.beginPath(); g.moveTo(x0, yEave);
    if (kind === 'step') { const st = 4, sh0 = (yEave - yTop) / (st + 1); let yy = yEave, xx = x0; for (let i = 0; i < st; i++) { yy -= sh0; g.lineTo(xx, yy); xx += w * 0.12; g.lineTo(xx, yy); } g.lineTo(xx, yTop); g.lineTo(x1 - (xx - x0), yTop); xx = x1 - (xx - x0); yy = yTop; for (let i = 0; i < st; i++) { g.lineTo(xx, yy); xx += 0; yy += 0; } g.closePath(); }
    else if (kind === 'bell') { g.lineTo(x0, yEave - (yEave - yTop) * 0.5); g.bezierCurveTo(x0, yEave - (yEave - yTop) * 0.75, cx - w * 0.3, yEave - (yEave - yTop) * 0.7, cx - w * 0.2, yTop + 14); g.quadraticCurveTo(cx, yTop - 10, cx + w * 0.2, yTop + 14); g.bezierCurveTo(cx + w * 0.3, yEave - (yEave - yTop) * 0.7, x1, yEave - (yEave - yTop) * 0.75, x1, yEave - (yEave - yTop) * 0.5); g.lineTo(x1, yEave); g.closePath(); }
    else if (kind === 'neck') { g.lineTo(x0, yEave - (yEave - yTop) * 0.45); g.quadraticCurveTo(x0 + w * 0.14, yEave - (yEave - yTop) * 0.5, x0 + w * 0.2, yEave - (yEave - yTop) * 0.72); g.lineTo(x0 + w * 0.2, yTop + 10); g.lineTo(cx, yTop - 6); g.lineTo(x1 - w * 0.2, yTop + 10); g.lineTo(x1 - w * 0.2, yEave - (yEave - yTop) * 0.72); g.quadraticCurveTo(x1 - w * 0.14, yEave - (yEave - yTop) * 0.5, x1, yEave - (yEave - yTop) * 0.45); g.lineTo(x1, yEave); g.closePath(); }
    else { g.lineTo(x0, yEave - (yEave - yTop) * 0.55); g.lineTo(cx, yTop); g.lineTo(x1, yEave - (yEave - yTop) * 0.55); g.lineTo(x1, yEave); g.closePath(); } };
  if (kind === 'step') { // trapgevel: eigen vorm
    const pts2 = [x0, yEave]; const st = 5, stepH = (yEave - yTop) / st, stepW = (w * 0.38) / st; for (let i = 0; i < st; i++) { pts2.push(x0 + i * stepW, yEave - stepH * (i + 1)); pts2.push(x0 + (i + 1) * stepW, yEave - stepH * (i + 1)); }
    const right = []; for (let i = st - 1; i >= 0; i--) { right.push(x1 - (i + 1) * stepW, yEave - stepH * (i + 1)); right.push(x1 - i * stepW, yEave - stepH * (i + 1)); }
    const all = pts2.concat(right).concat([x1, yEave]);
    bricks(g, x0 - 2, yTop - 4, w + 4, yEave - yTop + 6, { base: col, mortar: '#b5ab9c', bw: 16, bh: 7, v: 0.12 });
    // buiten de vorm weghalen: teken lucht-clip niet mogelijk; daarom vormen we via clip vooraf
    return all;
  }
  return pts;
}
function shapedFacade(c, x0, x1, yEave, yTop, kind, col, trim) { // gevel met vorm (clip) + bakstenen + natuursteen rand
  const g = c.g, w = x1 - x0, cx = (x0 + x1) / 2, hh = yEave - yTop;
  const p = () => {
    g.beginPath(); g.moveTo(x0, B);
    if (kind === 'step') { const st = 5, stepH = hh / st, stepW = (w * 0.4) / st; g.lineTo(x0, yEave); for (let i = 0; i < st; i++) { g.lineTo(x0 + i * stepW, yEave - stepH * (i + 1) + 0); g.lineTo(x0 + (i + 1) * stepW, yEave - stepH * (i + 1)); } for (let i = st - 1; i >= 0; i--) { g.lineTo(x1 - (i + 1) * stepW, yEave - stepH * (i + 1)); g.lineTo(x1 - i * stepW, yEave - stepH * (i + 1)); } g.lineTo(x1, yEave); }
    else if (kind === 'bell') { g.lineTo(x0, yEave - hh * 0.4); g.bezierCurveTo(x0, yEave - hh * 0.7, cx - w * 0.3, yEave - hh * 0.62, cx - w * 0.2, yTop + 16); g.quadraticCurveTo(cx, yTop - 14, cx + w * 0.2, yTop + 16); g.bezierCurveTo(cx + w * 0.3, yEave - hh * 0.62, x1, yEave - hh * 0.7, x1, yEave - hh * 0.4); }
    else if (kind === 'neck') { g.lineTo(x0, yEave - hh * 0.35); g.quadraticCurveTo(x0 + w * 0.12, yEave - hh * 0.4, x0 + w * 0.2, yEave - hh * 0.68); g.lineTo(x0 + w * 0.2, yTop + 14); g.lineTo(cx, yTop - 4); g.lineTo(x1 - w * 0.2, yTop + 14); g.lineTo(x1 - w * 0.2, yEave - hh * 0.68); g.quadraticCurveTo(x1 - w * 0.12, yEave - hh * 0.4, x1, yEave - hh * 0.35); }
    else { g.lineTo(x0, yEave - hh * 0.4); g.lineTo(cx, yTop); g.lineTo(x1, yEave - hh * 0.4); }
    g.lineTo(x1, B); g.closePath();
  };
  g.save(); p(); g.clip(); bricks(g, x0, yTop - 20, w, B - yTop + 20, { base: col, mortar: '#b8aea0', bw: 18, bh: 7.5, v: 0.14, alt: [sh(col, 0.12), sh(col, -0.14)] }); wallAO(g, x0, yTop - 20, w, B - yTop + 20, { top: 0.28, bot: 0.4, side: 0.2 }); g.restore();
  g.save(); p(); g.strokeStyle = trim; g.lineWidth = 5; g.lineJoin = 'round'; g.stroke(); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.5; g.stroke(); g.restore();
}
KINDS.canalhouse = {
  doorX: 640, scale: 2.3,
  build(c) {
    const g = c.g, W5 = 218, x00 = 640 - W5 * 2.5;
    const defs = [['step', '#8a3a2c', 190, 330], ['neck', '#6a4638', 150, 330], ['bell', '#9a4a34', 96, 330], ['neck', '#7a4a3a', 160, 330], ['step', '#8c5036', 206, 330]];
    const hang = [];
    for (let i = 0; i < 5; i++) {
      const x0 = x00 + i * W5, x1 = x0 + W5, [kind, col, top, eave] = defs[i], ours = i === 2;
      shapedFacade(c, x0, x1, eave, top, kind, col, '#ece6d6');
      g.fillStyle = '#ece6d6'; g.fillRect(x0, eave - 2, W5, 6); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x0, eave + 4, W5, 4);
      for (let r = 0; r < 3; r++) for (let k = 0; k < (r === 2 && ours ? 0 : 2); k++) { const wx = x0 + 30 + k * 84, wy = 362 + r * 74 + (r === 2 ? 20 : 0); if (r === 2 && !ours) win(c, wx, wy - 10, 44, 80, { frame: '#f6f2e8', p: 0.5, cols: 2, rows: 3, curt: '#d8b890' }); else if (r < 2) win(c, wx, wy, 44, r === 0 ? 78 : 84, { frame: '#f6f2e8', p: 0.7, cols: 2, rows: 3, curt: pick(['#e8c8a0', '#c8d8e8', '#e8a8a8']) }); }
      if (!ours) { const dx2 = x0 + W5 / 2 + (i % 2 ? 30 : -30); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(dx2 - 24, B - 112, 48, 112); g.fillStyle = pick(['#2a4a6a', '#6a2a2a', '#2a5a3a']); g.fillRect(dx2 - 21, B - 108, 42, 108); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(dx2 - 14, B - 100, 28, 34); stoneStep(c, dx2, 50, B, 2); }
      if (i === 0 || i === 4) { g.fillStyle = '#c8c0b0'; g.fillRect(x0 + W5 / 2 - 14, top + 8, 28, 4); }
      g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(x1 - 2, top, 2, B - top);
      // hijsbalk met haak
      if (ours || i === 3) { const bx = x0 + W5 / 2; g.fillStyle = '#4a3a2a'; g.fillRect(bx - 4, top - 22, 8, 22); g.fillRect(bx - 4, top - 22, 34, 6); g.strokeStyle = '#2a2a2e'; g.lineWidth = 2; g.beginPath(); g.moveTo(bx + 28, top - 16); g.lineTo(bx + 28, top - 4); g.arc(bx + 28, top, 4, -Math.PI / 2, Math.PI); g.stroke(); }
    }
    // onze deur midden, met waaier en trap
    const x0 = x00 + 2 * W5;
    g.fillStyle = 'rgba(0,0,0,.4)'; rr(g, 603, B - 172, 74, 172, [30, 30, 0, 0]); g.fill();
    g.fillStyle = '#f2eee2'; rr(g, 599, B - 176, 82, 176, [34, 34, 0, 0]); g.fill();
    win(c, 616, B - 232, 48, 30, { frame: '#f2eee2', arch: true, f: 4, p: 1, cols: 3, rows: 1, sill: false });
    for (let i = 0; i < 4; i++) { g.fillStyle = grad(g, 0, B - 4 + i * 7, 0, B + 3 + i * 7, [[0, '#cfc8b8'], [1, '#8a8478']]); g.fillRect(596 - i * 8, B - 3 + i * 7, 88 + i * 16, 8); g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(596 - i * 8, B - 3 + i * 7, 88 + i * 16, 1.5); }
    lantern(c, 592, 470, 9, '#ffc060', { glow: 5 }); g.strokeStyle = '#2a2a2e'; g.lineWidth = 2; g.beginPath(); g.moveTo(592, 440); g.lineTo(592, 458); g.stroke();
    // lantaarns en bomen langs de gracht
    lampPost(c, 480, 668, 190, { arm: 16, col: '#ffc878' }); lampPost(c, 800, 668, 190, { arm: -16, col: '#ffc878' });
    // fietsen aan het hek
    bike(c, 170, 666, 1.15, '#7a2a2a'); bike(c, 224, 666, 1.15, '#2a4a6a', -1); bike(c, 960, 666, 1.15, '#3a5a3a'); bike(c, 1016, 666, 1.15, '#8a6a2a', -1);
    // boot en brug
    const bx = 940, by = 704; g.fillStyle = '#14181e'; g.beginPath(); g.moveTo(bx - 120, by - 16); g.lineTo(bx + 130, by - 16); g.quadraticCurveTo(bx + 112, by + 14, bx + 80, by + 14); g.lineTo(bx - 80, by + 14); g.quadraticCurveTo(bx - 110, by + 12, bx - 120, by - 16); g.fill(); g.fillStyle = '#7a2a2a'; g.fillRect(bx - 118, by - 20, 244, 5); g.fillStyle = '#2a2a30'; g.fillRect(bx - 30, by - 44, 60, 28); win(c, bx - 22, by - 40, 18, 16, { lit: true, sill: false, f: 2 }); win(c, bx + 4, by - 40, 18, 16, { lit: true, sill: false, f: 2 });
    stoneBlocks(g, 0, 676, 230, 44, { base: '#8a8478', bh: 14 }); g.fillStyle = '#a8a296'; g.fillRect(0, 668, 240, 10);
    // weerspiegeling van de raamlichten in het water
    if (c.lit) c.E.push((e) => { e.save(); e.globalCompositeOperation = 'lighter'; for (let i = 0; i < 70; i++) { const rx = 110 + R() * 1060, ry = 684 + R() * 34; e.fillStyle = al(pick(['#ffc060', '#ffd890', '#ffb050']), 0.12 + R() * 0.16); e.fillRect(rx, ry, rnd(2, 5), rnd(5, 20)); } e.restore(); });
    c.door = { x: 640, y: B, w: 64, h: 156, type: 'hinge', style: 'panel', win: true, col: '#1f5a4a', int: 'warm' };
  },
};

KINDS.supermarket = {
  doorX: 470, scale: 2.3,
  build(c) {
    const g = c.g;
    // gebouw: plint + gevel
    concrete(g, 100, 316, 1080, B - 316, { base: '#c8c4b8', panels: 90, cracks: 3 }); wallAO(g, 100, 316, 1080, B - 316, { top: 0.35, bot: 0.3 });
    // gekleurde band met logo en dak-rand
    g.fillStyle = grad(g, 0, 316, 0, 380, [[0, '#e8e4da'], [1, '#c8c4b8']]); g.fillRect(100, 316, 1080, 64);
    g.fillStyle = '#1f7a3a'; g.fillRect(100, 380, 1080, 14); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(100, 394, 1080, 6);
    g.fillStyle = '#9a968a'; g.fillRect(90, 304, 1100, 14); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(90, 304, 1100, 2); g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(90, 318, 1100, 4);
    // dakopbouw: airco, schoorsteentjes, zonnepanelen
    for (const x of [820, 940, 1060]) { g.fillStyle = '#9aa2aa'; g.fillRect(x, 262, 90, 42); g.fillStyle = '#6a727a'; g.fillRect(x, 262, 90, 6); g.fillStyle = '#4a525a'; for (let i = 0; i < 6; i++) g.fillRect(x + 8 + i * 13, 276, 8, 20); g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(x, 262, 90, 2); }
    g.fillStyle = '#2a323a'; for (let i = 0; i < 5; i++) { poly(g, [130 + i * 28, 296, 150 + i * 28, 296, 148 + i * 28, 276, 134 + i * 28, 276]); g.fill(); }
    // etalageramen met lichte interieurs (emissief)
    const gl = [[130, 410, 270, 186], [560, 410, 280, 186]];
    for (const [x, y, w, h] of gl) { g.fillStyle = '#4a4e54'; g.fillRect(x - 6, y - 6, w + 12, h + 6); g.fillStyle = grad(g, 0, y, 0, y + h, c.P.key === 'day' ? [[0, '#a8c8e0'], [1, '#e8f0f4']] : [[0, '#2a3a50'], [1, '#101826']]); g.fillRect(x, y, w, h); g.fillStyle = 'rgba(255,255,255,.14)'; poly(g, [x, y + h * 0.7, x + w * 0.5, y, x + w * 0.7, y, x, y + h * 0.95]); g.fill();
      for (let k = 1; k < 4; k++) { g.fillStyle = '#4a4e54'; g.fillRect(x + (w * k) / 4 - 2, y, 4, h); }
      if (c.lit || c.P.key === 'day') { const body = (e) => { e.save(); e.beginPath(); e.rect(x, y, w, h); e.clip(); e.fillStyle = grad(e, 0, y, 0, y + h, [[0, '#fffff4'], [1, '#e8f0e0']]); e.fillRect(x, y, w, h); for (let r = 0; r < 4; r++) { const sy = y + 44 + r * 34; e.fillStyle = '#9a9aa2'; e.fillRect(x + 10, sy, w - 20, 5); for (let q = 0; q < (w - 20) / 12; q++) { e.fillStyle = pick(['#d83a2a', '#f0c02a', '#3a8a3a', '#2a5ab8', '#f08a2a', '#ffffff', '#c83a8a']); e.fillRect(x + 12 + q * 12, sy - 20 + (q % 3) * 2, 9, 20 - (q % 3) * 2); } } e.fillStyle = 'rgba(0,0,0,.18)'; e.fillRect(x, y, w, 8); e.fillStyle = '#e8e8d8'; for (let q = 0; q < 6; q++) e.fillRect(x + 20 + q * (w / 6), y + 8, 30, 4); e.fillStyle = '#4a4e54'; for (let k = 1; k < 4; k++) e.fillRect(x + (w * k) / 4 - 2, y, 4, h); e.restore(); }; if (c.P.key === 'day') { g.save(); g.globalAlpha = 0.45; body(g); g.restore(); } else c.E.push((e) => { body(e); glowAt(e, x + w / 2, y + h / 2, w * 0.7, '#f4fff0', 0.25); }); }
      g.fillStyle = '#6a6e74'; g.fillRect(x - 6, y + h, w + 12, 10);
    }
    // poster-bord rechts met grote fruit-illustratie
    const px = 900, py = 410, pw = 250, ph = 150; g.fillStyle = '#20252b'; g.fillRect(px - 5, py - 5, pw + 10, ph + 10); g.fillStyle = '#fff6dc'; g.fillRect(px, py, pw, ph);
    for (const [fx, fy, fr, fc] of [[px + 60, py + 90, 26, '#d8322a'], [px + 112, py + 100, 24, '#f08a1a'], [px + 160, py + 92, 28, '#7ab83a'], [px + 205, py + 100, 22, '#f0c820']]) { g.fillStyle = rgrad(g, fx - 7, fy - 8, 2, fr, [[0, sh(fc, 0.4)], [1, sh(fc, -0.25)]]); g.beginPath(); g.arc(fx, fy, fr, 0, TAU); g.fill(); g.fillStyle = '#3a7a2a'; g.beginPath(); g.ellipse(fx + 3, fy - fr - 2, 8, 3.5, 0.5, 0, TAU); g.fill(); }
    txt(g, 'ELKE DAG VERS', px + pw / 2, py + 30, 26, '#1f7a3a', { fit: pw - 20 }); txt(g, 'DAGVERSE AANBIEDINGEN', px + pw / 2, py + 56, 14, '#6a4a2a', { weight: 500, fit: pw - 20 });
    emit(c, (e) => { e.save(); e.globalCompositeOperation = 'lighter'; e.fillStyle = 'rgba(255,240,200,.35)'; e.fillRect(px, py, pw, ph); e.restore(); });
    // groot bord
    const sg = c.spec.sign || 'SUPER'; sign(c, 150, 322, 430, 52, sg, { bg: '#d8322a', fg: '#ffffff', size: 40, neon: false, lit: true, lightText: true, rim: '#8a1a14', spacing: 6 });
    txt(g, 'GEOPEND 8-22', 780, 350, 24, '#1f7a3a', { fit: 220 }); txt(g, 'ELKE DAG', 1060, 350, 20, '#6a4a2a', { weight: 500 });
    // ingang: luifel + schuifdeur + glazen paneel
    g.fillStyle = '#5a5e64'; g.fillRect(390, 404, 160, 6); g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(390, 410, 160, 5); g.fillStyle = 'rgba(70,74,80,1)'; g.fillRect(390, 410, 6, 186); g.fillRect(544, 410, 6, 186);
    g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(396, B - 198, 148, 198);
    sign(c, 420, 413, 100, 20, 'IN / UIT', { bg: '#1f7a3a', fg: '#fff', size: 14, shadow: false, bolts: false, r: 3 });
    // stoep, drempel
    g.fillStyle = grad(g, 0, B, 0, B + 14, [[0, '#d8d4c8'], [1, '#9a968a']]); g.fillRect(380, B - 2, 180, 14);
    // winkelwagens
    for (let i = 0; i < 6; i++) cart(c, 610 + i * 14, 640 - i * 0, 1.1); g.fillStyle = '#4a525a'; g.fillRect(596, 590, 6, 52); g.fillRect(692, 590, 6, 52); g.fillRect(596, 590, 102, 4);
    // tl-lichten in de luifel
    emit(c, (e) => { poolAt(e, 470, B + 20, 150, 24, '#f4fff0', 0.35); e.save(); e.globalCompositeOperation = 'lighter'; e.fillStyle = grad(e, 0, 410, 0, B, [[0, 'rgba(240,255,235,.16)'], [1, 'rgba(240,255,235,0)']]); e.fillRect(396, 410, 148, 190); e.restore(); });
    // lantaarnpalen
    for (const x of [90, 760, 1190]) { lampPost(c, x, 646, 300, { arm: x < 700 ? 18 : -18, col: '#fff0c8', r: 160, poolY: 26 }); }
    // parkeerborden
    g.fillStyle = '#2a5ab8'; g.fillRect(1100, 560, 38, 38); txt(g, 'P', 1119, 580, 28, '#fff'); g.fillStyle = '#6a6e74'; g.fillRect(1117, 598, 4, 48);
    // geparkeerde auto's
    car(c, 160, 730, 330, { col: '#c82a2a', lights: true }); car(c, 900, 730, 330, { col: '#2a5aa8', face: -1, lights: true });
    car(c, 330, 690, 190, { col: '#3a8a4a', face: -1, lights: false }); car(c, 760, 688, 190, { col: '#c8a02a', lights: false }); car(c, 1150, 690, 190, { col: '#2a2a30', lights: false, face: -1 });
    c.door = { x: 470, y: B, w: 140, h: 190, type: 'slide', style: 'glass', int: 'cool' };
  },
};

KINDS.casino = {
  doorX: 640, scale: 2.3,
  build(c) {
    const g = c.g;
    // zijvleugels
    for (const [x0, x1, s] of [[100, 420, 1], [860, 1180, -1]]) { plaster(g, x0, 260, x1 - x0, B - 260, '#3a1a4a', { stains: 6 }); wallAO(g, x0, 260, x1 - x0, B - 260, { top: 0.3, bot: 0.4 }); g.fillStyle = '#c8a030'; g.fillRect(x0, 254, x1 - x0, 10); g.fillRect(x0, B - 10, x1 - x0, 6);
      for (let i = 0; i < 4; i++) { const wx = x0 + 34 + i * 72; win(c, wx, 330, 40, 110, { frame: '#c8a030', arch: true, p: 0.8, lc: pick(['#ff8ac8', '#ffd060', '#8ad8ff']), cols: 1, rows: 3, f: 4 }); }
      for (let i = 0; i < 3; i++) { const nx = x0 + 70 + i * 90 + (s < 0 ? 10 : 0); g.fillStyle = '#2a1030'; g.fillRect(nx - 3, 460, 6, 110); emit(c, (e) => { e.save(); e.shadowColor = pick(['#ff30a0', '#30e0ff']); e.shadowBlur = 20; e.fillStyle = '#ff7ac8'; e.fillRect(nx - 2, 466, 4, 98); e.restore(); }); }
    }
    // middenblok
    plaster(g, 420, 130, 440, B - 130, '#4a2058', { stains: 8 }); wallAO(g, 420, 130, 440, B - 130, { top: 0.3, bot: 0.35, side: 0.25 });
    g.fillStyle = '#c8a030'; g.fillRect(410, 124, 460, 12); g.fillRect(410, 400, 460, 8); g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(410, 124, 460, 2);
    for (let i = 0; i < 2; i++) for (let k = 0; k < 5; k++) win(c, 446 + k * 80, 424 + i * 0, 50, 60, { frame: '#c8a030', p: 0.9, lc: pick(['#ffd060', '#ff9ac8', '#ffe8b0']), cols: 2, rows: 2, f: 4 });
    // marquee met lampjes
    const mx = 450, my = 150, mw = 380, mh = 110; g.fillStyle = '#1a0a22'; rr(g, mx, my, mw, mh, 14); g.fill(); g.strokeStyle = '#c8a030'; g.lineWidth = 6; g.stroke();
    const bulbs = []; for (let i = 0; i < 26; i++) bulbs.push([mx + 12 + (i / 25) * (mw - 24), my + 8], [mx + 12 + (i / 25) * (mw - 24), my + mh - 8]); for (let i = 1; i < 6; i++) bulbs.push([mx + 8, my + 8 + (i / 6) * (mh - 16)], [mx + mw - 8, my + 8 + (i / 6) * (mh - 16)]);
    g.fillStyle = '#6a5a30'; for (const [bx, by] of bulbs) { g.beginPath(); g.arc(bx, by, 3.4, 0, TAU); g.fill(); }
    neonText(c, c.spec.sign || 'CASINO', mx + mw / 2, my + mh / 2 + 4, 66, '#ff3aa8', { fit: mw - 50, spacing: 6 });
    flicker(c, mx + 20, my + 20, mw - 40, mh - 40, 31, { rate: 5, depth: 0.5 });
    if (c.lit) c.D.push((gg, t) => { gg.save(); gg.globalCompositeOperation = 'lighter'; bulbs.forEach(([bx, by], i) => { const on = (i + Math.floor(t * 7)) % 3 === 0; gg.fillStyle = on ? 'rgba(255,230,120,.95)' : 'rgba(255,200,80,.25)'; gg.beginPath(); gg.arc(bx, by, on ? 3.6 : 2.6, 0, TAU); gg.fill(); if (on) { gg.fillStyle = 'rgba(255,200,60,.25)'; gg.beginPath(); gg.arc(bx, by, 11, 0, TAU); gg.fill(); } }); gg.restore(); });
    // sterren en dollars
    for (const [sx, sy, sc] of [[470, 106, 1], [810, 106, 1], [640, 100, 1.4]]) { g.fillStyle = '#c8a030'; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r0 = i % 2 ? 7 : 16; g.lineTo(sx + Math.cos(a) * r0 * sc, sy + Math.sin(a) * r0 * sc); } g.closePath(); g.fill(); emit(c, (e) => { glowAt(e, sx, sy, 50, '#ffd860', 0.5); }); }
    // ingang met zuilen, bladgoud
    g.fillStyle = 'rgba(0,0,0,.55)'; rr(g, 566, B - 236, 148, 236, [60, 60, 0, 0]); g.fill(); g.strokeStyle = '#d8b040'; g.lineWidth = 8; rr(g, 562, B - 240, 156, 240, [64, 64, 0, 0]); g.stroke();
    for (const x of [548, 732]) { g.fillStyle = grad(g, x - 10, 0, x + 10, 0, [[0, '#f8e090'], [0.5, '#c8a030'], [1, '#6a4a10']]); g.fillRect(x - 10, 410, 20, B - 410); g.fillStyle = '#e8c850'; g.fillRect(x - 15, 404, 30, 10); g.fillRect(x - 15, B - 10, 30, 10); }
    // rode loper + paaltjes met koord
    g.fillStyle = grad(g, 0, B, 0, 700, [[0, '#8a1018'], [1, '#c8222c']]); poly(g, [586, B, 694, B, 744, 700, 536, 700]); g.fill(); g.strokeStyle = '#e8c850'; g.lineWidth = 3; g.beginPath(); g.moveTo(586, B); g.lineTo(536, 700); g.moveTo(694, B); g.lineTo(744, 700); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 1; for (let y = 610; y < 700; y += 10) { g.beginPath(); g.moveTo(586 - (y - B) * 0.5, y); g.lineTo(694 + (y - B) * 0.5, y); g.stroke(); }
    for (const [x, y] of [[578, 604], [550, 650], [702, 604], [730, 650]]) { g.fillStyle = '#d8b040'; g.fillRect(x - 2, y - 30, 4, 30); g.beginPath(); g.arc(x, y - 31, 4.5, 0, TAU); g.fill(); g.fillRect(x - 7, y - 2, 14, 3); }
    g.strokeStyle = '#a01822'; g.lineWidth = 3; g.beginPath(); g.moveTo(578, 574); g.quadraticCurveTo(564, 600, 550, 620); g.moveTo(702, 574); g.quadraticCurveTo(716, 600, 730, 620); g.stroke();
    emit(c, (e) => { poolAt(e, 640, 650, 170, 40, '#ff4a6a', 0.22); });
    // zoeklichten
    beam(c, 250, 250, 520, 36, '#bfe0ff', 0.5, 0, 0.16, 0.6); beam(c, 1030, 250, 520, 36, '#ffd8ff', 0.45, 2, 0.16, 0.6);
    // palmen in bakken
    for (const x of [470, 810]) { g.fillStyle = '#c8a030'; rr(g, x - 20, 612, 40, 26, 3); g.fill(); g.fillStyle = '#7a5a10'; g.fillRect(x - 20, 612, 40, 4); }
    tree(c, 470, 618, 140, { type: 'palm', lean: 14 }); tree(c, 810, 618, 140, { type: 'palm', lean: -14 });
    for (const x of [90, 1190]) lampPost(c, x, 660, 200, { arm: x < 640 ? 16 : -16, col: '#ffd0f0' });
    // limo's
    car(c, 215, 716, 400, { type: 'limo', col: '#14141a', lights: true, stripe: '#c8a030' }); car(c, 1060, 718, 400, { type: 'limo', col: '#e8e8ee', lights: true, face: -1, stripe: '#c8a030' });
    c.door = { x: 640, y: B, w: 124, h: 222, type: 'double', style: 'glass', col: '#c8a030', int: 'warm' };
    // glazen deur heeft gouden bar
  },
};

// ------------------------------------------------------------------ gebouwen: China en winkelstraat
function tilesClip(g, pathFn, bx0, by0, bx1, by1, o = {}) {
  const base = o.base || '#3a6a5a', tw = o.tw || 14, th = o.th || 9;
  g.save(); pathFn(); g.clip(); g.fillStyle = sh(base, -0.4); g.fillRect(bx0, by0, bx1 - bx0, by1 - by0);
  for (let ry = by0, r = 0; ry < by1 + th; ry += th, r++) for (let cx = bx0 - (r % 2 ? tw / 2 : 0) - tw; cx < bx1 + tw; cx += tw) {
    g.fillStyle = sh(base, (R() - 0.5) * 0.22); g.beginPath(); g.moveTo(cx, ry); g.lineTo(cx + tw, ry); g.lineTo(cx + tw, ry + th * 0.5); g.quadraticCurveTo(cx + tw / 2, ry + th * 1.3, cx, ry + th * 0.5); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1; g.stroke(); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(cx + 2, ry + 1, tw - 4, 1.4);
  }
  g.fillStyle = grad(g, 0, by0, 0, by1, [[0, 'rgba(255,255,255,.14)'], [0.5, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.35)']]); g.fillRect(bx0, by0, bx1 - bx0, by1 - by0);
  g.restore();
}
function cnRoof(c, x0, x1, y, h, inset, col, o = {}) {
  const g = c.g, rx0 = x0 + inset, rx1 = x1 - inset, yb = y + h, tip = o.tip ?? 18;
  const path = () => { g.beginPath(); g.moveTo(rx0, y); g.bezierCurveTo(rx0 - (rx0 - x0) * 0.25, y + h * 0.5, x0 + (rx0 - x0) * 0.5, yb - 6, x0 - 8, yb - tip); g.quadraticCurveTo(x0 + 10, yb + 4, x0 + 38, yb + 3); g.lineTo(x1 - 38, yb + 3); g.quadraticCurveTo(x1 - 10, yb + 4, x1 + 8, yb - tip); g.bezierCurveTo(x1 - (x1 - rx1) * 0.5, yb - 6, rx1 + (x1 - rx1) * 0.25, y + h * 0.5, rx1, y); g.closePath(); };
  ellShadow(g, (x0 + x1) / 2, yb + 18, (x1 - x0) / 2, 14, 0.35);
  tilesClip(g, path, x0 - 10, y, x1 + 10, yb + 6, { base: col, tw: o.tw || 14, th: o.th || 9 });
  g.save(); path(); g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 2; g.stroke(); g.restore();
  g.fillStyle = o.fascia || '#b8201c'; g.beginPath(); g.moveTo(x0 + 38, yb + 3); g.lineTo(x1 - 38, yb + 3); g.lineTo(x1 - 38, yb + 12); g.lineTo(x0 + 38, yb + 12); g.fill(); g.fillStyle = '#e8c040'; g.fillRect(x0 + 38, yb + 12, x1 - x0 - 76, 2.5); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x0 + 38, yb + 14, x1 - x0 - 76, 6);
  g.fillStyle = sh(col, -0.2); rr(g, rx0 - 8, y - 8, rx1 - rx0 + 16, 10, 5); g.fill(); g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1.5; g.stroke(); g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(rx0 - 4, y - 8, rx1 - rx0 + 8, 2);
  for (const [ex, s] of [[rx0 - 8, -1], [rx1 + 8, 1]]) { g.fillStyle = o.orn || '#d8b040'; g.beginPath(); g.moveTo(ex, y + 2); g.quadraticCurveTo(ex + s * 4, y - 14, ex + s * 12, y - 20); g.quadraticCurveTo(ex + s * 4, y - 6, ex + s * 2, y + 2); g.fill(); }
}
function lattice(c, x, y, w, h, o = {}) {
  const g = c.g, fr = o.frame || '#6a1810', gold = o.gold || '#d8b040', n = o.n || 4;
  g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(x - 2, y - 2, w + 4, h + 4); g.fillStyle = fr; g.fillRect(x, y, w, h);
  g.fillStyle = grad(g, 0, y, 0, y + h, [[0, '#1b2a44'], [1, '#0a111d']]); g.fillRect(x + 5, y + 5, w - 10, h - 10);
  const lat = (e, col) => { e.strokeStyle = col; e.lineWidth = 2.2; e.beginPath(); for (let i = 0; i <= n; i++) { const px = x + 5 + ((w - 10) * i) / n; e.moveTo(px, y + 5); e.lineTo(px, y + h - 5); } const m = Math.max(2, Math.round(h / (w / n))); for (let i = 0; i <= m; i++) { const py = y + 5 + ((h - 10) * i) / m; e.moveTo(x + 5, py); e.lineTo(x + w - 5, py); } e.stroke(); };
  lat(g, gold); g.strokeStyle = gold; g.lineWidth = 3; g.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  if (o.lit ?? c.P.lights) c.E.push((e) => { e.fillStyle = grad(e, 0, y, 0, y + h, [[0, '#ffe0a0'], [1, '#e8902a']]); e.fillRect(x + 5, y + 5, w - 10, h - 10); lat(e, '#5a2a10'); e.strokeStyle = gold; e.lineWidth = 3; e.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3); glowAt(e, x + w / 2, y + h / 2, Math.max(w, h) * 0.9, '#ffb050', 0.3); });
}
function dragon(c, x, y, s, flip, col = '#e8c040') { // gouden draak (S-slang)
  const g = c.g; g.save(); g.translate(x, y); g.scale(s * flip, s); g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = sh(col, -0.5); g.lineWidth = 12; g.beginPath(); g.moveTo(0, 40); g.bezierCurveTo(30, 28, 40, 10, 14, 0); g.bezierCurveTo(-14, -10, -22, -28, 8, -40); g.bezierCurveTo(24, -46, 40, -40, 46, -30); g.stroke();
  g.strokeStyle = col; g.lineWidth = 8; g.stroke();
  g.fillStyle = col; g.beginPath(); g.moveTo(46, -30); g.lineTo(62, -36); g.lineTo(58, -24); g.lineTo(66, -22); g.lineTo(50, -16); g.closePath(); g.fill(); g.strokeStyle = sh(col, -0.5); g.lineWidth = 1.5; g.stroke();
  g.fillStyle = '#d82a22'; g.beginPath(); g.arc(54, -29, 2.2, 0, TAU); g.fill();
  g.strokeStyle = col; g.lineWidth = 2; for (const [a, b] of [[20, 20], [-6, -8], [14, -34]]) { g.beginPath(); g.moveTo(a, b); g.lineTo(a - 12, b + 8); g.lineTo(a - 6, b - 8); g.stroke(); }
  g.restore();
}
function stoneLion(c, x, base, s = 1, flip = 1) {
  const g = c.g; g.save(); g.translate(x, base); g.scale(s * flip, s); g.fillStyle = grad(g, -22, 0, 22, 0, [[0, '#9a9a96'], [1, '#52524e']]); g.fillRect(-22, -14, 44, 14); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(-22, -14, 44, 2);
  g.fillStyle = grad(g, -16, 0, 16, 0, [[0, '#b8b8b2'], [1, '#6a6a66']]); g.beginPath(); g.moveTo(-14, -14); g.quadraticCurveTo(-18, -40, -6, -52); g.quadraticCurveTo(6, -62, 14, -48); g.quadraticCurveTo(12, -30, 14, -14); g.closePath(); g.fill();
  g.fillStyle = '#c0c0ba'; g.beginPath(); g.arc(4, -54, 11, 0, TAU); g.fill(); g.fillStyle = '#7a7a76'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(-4 + i * 3, -64 + (i % 2) * 3, 4, 0, TAU); g.fill(); }
  g.fillStyle = '#20201c'; g.beginPath(); g.arc(9, -56, 1.6, 0, TAU); g.arc(1, -56, 1.6, 0, TAU); g.fill(); g.fillStyle = '#8a8a86'; g.beginPath(); g.ellipse(5, -49, 5, 3, 0, 0, TAU); g.fill();
  g.restore();
}

KINDS.chinese = {
  doorX: 640, scale: 2.3,
  build(c) {
    const g = c.g;
    // donkere achterwand + bovenverdieping
    plaster(g, 220, 250, 840, B - 250, '#8a1418', { stains: 8 }); wallAO(g, 220, 250, 840, B - 250, { top: 0.35, bot: 0.35, side: 0.25 });
    g.fillStyle = 'rgba(0,0,0,.18)'; for (let x = 232; x < 1060; x += 38) g.fillRect(x, 252, 2, B - 252);
    // gouden kolommen
    for (const x of [244, 420, 560, 720, 860, 1036]) { g.fillStyle = grad(g, x - 9, 0, x + 9, 0, [[0, '#f0d070'], [0.5, '#c09030'], [1, '#6a4a10']]); g.fillRect(x - 9, 340, 18, B - 340); g.fillStyle = '#6a1010'; g.fillRect(x - 12, 336, 24, 10); g.fillRect(x - 12, B - 12, 24, 12); }
    // roosterramen bovenverdieping en begane grond
    for (const x of [270, 340]) lattice(c, x, 276, 56, 60, { n: 3 }); for (const x of [880, 950]) lattice(c, x, 276, 56, 60, { n: 3 });
    lattice(c, 436, 456, 110, 100, { n: 5 }); lattice(c, 734, 456, 110, 100, { n: 5 }); lattice(c, 264, 456, 130, 100, { n: 6 }); lattice(c, 886, 456, 130, 100, { n: 6 });
    // houten bord GOUDEN DRAAK
    g.fillStyle = 'rgba(0,0,0,.4)'; rr(g, 476, 262, 330, 62, 8); g.fill(); g.fillStyle = grad(g, 0, 258, 0, 318, [[0, '#2a0808'], [1, '#100303']]); rr(g, 472, 258, 330, 62, 8); g.fill(); g.strokeStyle = '#d8b040'; g.lineWidth = 4; g.stroke(); g.strokeStyle = 'rgba(216,176,64,.5)'; g.lineWidth = 1.5; rr(g, 480, 266, 314, 46, 5); g.stroke();
    txt(g, c.spec.sign || 'GOUDEN DRAAK', 637, 291, 32, '#f0c850', { fit: 290, spacing: 3, shadow: 'rgba(0,0,0,.6)', blur: 2, sy: 2 });
    emit(c, (e) => { e.save(); e.globalCompositeOperation = 'lighter'; txt(e, c.spec.sign || 'GOUDEN DRAAK', 637, 291, 32, 'rgba(255,200,80,.35)', { fit: 290, spacing: 3, shadow: '#ffb030', blur: 16, sy: 0 }); e.restore(); });
    dragon(c, 440, 290, 0.85, -1); dragon(c, 834, 290, 0.85, 1);
    // dakpartijen
    cnRoof(c, 150, 1130, 332, 78, 100, '#2f6a5a', { fascia: '#a8181c' });
    cnRoof(c, 190, 1090, 120, 124, 190, '#2f6a5a', { fascia: '#a8181c', tw: 16, th: 10 });
    for (const [x, y] of [[330, 112], [950, 112]]) { /* piepjes */ }
    smoke(c, 940, 140, { n: 9, rise: 120, drift: 50, size: 9, a: 0.4 });
    // lantaarns langs de dakrand
    for (let i = 0; i < 9; i++) { const lx = 224 + i * 100 + (i > 4 ? 0 : 0); lantern(c, lx, 372, 12, '#d8221c', { glow: 3.2 }); }
    for (const x of [300, 980]) lantern(c, x, 250, 14, '#e8301c', { glow: 3.5 });
    // deur met pilaren
    g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(586, B - 176, 108, 176); g.fillStyle = '#f0d070'; g.fillRect(578, B - 184, 124, 10); g.fillRect(578, B - 184, 8, 184); g.fillRect(694, B - 184, 8, 184);
    stoneStep(c, 640, 130, B, 2); stoneLion(c, 556, B + 6, 1.1, 1); stoneLion(c, 724, B + 6, 1.1, -1);
    // OPEN neon + menubord
    g.fillStyle = '#12080a'; rr(g, 290, 520, 90, 30, 6); g.fill(); neonText(c, 'OPEN', 335, 536, 22, '#ff4a3a', { spacing: 3 }); flicker(c, 292, 522, 86, 26, 7, { rate: 6, depth: 0.7 });
    g.fillStyle = '#2a1a10'; g.fillRect(900, 500, 80, 70); g.fillStyle = '#f4e8c8'; g.fillRect(906, 506, 68, 58); g.fillStyle = '#6a2a1a'; for (let i = 0; i < 6; i++) g.fillRect(912, 514 + i * 8, 40 + (i % 3) * 6, 2.5);
    lampPost(c, 150, 668, 190, { arm: 16, col: '#ffd890' }); lampPost(c, 1140, 668, 190, { arm: -16, col: '#ffd890' });
    for (const x of [200, 1090]) { g.fillStyle = '#7a3a1a'; rr(g, x - 20, 618, 40, 34, 4); g.fill(); bush(c, x, 620, 46, 40, '#2f7a3a'); }
    bike(c, 1180, 662, 1.1, '#2a6a4a');
    c.door = { x: 640, y: B, w: 108, h: 176, type: 'double', style: 'red', col: '#a8181c', int: 'warm' };
  },
};

KINDS.hutong = {
  doorX: 640, scale: 2.3,
  build(c) {
    const g = c.g;
    // grote boom (ginkgo) en hal achter de muur
    tree(c, 170, 440, 300, { col: '#d8b030', wide: 0.34 });
    cnRoof(c, 120, 520, 220, 120, 80, '#4a4e56', { fascia: '#6a1410', tw: 13, th: 8, tip: 26 });
    g.fillStyle = '#7a1c14'; g.fillRect(150, 340, 340, 80); for (let i = 0; i < 5; i++) { g.fillStyle = '#5a1008'; g.fillRect(168 + i * 74, 340, 14, 80); } lattice(c, 200, 352, 60, 56, { n: 3 }); lattice(c, 380, 352, 60, 56, { n: 3 });
    cnRoof(c, 760, 1160, 240, 110, 80, '#4a4e56', { fascia: '#6a1410', tw: 13, th: 8, tip: 26 });
    g.fillStyle = '#7a1c14'; g.fillRect(790, 350, 340, 70); lattice(c, 830, 360, 60, 50, { n: 3 }); lattice(c, 1020, 360, 60, 50, { n: 3 });
    // grijze bakstenen muur
    bricks(g, 0, 410, 1280, B - 410, { base: '#7a7a78', mortar: '#9a9a96', bw: 26, bh: 10, v: 0.1 }); wallAO(g, 0, 410, 1280, B - 410, { top: 0.4, bot: 0.4, side: 0.0 });
    g.fillStyle = '#4a4a4e'; g.fillRect(0, 398, 1280, 14); g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(0, 398, 1280, 2); g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(0, 412, 1280, 5);
    for (const x of [120, 300, 980, 1160]) { g.fillStyle = '#4a4a4e'; g.fillRect(x - 24, 392, 48, 8); }
    // poort: pilaren, balk, dak
    for (const x of [548, 732]) { g.fillStyle = grad(g, x - 12, 0, x + 12, 0, [[0, '#c03020'], [0.5, '#8a1c14'], [1, '#4a0a08']]); g.fillRect(x - 12, 340, 24, B - 340); g.fillStyle = '#d8b040'; g.fillRect(x - 15, 336, 30, 8); g.fillRect(x - 15, B - 14, 30, 14); }
    g.fillStyle = '#7a1810'; g.fillRect(534, 330, 232, 34); g.fillStyle = '#d8b040'; g.fillRect(534, 362, 232, 4); for (let i = 0; i < 9; i++) { g.fillStyle = i % 2 ? '#2a6a5a' : '#c8a030'; g.fillRect(540 + i * 25, 336, 18, 10); }
    cnRoof(c, 470, 830, 252, 82, 90, '#4a4e56', { fascia: '#7a1410', tw: 12, th: 8, tip: 22 });
    // poortdeur
    g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(588, B - 170, 124, 170); g.fillStyle = '#c8a030'; g.fillRect(584, B - 176, 132, 8); stoneStep(c, 650, 140, B, 2);
    for (const [x, s] of [[520, 1], [780, -1]]) { stoneLion(c, x, B + 6, 1.05, s); }
    lantern(c, 566, 392, 15, '#d8221c', { glow: 4 }); lantern(c, 734, 392, 15, '#d8221c', { glow: 4 });
    for (const x of [380, 920]) lantern(c, x, 440, 12, '#e8301c', { glow: 3.6 });
    // binnenplaats: stenen potten en bomen
    for (const x of [210, 1070]) { g.fillStyle = '#6a6a66'; rr(g, x - 28, 640, 56, 44, 5); g.fill(); g.fillStyle = '#3a2a1c'; g.fillRect(x - 26, 640, 52, 7); } tree(c, 210, 644, 150, { type: 'round', col: '#d8a030', wide: 0.34 }); tree(c, 1070, 644, 140, { col: '#4a8a3a', wide: 0.34 });
    for (let i = 0; i < 3; i++) { g.fillStyle = '#7a4a26'; rr(g, 380 + i * 24, 664 - (i % 2) * 6, 22, 16, 3); g.fill(); }
    c.door = { x: 650, y: B, w: 118, h: 168, type: 'double', style: 'red', col: '#a8181c', int: 'dark' };
  },
};

KINDS.apartment = {
  doorX: 640, scale: 2.3,
  build(c) {
    const g = c.g;
    // buren links en rechts
    for (const [x0, x1, top, col] of [[-10, 290, 230, '#8a8a84'], [990, 1290, 280, '#7e7e7c']]) { concrete(g, x0, top, x1 - x0, B - top, { base: col, stains: 10, cracks: 5 }); wallAO(g, x0, top, x1 - x0, B - top, { top: 0.3 }); for (let r = 0; r < 5; r++) for (let k = 0; k < 3; k++) win(c, x0 + 30 + k * 90, top + 24 + r * 66, 46, 44, { frame: '#cfcfc8', p: 0.45, lc: pick(['#ffd890', '#fff0d0', '#c8e8ff']), f: 3, rows: 1, cols: 2, sill: true }); }
    // hoofdflat
    const x0 = 310, x1 = 970, top = 40;
    concrete(g, x0, top, x1 - x0, B - top, { base: '#b4b0a6', stains: 26, cracks: 8, panels: 110 }); wallAO(g, x0, top, x1 - x0, B - top, { top: 0.25, bot: 0.4, side: 0.3 });
    g.fillStyle = '#6a6a66'; g.fillRect(x0 - 8, top - 10, x1 - x0 + 16, 12); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x0 - 8, top - 10, x1 - x0 + 16, 2);
    const cols = 6, rows = 9;
    for (let r = 0; r < rows; r++) {
      const wy = 70 + r * 56;
      g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x0, wy + 50, x1 - x0, 4); g.fillStyle = 'rgba(255,255,255,.16)'; g.fillRect(x0, wy + 54, x1 - x0, 2);
      for (let k = 0; k < cols; k++) {
        const wx = x0 + 28 + k * 104; const balc = (r + k) % 3 === 0;
        win(c, wx, wy, 52, 40, { frame: '#e8e4da', p: 0.5, lc: pick(['#ffd890', '#fff0d0', '#ffe0a0', '#d8f0ff']), f: 3, cols: 2, rows: 1, sill: false });
        if (balc) { g.fillStyle = '#3a3a3a'; g.fillRect(wx - 6, wy + 30, 64, 3); g.strokeStyle = '#4a4a4a'; g.lineWidth = 1.2; for (let b = 0; b < 12; b++) { g.beginPath(); g.moveTo(wx - 4 + b * 5.4, wy + 33); g.lineTo(wx - 4 + b * 5.4, wy + 50); g.stroke(); } g.fillRect(wx - 6, wy + 50, 64, 3); }
        if ((r * 7 + k * 3) % 5 === 1) { g.fillStyle = '#d8d8d4'; rr(g, wx + 8, wy + 56 - 14, 40, 14, 2); g.fill(); g.fillStyle = '#9a9a96'; g.beginPath(); g.arc(wx + 18, wy + 49, 5, 0, TAU); g.fill(); g.fillStyle = '#6a6a66'; g.fillRect(wx + 8, wy + 56, 40, 2); } // airco
        if ((r * 5 + k) % 7 === 2) { g.strokeStyle = '#5a5a58'; g.lineWidth = 1; g.beginPath(); g.moveTo(wx - 8, wy + 8); g.lineTo(wx + 60, wy + 8); g.stroke(); for (let q = 0; q < 4; q++) { g.fillStyle = pick(['#e84a4a', '#f0f0f0', '#4a8ad8', '#f0c02a']); g.fillRect(wx - 4 + q * 15, wy + 8, 11, 18); } } // wasgoed
      }
    }
    // dakopbouw: watertank, schotelantennes
    g.fillStyle = '#7a7a78'; rr(g, 420, -10, 70, 50, 6); g.fill(); g.fillStyle = '#9a9a96'; g.fillRect(430, -4, 50, 4); g.fillRect(520, 20, 60, 20); g.beginPath(); g.ellipse(840, 22, 20, 12, 0.3, 0, TAU); g.fill();
    // entree met afdak, brievenbussen en rode lantaarn
    g.fillStyle = '#4a4a4c'; g.fillRect(560, B - 190, 160, 8); g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(560, B - 182, 160, 6); g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(594, B - 168, 92, 168); g.fillStyle = '#8a8a86'; g.fillRect(566, B - 164, 24, 90); g.fillStyle = '#4a6a8a'; for (let r = 0; r < 6; r++) for (let q = 0; q < 2; q++) g.fillRect(568 + q * 10, B - 160 + r * 14, 8, 11);
    sign(c, 590, B - 188, 100, 16, '12', { bg: '#a8181c', fg: '#ffe8a0', size: 12, shadow: false, bolts: false, r: 2 }); lantern(c, 706, B - 160, 11, '#d8221c', { glow: 4 }); lantern(c, 574, B - 160, 11, '#d8221c', { glow: 4 }); stoneStep(c, 640, 110, B, 2);
    // scooters en fietsen op het trottoir
    for (const [x, col, f] of [[360, '#2a6aa8', 1], [430, '#c82a2a', -1], [900, '#2a8a4a', 1], [1000, '#e8c02a', -1]]) {
      g.save(); g.translate(x, 636); g.scale(f, 1); g.fillStyle = '#16181c'; for (const wx of [-22, 22]) { g.beginPath(); g.arc(wx, -12, 12, 0, TAU); g.fill(); g.fillStyle = '#9aa0a8'; g.beginPath(); g.arc(wx, -12, 5, 0, TAU); g.fill(); g.fillStyle = '#16181c'; }
      g.fillStyle = col; rr(g, -26, -34, 44, 22, 8); g.fill(); g.fillRect(14, -52, 5, 40); g.fillStyle = '#1a1c20'; rr(g, -16, -40, 26, 8, 4); g.fill(); g.restore(); }
    // elektriciteitsdraden
    g.strokeStyle = 'rgba(10,10,14,.8)'; g.lineWidth = 1.6; for (const [ya, yb, off] of [[330, 372, 0], [346, 390, 10]]) { g.beginPath(); g.moveTo(0, ya); g.quadraticCurveTo(160, yb, 310, ya - 70 + off); g.stroke(); g.beginPath(); g.moveTo(970, ya - 60 + off); g.quadraticCurveTo(1130, yb + 10, 1280, ya - 20); g.stroke(); }
    lampPost(c, 250, 668, 200, { arm: 16, col: '#ffe0a0' }); lampPost(c, 1060, 668, 200, { arm: -16, col: '#ffe0a0' });
    c.door = { x: 640, y: B, w: 88, h: 166, type: 'hinge', style: 'steel', col: '#6a7a8a', int: 'dark' };
  },
};

KINDS.teashop = {
  doorX: 640, scale: 2.3,
  build(c) {
    const g = c.g;
    // twee verdiepingen: witte pleisterwand met donker houtskelet
    plaster(g, 240, 300, 800, B - 300, '#e4dcc8', { stains: 10 }); wallAO(g, 240, 300, 800, B - 300, { top: 0.35, bot: 0.35, side: 0.2 });
    for (const x of [240, 410, 560, 720, 870, 1030]) { wood(g, x - 8, 300, 16, B - 300, { base: '#4a2c1a', vert: true, pw: 8 }); }
    wood(g, 240, 420, 800, 14, { base: '#4a2c1a', pw: 7 }); wood(g, 240, 300, 800, 12, { base: '#4a2c1a', pw: 6 });
    for (const x of [300, 480, 760, 940]) lattice(c, x, 336, 70, 68, { n: 4, frame: '#3a2012' });
    // winkelpui: houten rooster met lichte binnenkant en theeblikken
    const sx0 = 250, sy0 = 448, sw0 = 290;
    for (const sx of [250, 740]) { g.fillStyle = '#2a1a10'; g.fillRect(sx, 448, 290, 148); g.fillStyle = '#12080a'; g.fillRect(sx + 6, 454, 278, 136);
      const body = (e, a) => { e.save(); e.globalAlpha = a; e.fillStyle = grad(e, 0, 454, 0, 590, [[0, '#ffe0a8'], [1, '#c8802a']]); e.fillRect(sx + 6, 454, 278, 136); for (let r = 0; r < 3; r++) { const yy = 490 + r * 40; e.fillStyle = '#5a3a1a'; e.fillRect(sx + 10, yy, 270, 4); for (let q = 0; q < 14; q++) { e.fillStyle = pick(['#c8302a', '#2a6a4a', '#d8a02a', '#8a4a2a', '#e8e0c8', '#3a5a8a']); e.fillRect(sx + 14 + q * 19, yy - 24, 15, 24); e.fillStyle = 'rgba(0,0,0,.25)'; e.fillRect(sx + 14 + q * 19, yy - 24, 15, 4); } } e.restore(); };
      if (c.lit) c.E.push((e) => { body(e, 1); e.strokeStyle = '#3a2012'; e.lineWidth = 3; e.beginPath(); for (let i = 1; i < 6; i++) { e.moveTo(sx + 6 + i * 46, 454); e.lineTo(sx + 6 + i * 46, 590); } e.stroke(); glowAt(e, sx + 145, 520, 220, '#ffc060', 0.25); }); else { body(g, 0.35); }
      g.strokeStyle = '#3a2012'; g.lineWidth = 3; g.beginPath(); for (let i = 1; i < 6; i++) { g.moveTo(sx + 6 + i * 46, 454); g.lineTo(sx + 6 + i * 46, 590); } g.stroke(); }
    // dak met opgekrulde hoeken
    cnRoof(c, 200, 1080, 190, 112, 220, '#4a5a6a', { fascia: '#5a2a18', orn: '#c8a030' });
    g.fillStyle = '#4a2c1a'; g.fillRect(240, 300, 800, 8);
    // verticaal houten uithangbord THEE
    g.strokeStyle = '#2a1a10'; g.lineWidth = 4; g.beginPath(); g.moveTo(1040, 322); g.lineTo(1100, 322); g.stroke();
    g.fillStyle = 'rgba(0,0,0,.35)'; rr(g, 1068, 328, 56, 130, 5); g.fill(); g.fillStyle = grad(g, 1064, 0, 1120, 0, [[0, '#8a1c14'], [1, '#5a0e0a']]); rr(g, 1064, 324, 56, 130, 5); g.fill(); g.strokeStyle = '#d8b040'; g.lineWidth = 3; g.stroke();
    (c.spec.sign || 'THEE').slice(0, 4).split('').forEach((ch, i) => txt(g, ch, 1092, 350 + i * 30, 26, '#f0c850', { shadow: 'rgba(0,0,0,.5)', blur: 2, sy: 1 }));
    emit(c, (e) => { glowAt(e, 1092, 390, 120, '#ff6030', 0.18); });
    sign(c, 470, 312, 340, 40, (c.spec.sign || 'THEE') + 'WINKEL', { bg: '#4a1810', fg: '#f0c850', rim: '#d8b040', size: 26, spacing: 3, lit: true, lightText: true, r: 5 });
    // stoep, deur
    g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(588, B - 170, 104, 170); g.fillStyle = '#4a2c1a'; g.fillRect(580, B - 178, 120, 10); stoneStep(c, 640, 120, B, 2);
    // lantaarnslinger over de straat
    g.strokeStyle = 'rgba(30,20,10,.9)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, 240); g.quadraticCurveTo(320, 330, 640, 300); g.quadraticCurveTo(960, 270, 1280, 200); g.stroke();
    for (let i = 0; i < 12; i++) { const k = (i + 0.5) / 12; const lx = 1280 * k, ly = k < 0.5 ? lerp(240, 300, Math.sin(k * Math.PI)) + 16 : lerp(300, 200, k - 0.5) + 30; lantern(c, lx, 280 + Math.sin(k * 7) * 12 + (k < 0.5 ? k * 60 : (1 - k) * 60), 11, i % 2 ? '#d8221c' : '#e89a1c', { glow: 3.4 }); }
    // kraampjes met gestreepte luifels
    for (const [x0, col, dir] of [[40, '#c82a2a', 1], [1060, '#2a7a4a', -1]]) {
      g.fillStyle = '#4a2c1a'; g.fillRect(x0 + 4, 470, 6, 160); g.fillRect(x0 + 164, 470, 6, 160); g.fillStyle = '#6a4a2a'; g.fillRect(x0, 590, 176, 40); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x0, 590, 176, 5);
      for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f4f0e4' : col; g.beginPath(); g.moveTo(x0 - 6 + i * 23, 458); g.lineTo(x0 + 17 + i * 23, 458); g.lineTo(x0 + 17 + i * 23, 484); g.arc(x0 + 5.5 + i * 23, 484, 11.5, 0, Math.PI); g.lineTo(x0 - 6 + i * 23, 458); g.fill(); }
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x0 - 6, 458, 190, 4);
      for (let i = 0; i < 7; i++) { g.fillStyle = pick(['#c8302a', '#2a6a4a', '#d8a02a', '#8a4a2a', '#e8e0c8']); g.fillRect(x0 + 12 + i * 22, 570, 18, 20); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x0 + 12 + i * 22, 570, 18, 4); }
      g.fillStyle = '#c89030'; g.beginPath(); g.ellipse(x0 + 60, 590, 24, 8, 0, 0, TAU); g.fill(); g.fillStyle = '#e8d8b0'; g.beginPath(); g.ellipse(x0 + 60, 586, 20, 6, 0, 0, TAU); g.fill();
      lantern(c, x0 + 88, 500, 12, '#e8301c', { glow: 4 });
    }
    // theepot-stoom en kratten
    smoke(c, 1000, 590, { n: 6, rise: 60, drift: 8, size: 6, a: 0.3 });
    crate(g, 560, B + 36, 54, 40, '#8a6a3a'); crate(g, 660, B + 36, 54, 40, '#7a5a2e'); crate(g, 580, B - 4, 40, 34, '#9a7a46');
    barrel(g, 1010, B + 6, 36, 52, '#6a4a2a');
    c.door = { x: 640, y: B, w: 100, h: 168, type: 'double', style: 'wood', col: '#5a3418', int: 'warm' };
  },
};

KINDS.electronics = {
  doorX: 800, scale: 2.3,
  build(c) {
    const g = c.g;
    // zijgevels (donker) en hoofdwand van metalen panelen
    for (const [x0, x1] of [[0, 150], [1130, 1280]]) { concrete(g, x0, 300, x1 - x0, B - 300, { base: '#555a64', panels: 60 }); wallAO(g, x0, 300, x1 - x0, B - 300); for (let y = 330; y < B - 40; y += 50) win(c, x0 + 50, y, 40, 24, { frame: '#8a909a', p: 0.35, lc: '#8ad8ff', f: 3, rows: 1 }); }
    concrete(g, 140, 230, 1000, B - 230, { base: '#3a3e48', panels: 50, cracks: 0, stains: 6 }); wallAO(g, 140, 230, 1000, B - 230, { top: 0.4, bot: 0.4, side: 0.3 });
    g.fillStyle = '#20232a'; g.fillRect(130, 220, 1020, 14); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(130, 220, 1020, 2);
    // LED-strips verticaal
    for (const x of [160, 700, 1118]) { g.fillStyle = '#16181e'; g.fillRect(x - 5, 234, 10, B - 234); emit(c, (e) => { e.save(); e.shadowColor = '#30d8ff'; e.shadowBlur = 14; e.fillStyle = '#7ae8ff'; e.fillRect(x - 1.5, 240, 3, B - 246); e.restore(); }); }
    // groot bord ELECTRO
    g.fillStyle = '#0c0e14'; rr(g, 270, 250, 560, 96, 12); g.fill(); g.strokeStyle = '#2a2e38'; g.lineWidth = 4; g.stroke();
    neonText(c, c.spec.sign || 'ELECTRO', 550, 296, 80, '#30d8ff', { fit: 480, spacing: 8 }); flicker(c, 290, 262, 520, 72, 12, { rate: 4.3, depth: 0.55, double: true });
    g.fillStyle = '#ff30a8'; g.fillRect(290, 334, 520, 4); emit(c, (e) => { e.save(); e.shadowColor = '#ff30a8'; e.shadowBlur = 16; e.fillStyle = '#ff7ac8'; e.fillRect(290, 334, 520, 3); e.restore(); });
    for (const [x, col] of [[250, '#ff30a8'], [850, '#ffd030']]) { g.fillStyle = '#16181e'; g.fillRect(x - 3, 250, 6, 96); emit(c, (e) => { e.save(); e.shadowColor = col; e.shadowBlur = 14; e.fillStyle = col; e.fillRect(x - 1.5, 254, 3, 88); e.restore(); }); }
    // schermenmuur: grote etalage
    const vx = 190, vy = 380, vw = 480, vh = 210; g.fillStyle = '#16181e'; g.fillRect(vx - 6, vy - 6, vw + 12, vh + 12); g.fillStyle = '#05060a'; g.fillRect(vx, vy, vw, vh);
    const cols = 6, rows = 3, cw = vw / cols, ch = vh / rows;
    c.D.push((gg, t) => { gg.save(); for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) { const ph = t * 0.8 + k * 0.7 + r * 1.3, hue = (ph * 40 + (k * 50 + r * 90)) % 360, x = vx + k * cw, y = vy + r * ch; gg.fillStyle = `hsl(${hue},70%,${c.lit ? 52 : 40}%)`; gg.fillRect(x + 3, y + 3, cw - 6, ch - 6); const sweep = ((t * 90 + k * 23 + r * 41) % (cw + 40)) - 20; gg.fillStyle = 'rgba(255,255,255,.28)'; gg.fillRect(x + 3 + Math.max(0, sweep - 14), y + 3, 14, ch - 6); gg.fillStyle = `hsla(${(hue + 120) % 360},80%,70%,.8)`; gg.beginPath(); gg.arc(x + cw / 2, y + ch / 2, ((t * 17 + k * 9 + r * 13) % 18) + 4, 0, TAU); gg.fill(); gg.fillStyle = 'rgba(0,0,0,.18)'; for (let q = 4; q < ch - 4; q += 4) gg.fillRect(x + 3, y + q, cw - 6, 1); } gg.globalCompositeOperation = 'lighter'; if (c.lit) { gg.fillStyle = grad(gg, 0, vy + vh, 0, vy + vh + 50, [[0, 'rgba(120,160,255,.22)'], [1, 'rgba(120,160,255,0)']]); gg.fillRect(vx, vy + vh, vw, 50); } gg.restore(); });
    // rechter etalage met producten
    const rx = 860, ry = 390, rw = 250, rh = 200; g.fillStyle = '#16181e'; g.fillRect(rx - 6, ry - 6, rw + 12, rh + 12); g.fillStyle = '#0a0c12'; g.fillRect(rx, ry, rw, rh);
    const prod = (e, a) => { e.save(); e.globalAlpha = a; e.fillStyle = grad(e, 0, ry, 0, ry + rh, [[0, '#c8d8ff'], [1, '#6a78a8']]); e.fillRect(rx, ry, rw, rh); for (let r = 0; r < 3; r++) { const yy = ry + 60 + r * 62; e.fillStyle = '#2a2e38'; e.fillRect(rx + 8, yy, rw - 16, 5); for (let q = 0; q < 5; q++) { const px = rx + 20 + q * 46; if ((q + r) % 3 === 0) { e.fillStyle = '#1a1c22'; e.fillRect(px, yy - 38, 38, 26); e.fillStyle = '#58c8ff'; e.fillRect(px + 3, yy - 35, 32, 20); e.fillStyle = '#2a2e38'; e.fillRect(px - 4, yy - 12, 46, 6); } else if ((q + r) % 3 === 1) { e.fillStyle = '#1a1c22'; rr(e, px + 10, yy - 40, 18, 34, 3); e.fill(); e.fillStyle = '#ff7ac8'; e.fillRect(px + 12, yy - 36, 14, 24); } else { e.fillStyle = '#1a1c22'; e.beginPath(); e.arc(px + 19, yy - 18, 14, 0, TAU); e.fill(); e.fillStyle = '#3a4a6a'; e.beginPath(); e.arc(px + 19, yy - 18, 7, 0, TAU); e.fill(); } } } e.restore(); };
    if (c.lit) c.E.push((e) => { prod(e, 1); glowAt(e, rx + rw / 2, ry + rh / 2, 220, '#9ab8ff', 0.18); }); else prod(g, 0.4);
    // deur + camera's
    g.fillStyle = '#20232a'; g.fillRect(722, B - 196, 156, 8); g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(724, B - 188, 152, 188);
    g.fillStyle = '#1a1c22'; g.fillRect(1040, 280, 4, 70); rr(g, 1030, 340, 24, 14, 4); g.fill(); g.fillStyle = '#4a4e58'; g.fillRect(1026, 336, 32, 5);
    g.fillStyle = '#1a1c22'; g.fillRect(150, 330, 4, 60); rr(g, 138, 384, 24, 14, 4); g.fill();
    c.D.push((gg, t) => { if (Math.sin(t * 3) > 0) { gg.fillStyle = '#ff2a2a'; gg.beginPath(); gg.arc(1050, 347, 2.4, 0, TAU); gg.arc(158, 391, 2.4, 0, TAU); gg.fill(); glowAt(gg, 1050, 347, 18, '#ff2a2a', 0.6); glowAt(gg, 158, 391, 18, '#ff2a2a', 0.6); } });
    // roosterlaser bij de ingang (alleen dynamisch, vaag)
    c.D.push((gg, t) => { if (!c.lit) return; gg.save(); gg.globalCompositeOperation = 'lighter'; gg.strokeStyle = 'rgba(255,40,40,.12)'; gg.lineWidth = 1; for (let i = 0; i < 4; i++) { const y = 470 + i * 34 + Math.sin(t * 1.4 + i) * 6; gg.beginPath(); gg.moveTo(724, y); gg.lineTo(876, y); gg.stroke(); } gg.restore(); });
    // straat: lantaarn en neonreflecties
    lampPost(c, 100, 668, 230, { arm: 18, col: '#ff90e0', r: 140 }); lampPost(c, 1180, 668, 230, { arm: -18, col: '#90e0ff', r: 140 });
    if (c.lit) c.E.push((e) => { e.save(); e.globalCompositeOperation = 'lighter'; for (const [x, col, w] of [[550, '#30d8ff', 300], [430, '#ff30a8', 120], [980, '#8ab0ff', 200], [800, '#30d8ff', 90]]) { e.fillStyle = grad(e, 0, B, 0, 715, [[0, al(col, 0.25)], [1, al(col, 0)]]); e.fillRect(x - w / 2, B + 8, w, 115); } e.restore(); });
    c.door = { x: 800, y: B, w: 148, h: 186, type: 'slide', style: 'glass', int: 'cool' };
  },
};

KINDS.warehouse = {
  doorX: 330, scale: 2.3,
  build(c) {
    const g = c.g;
    // hek links en rechts
    fenceMesh(c, 0, 120, 640, 60); fenceMesh(c, 1160, 1280, 640, 60);
    // hoofdwand van golfplaat, betonnen plint
    corrugated(g, 100, 250, 1080, B - 250, { base: '#8d9aa6', rust: 18 }); wallAO(g, 100, 250, 1080, B - 250, { top: 0.4, bot: 0.35, side: 0.2 });
    concrete(g, 100, B - 40, 1080, 40, { base: '#8a8a88', cracks: 3 }); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(100, B - 42, 1080, 4);
    // dak: rand, ventilatiekappen
    g.fillStyle = '#5a636c'; g.fillRect(90, 238, 1100, 16); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(90, 238, 1100, 2); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(90, 254, 1100, 6);
    for (const x of [250, 450, 650, 850, 1030]) { g.fillStyle = grad(g, x - 20, 0, x + 20, 0, [[0, '#aab4bc'], [1, '#5a636c']]); g.fillRect(x - 18, 206, 36, 32); g.beginPath(); g.ellipse(x, 206, 22, 8, 0, 0, TAU); g.fillStyle = '#7a848c'; g.fill(); }
    smoke(c, 450, 200, { n: 7, rise: 100, drift: 30, size: 8, a: 0.3 });
    // BUDDLEY-bord
    g.fillStyle = 'rgba(0,0,0,.3)'; rr(g, 560, 272, 540, 92, 10); g.fill();
    g.fillStyle = grad(g, 0, 268, 0, 360, [[0, '#2a5ab0'], [1, '#143a78']]); rr(g, 556, 268, 540, 92, 10); g.fill(); g.strokeStyle = '#d8d8e0'; g.lineWidth = 4; g.stroke();
    g.fillStyle = '#ffd02a'; g.beginPath(); g.arc(626, 314, 34, 0, TAU); g.fill(); txt(g, 'B', 626, 316, 46, '#143a78');
    txt(g, c.spec.sign || 'BUDDLEY', 860, 316, 64, '#ffffff', { fit: 370, spacing: 5, shadow: 'rgba(0,0,0,.4)', blur: 3, sy: 2 });
    emit(c, (e) => { glowAt(e, 826, 314, 340, '#4a88ff', 0.2); e.save(); e.globalCompositeOperation = 'lighter'; txt(e, c.spec.sign || 'BUDDLEY', 860, 316, 64, 'rgba(255,255,255,.35)', { fit: 370, spacing: 5, shadow: '#7ab0ff', blur: 14, sy: 0 }); e.restore(); });
    // laaddokken met oprolbare deuren
    const dock = [[480, true], [630, false], [780, false], [930, false]];
    for (const [cx, open] of dock) {
      const x0 = cx - 62, y0 = 424;
      g.fillStyle = '#20252b'; g.fillRect(x0 - 8, y0 - 8, 140, B - y0 + 8 - 36);
      if (open) { g.fillStyle = '#07080b'; g.fillRect(x0, y0, 124, 126); g.fillStyle = grad(g, 0, y0, 0, y0 + 126, [[0, 'rgba(0,0,0,.7)'], [1, 'rgba(60,50,30,.3)']]); g.fillRect(x0, y0, 124, 126); for (let i = 0; i < 3; i++) box(g, x0 + 10 + i * 34, y0 + 126, 28, 26 + (i % 2) * 18, '#8a6a3a'); g.fillStyle = '#aab4bc'; g.fillRect(x0, y0, 124, 26); for (let y = y0; y < y0 + 26; y += 5) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x0, y, 124, 1.2); } if (c.lit) c.E.push((e) => { e.save(); e.fillStyle = grad(e, 0, y0 + 26, 0, y0 + 126, [[0, 'rgba(255,214,140,.5)'], [1, 'rgba(255,214,140,.1)']]); e.fillRect(x0, y0 + 26, 124, 100); e.restore(); }); }
      else { g.fillStyle = grad(g, x0, 0, x0 + 124, 0, [[0, '#b4bcc4'], [0.5, '#cfd5da'], [1, '#98a0a8']]); g.fillRect(x0, y0, 124, 126); g.fillStyle = 'rgba(0,0,0,.3)'; for (let y = y0 + 6; y < y0 + 126; y += 9) g.fillRect(x0, y, 124, 1.6); g.fillStyle = 'rgba(255,255,255,.2)'; for (let y = y0 + 7; y < y0 + 126; y += 9) g.fillRect(x0, y, 124, 1); g.fillStyle = '#3a3e44'; g.fillRect(cx - 8, y0 + 112, 16, 8); }
      g.fillStyle = '#e0b81a'; for (let i = 0; i < 6; i++) poly(g, [x0 - 8 + i * 24, B - 36, x0 + 6 + i * 24, B - 36, x0 + 20 + i * 24, B - 24, x0 + 6 + i * 24, B - 24]), g.fill(); g.fillStyle = '#20252b'; g.fillRect(x0 - 8, B - 36, 140, 2);
      g.fillStyle = '#1a1c20'; g.fillRect(x0 - 14, y0 + 70, 8, 40); g.fillRect(x0 + 130, y0 + 70, 8, 40); g.fillStyle = '#d8c020'; g.fillRect(x0 - 14, y0 + 70, 8, 4);
      g.fillStyle = '#1f7a3a'; rr(g, cx - 12, y0 - 24, 24, 14, 2); g.fill(); txt(g, String(dock.findIndex((d) => d[0] === cx) + 1), cx, y0 - 17, 11, '#fff');
    }
    // personeelsdeur (links) met groene noodverlichting
    g.fillStyle = '#20252b'; g.fillRect(274, B - 182, 112, 182); g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(280, B - 176, 100, 176);
    sign(c, 296, B - 208, 68, 18, 'UITGANG', { bg: '#1f9a4a', fg: '#ffffff', size: 11, bolts: false, shadow: false, r: 3, lit: true });
    // vloodlichten
    for (const x of [250, 560, 1100]) floodLight(c, x, 276, x + 30, B + 36, '#fff4d8', 120, 0.16);
    // pallets en dozen
    for (const [x, b] of [[130, 640], [168, 640], [200, 640]]) { pallet(g, x - 24, b, 56); box(g, x - 20, b - 12, 24, 22, '#c8a468', true); box(g, x + 4, b - 12, 26, 28, '#b89458', true); box(g, x - 14, b - 34, 26, 22, '#d8b478'); g.fillStyle = 'rgba(220,235,255,.18)'; g.fillRect(x - 22, b - 70, 56, 58); }
    for (const [x, b] of [[1090, 640], [1128, 636]]) { pallet(g, x - 24, b, 56); box(g, x - 22, b - 12, 26, 26, '#c8a468', true); box(g, x + 6, b - 12, 24, 22, '#b89458', true); box(g, x - 12, b - 38, 28, 26, '#d8b478', true); }
    // vorkheftruck
    const fx = 400, fb = 660; g.fillStyle = '#e8a01a'; rr(g, fx, fb - 50, 56, 34, 6); g.fill(); g.fillStyle = '#20252b'; g.fillRect(fx + 6, fb - 78, 4, 62); g.fillRect(fx + 36, fb - 78, 4, 62); g.fillRect(fx + 4, fb - 82, 38, 4); g.fillStyle = '#c8cdd2'; g.fillRect(fx - 34, fb - 24, 40, 4); g.fillRect(fx - 34, fb - 12, 40, 4); wheel(g, fx + 12, fb - 8, 10); wheel(g, fx + 46, fb - 8, 10); g.fillStyle = '#e8c02a'; g.fillRect(fx + 6, fb - 64, 28, 4);
    // vrachtwagen (rechts voor)
    const tx = 1000, tb = 718; g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.ellipse(tx + 40, tb + 2, 290, 11, 0, 0, TAU); g.fill();
    g.fillStyle = grad(g, 0, tb - 150, 0, tb - 20, [[0, '#f4f6f8'], [1, '#b8c0c8']]); rr(g, tx - 250, tb - 150, 330, 120, 4); g.fill(); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; g.stroke(); txt(g, 'BUDDLEY', tx - 85, tb - 90, 34, '#2a5ab0', { fit: 220 }); g.fillStyle = '#2a5ab0'; g.fillRect(tx - 250, tb - 40, 330, 8);
    g.fillStyle = '#e8a01a'; rr(g, tx + 86, tb - 108, 86, 78, 6); g.fill(); g.fillStyle = '#2a3a52'; poly(g, [tx + 130, tb - 100, tx + 168, tb - 100, tx + 168, tb - 66, tx + 130, tb - 66]); g.fill(); g.strokeStyle = 'rgba(0,0,0,.4)'; g.stroke();
    wheel(g, tx - 160, tb - 22, 22); wheel(g, tx - 110, tb - 22, 22); wheel(g, tx + 130, tb - 22, 22); g.fillStyle = '#20252b'; g.fillRect(tx - 250, tb - 32, 420, 8);
    emit(c, (e) => { glowAt(e, tx + 170, tb - 50, 60, '#fff2c0', 0.5); poolAt(e, tx + 230, tb, 90, 10, '#fff2c0', 0.28); });
    // camera op de muur
    g.fillStyle = '#1a1c20'; g.fillRect(180, 440, 20, 5); rr(g, 168, 438, 18, 12, 3); g.fill(); c.D.push((gg, t) => { if (Math.sin(t * 4) > 0) { glowAt(gg, 172, 444, 14, '#ff2a2a', 0.8); gg.fillStyle = '#ff4a4a'; gg.beginPath(); gg.arc(172, 444, 1.8, 0, TAU); gg.fill(); } });
    c.door = { x: 330, y: B, w: 100, h: 172, type: 'hinge', style: 'steel', col: '#8a9aa8', int: 'dark' };
  },
};

KINDS.hq = {
  doorX: 640, scale: 2.3,
  build(c) {
    const g = c.g, day = c.P.key === 'day';
    // podium (lobby)
    stoneBlocks(g, 280, 440, 720, B - 440, { base: '#8a8a90', bh: 40 }); wallAO(g, 280, 440, 720, B - 440, { top: 0.3 });
    g.fillStyle = '#4a4e58'; g.fillRect(270, 430, 740, 14); g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(270, 430, 740, 2);
    // toren: glazen gevel met verdiepingen
    const tx0 = 420, tx1 = 860, ty0 = 40;
    g.fillStyle = grad(g, tx0, ty0, tx1, B, day ? [[0, '#7aa8d0'], [1, '#2a4a6a']] : [[0, '#2a3e60'], [1, '#0e1628']]); g.fillRect(tx0, ty0, tx1 - tx0, 400);
    const fl = 24; for (let y = ty0 + 6, r = 0; y < 430; y += fl, r++) for (let k = 0; k < 11; k++) { const x = tx0 + 6 + k * 39.4; if (c.P.lights && R() < 0.52) { const lc = pick(['#ffe8b0', '#fff4d8', '#cfe8ff', '#ffd890']); c.E.push((e) => { e.fillStyle = al(lc, 0.9); e.fillRect(x, y, 36, fl - 6); e.fillStyle = 'rgba(0,0,0,.25)'; e.fillRect(x, y + 6, 36, 2); }); } }
    g.fillStyle = 'rgba(255,255,255,.14)'; poly(g, [tx0, 300, tx0 + 160, ty0, tx0 + 240, ty0, tx0, 400]); g.fill(); g.fillStyle = 'rgba(255,255,255,.08)'; poly(g, [tx1 - 200, 440, tx1, ty0 + 100, tx1, ty0 + 200, tx1 - 100, 440]); g.fill();
    const mull = (e) => { e.fillStyle = '#16202e'; for (let k = 0; k <= 11; k++) e.fillRect(tx0 + k * 39.4 + 3 - 1, ty0, 4, 400); for (let y = ty0; y < 440; y += fl) e.fillRect(tx0, y, tx1 - tx0, 3.5); }; mull(g); c.E.push(mull);
    if (c.lit) c.E.push((e) => { e.save(); e.globalCompositeOperation = 'lighter'; e.fillStyle = grad(e, tx0, 0, tx1, 0, [[0, 'rgba(120,170,255,.0)'], [0.15, 'rgba(120,170,255,.16)'], [0.3, 'rgba(120,170,255,0)'], [1, 'rgba(120,170,255,.08)']]); e.fillRect(tx0, ty0, tx1 - tx0, 400); for (const y of [ty0 + 144, ty0 + 288]) { e.shadowColor = '#4aa8ff'; e.shadowBlur = 12; e.fillStyle = 'rgba(120,210,255,.9)'; e.fillRect(tx0, y, tx1 - tx0, 3); } e.restore(); });
    g.fillStyle = '#6a7684'; g.fillRect(tx0 - 8, ty0 - 8, tx1 - tx0 + 16, 12); wallAO(g, tx0, ty0, tx1 - tx0, 400, { top: 0.2, bot: 0.0, side: 0.35 });
    // antenne met rood lichtje
    g.fillStyle = '#aab2bc'; g.fillRect(636, -20, 8, 56); g.fillRect(618, 14, 44, 5); c.D.push((gg, t) => { if (Math.sin(t * 2.4) > -0.2) { glowAt(gg, 640, -16, 40, '#ff2a2a', 0.8); gg.fillStyle = '#ff5a5a'; gg.beginPath(); gg.arc(640, -16, 3.5, 0, TAU); gg.fill(); } });
    // logo en bord HOOFDKANTOOR
    g.fillStyle = '#0e1420'; g.fillRect(430, 62, 420, 52); g.strokeStyle = '#8aa8d0'; g.lineWidth = 3; g.strokeRect(430, 62, 420, 52);
    c.E.push((e) => { e.fillStyle = '#0e1420'; e.fillRect(430, 62, 420, 52); e.strokeStyle = '#8aa8d0'; e.lineWidth = 3; e.strokeRect(430, 62, 420, 52); });
    txt(g, c.spec.sign || 'HOOFDKANTOOR', 640, 90, 34, '#e8f0ff', { fit: 390, spacing: 7 }); emit(c, (e) => { txt(e, c.spec.sign || 'HOOFDKANTOOR', 640, 90, 34, '#eaf4ff', { fit: 390, spacing: 7 }); e.save(); e.globalCompositeOperation = 'lighter'; txt(e, c.spec.sign || 'HOOFDKANTOOR', 640, 90, 34, 'rgba(160,200,255,.45)', { fit: 390, spacing: 7, shadow: '#6aa0ff', blur: 16, sy: 0 }); e.restore(); });
    // lobby: groot glas met kolommen en lichte binnenkant
    g.fillStyle = '#12161e'; g.fillRect(300, 520, 680, B - 520); const lob = (e, a) => { e.save(); e.globalAlpha = a; e.fillStyle = grad(e, 0, 520, 0, B, [[0, '#e8f0ff'], [1, '#9ab0d0']]); e.fillRect(306, 524, 668, B - 524 - 6); e.fillStyle = 'rgba(40,60,90,.35)'; for (let k = 0; k < 8; k++) e.fillRect(320 + k * 84, 540, 30, B - 560); e.restore(); }; if (c.lit) c.E.push((e) => { lob(e, 1); glowAt(e, 640, 560, 380, '#cfe0ff', 0.2); }); else lob(g, 0.35);
    g.fillStyle = '#4a4e58'; for (let k = 0; k <= 8; k++) g.fillRect(300 + k * 85 - 3, 520, 6, B - 520);
    g.fillStyle = '#4a4e58'; g.fillRect(560, 520, 160, B - 520); g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(566, B - 180, 148, 180);
    stoneStep(c, 640, 160, B, 3);
    // plein: plantenbakken, vlaggen, bankjes, reflecties
    for (const x of [250, 1030]) { g.fillStyle = '#5a5e68'; rr(g, x - 40, 620, 80, 36, 4); g.fill(); g.fillStyle = '#3a2a1c'; g.fillRect(x - 38, 620, 76, 7); } tree(c, 250, 624, 150, { wide: 0.3 }); tree(c, 1030, 624, 150, { wide: 0.3 });
    for (let i = 0; i < 3; i++) flag(c, 100 + i * 34, 640, 260, ['#1f5ab0', '#d8322a', '#f0f0f4'][i], { w: 50, h: 28 });
    bench(g, 1090, 672, 80); for (const x of [330, 400, 880, 950]) bollard(g, x, 660);
    lampPost(c, 130, 700, 240, { arm: 18, col: '#d8e8ff', r: 140 }); lampPost(c, 1150, 700, 240, { arm: -18, col: '#d8e8ff', r: 140 });
    if (c.lit) c.E.push((e) => { e.save(); e.globalCompositeOperation = 'lighter'; e.fillStyle = grad(e, 0, B + 10, 0, 715, [[0, 'rgba(180,210,255,.2)'], [1, 'rgba(180,210,255,0)']]); e.fillRect(300, B + 10, 680, 110); e.restore(); });
    c.door = { x: 640, y: B, w: 146, h: 176, type: 'slide', style: 'glass', int: 'cool' };
  },
};

// ------------------------------------------------------------------ gebouwen: buitenwijk, politie, atelier, bank
KINDS.house = {
  doorX: 700, scale: 2.3,
  build(c) {
    const g = c.g;
    tree(c, 70, 618, 260, { wide: 0.34 }); tree(c, 1220, 618, 230, { wide: 0.32 });
    // garage links
    siding(g, 130, 380, 300, B - 380, { base: '#b4b8bc', bh: 11 }); wallAO(g, 130, 380, 300, B - 380, { top: 0.3 });
    tilesRoof(g, [112, 384, 196, 322, 364, 322, 448, 384], { base: '#4c5058', tw: 18, th: 10 }); g.fillStyle = '#d8d8d2'; g.fillRect(118, 382, 324, 6); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(118, 388, 324, 5);
    g.fillStyle = '#20242a'; g.fillRect(156, B - 160, 248, 160); g.fillStyle = grad(g, 0, B - 156, 0, B, [[0, '#e4e0d4'], [1, '#c0bcb0']]); g.fillRect(160, B - 156, 240, 156);
    for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(160, B - 156 + i * 39 + 36, 240, 3); g.fillStyle = 'rgba(0,0,0,.14)'; for (let k = 0; k < 4; k++) g.fillRect(168 + k * 58, B - 150 + i * 39, 46, 28); }
    for (let k = 0; k < 4; k++) { g.fillStyle = '#1a2030'; g.fillRect(172 + k * 58, B - 148, 42, 12); }
    emit(c, (e) => { for (let k = 0; k < 4; k++) { e.fillStyle = 'rgba(255,230,160,.35)'; e.fillRect(172 + k * 58, B - 148, 42, 12); } glowAt(e, 280, B - 164, 130, '#ffd890', 0.25); });
    g.fillStyle = '#c8c4b8'; g.fillRect(150, B - 168, 260, 8);
    // hoofdhuis
    siding(g, 430, 330, 580, B - 330, { base: '#8cb0cc', bh: 11 }); wallAO(g, 430, 330, 580, B - 330, { top: 0.35, bot: 0.35, side: 0.2 });
    g.fillStyle = '#f0ece2'; g.fillRect(430, 466, 580, 8); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(430, 474, 580, 4);
    // dak: steen, schoorsteen, dakkapel
    chimney(c, 880, 120, 40, 100);
    tilesRoof(g, [408, 336, 480, 196, 960, 196, 1032, 336], { base: '#4c525c', tw: 20, th: 12 });
    g.save(); poly(g, [408, 336, 480, 196, 960, 196, 1032, 336]); g.clip(); g.fillStyle = grad(g, 0, 196, 0, 336, [[0, 'rgba(255,255,255,.1)'], [1, 'rgba(0,0,0,.3)']]); g.fillRect(400, 190, 640, 150); g.restore();
    g.fillStyle = '#d8d8d2'; g.fillRect(404, 332, 632, 7); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(404, 339, 632, 5);
    dormer(c, 560, 244, 76, 60, '#4c525c'); dormer(c, 780, 244, 76, 60, '#4c525c');
    // ramen: boven, erker, begane grond
    win(c, 460, 360, 70, 80, { frame: '#f6f2ea', p: 0.6, cols: 2, rows: 3, shut: '#2a4a6a', curt: '#e8d8b8' }); win(c, 590, 360, 70, 80, { frame: '#f6f2ea', p: 0.8, cols: 2, rows: 3, shut: '#2a4a6a', curt: '#d8e0f0', lc: '#a8c8ff' }); win(c, 860, 360, 70, 80, { frame: '#f6f2ea', p: 0.7, cols: 2, rows: 3, shut: '#2a4a6a', curt: '#e8c8b0' });
    // tv-flikkering (dynamisch) in het raam van de erker
    win(c, 450, 500, 120, 70, { frame: '#f6f2ea', p: 0.9, cols: 3, rows: 2, curt: '#d8c8a8' }); g.fillStyle = '#f6f2ea'; g.fillRect(446, 566, 128, 8); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(446, 574, 128, 5);
    if (c.lit) c.D.push((gg, t) => { const k = 0.5 + 0.5 * Math.sin(t * 9 + Math.sin(t * 3.7) * 4); gg.save(); gg.globalCompositeOperation = 'lighter'; gg.fillStyle = `rgba(120,170,255,${0.18 + k * 0.22})`; gg.fillRect(459, 508, 102, 54); glowAt(gg, 510, 535, 90, '#7aa8ff', 0.1 + k * 0.1); gg.restore(); });
    win(c, 820, 500, 120, 70, { frame: '#f6f2ea', p: 0.5, cols: 3, rows: 2, curt: '#d8c8a8' });
    // veranda met zuilen en voordeur
    g.fillStyle = '#e8e4da'; poly(g, [640, 438, 740, 380, 840, 438, 840, 446, 640, 446]); g.fill(); g.fillStyle = '#4c525c'; poly(g, [632, 444, 740, 374, 848, 444]); g.fill(); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(640, 446, 200, 6);
    for (const x of [650, 830]) { g.fillStyle = grad(g, x - 6, 0, x + 6, 0, [[0, '#fff'], [1, '#aaa']]); g.fillRect(x - 6, 446, 12, B - 446); g.fillStyle = '#e8e4da'; g.fillRect(x - 9, 446, 18, 6); g.fillRect(x - 9, B - 8, 18, 8); }
    g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(662, B - 160, 76, 160); g.fillStyle = '#f2eee4'; g.fillRect(658, B - 164, 84, 6); g.fillRect(658, B - 164, 6, 164); g.fillRect(736, B - 164, 6, 164);
    g.fillStyle = '#2a2a2e'; rr(g, 748, 470, 12, 16, 3); g.fill(); emit(c, (e) => { glowAt(e, 754, 478, 80, '#ffd890', 0.5); e.fillStyle = '#ffe8b0'; e.fillRect(750, 472, 8, 12); });
    // trap en pad, oprit, brievenbus, hek en struiken
    stoneStep(c, 700, 96, B, 3); g.fillStyle = '#b4b0a6'; poly(g, [250, B + 6, 440, B + 6, 460, 668, 190, 668]); g.fill(); g.fillStyle = 'rgba(0,0,0,.18)'; for (let i = 0; i < 5; i++) g.fillRect(190, 610 + i * 12, 270, 2);
    bush(c, 510, B + 6, 100, 34, '#3a7a3a', { flowers: '#ff8ac0' }); bush(c, 900, B + 6, 110, 36, '#3a7a3a', { flowers: '#ffffff' }); bush(c, 600, B + 6, 60, 30, '#2f6a34');
    picket(c, 460, 640, B + 34, 28); picket(c, 760, 1030, B + 34, 28);
    g.fillStyle = '#4a4a50'; g.fillRect(1058, 600, 4, 50); g.fillStyle = '#2a5ab0'; rr(g, 1044, 584, 32, 18, 6); g.fill(); g.fillStyle = '#d83a2a'; g.fillRect(1070, 580, 3, 10);
    car(c, 255, 660, 210, { col: '#8a8e96', face: -1, lights: false });
    lampPost(c, 1100, 668, 220, { arm: -18, col: '#ffd890' });
    c.door = { x: 700, y: B, w: 76, h: 154, type: 'hinge', style: 'panel', win: true, col: '#a02a24', int: 'warm' };
  },
};

KINDS.police = {
  doorX: 640, scale: 2.3,
  build(c) {
    const g = c.g;
    concrete(g, 190, 250, 900, B - 250, { base: '#b4b4b2', panels: 112, cracks: 2 }); wallAO(g, 190, 250, 900, B - 250, { top: 0.4, bot: 0.35, side: 0.2 });
    g.fillStyle = '#6a6e76'; g.fillRect(176, 238, 928, 16); g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(176, 238, 928, 2); g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(176, 254, 928, 6);
    g.fillStyle = '#1d4fa8'; g.fillRect(190, 396, 900, 24); g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(190, 396, 900, 2); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(190, 420, 900, 5);
    // ramen met tralies
    for (const x of [230, 340, 450, 760, 870, 980]) for (const y of [286, 452]) { win(c, x, y, 70, y < 400 ? 80 : 90, { frame: '#d8dce0', p: 0.6, lc: '#cfe8ff', cols: 2, rows: 2, f: 4 }); g.strokeStyle = '#2a2e34'; g.lineWidth = 2; for (let b = 1; b < 6; b++) { g.beginPath(); g.moveTo(x + b * 70 / 6, y + 4); g.lineTo(x + b * 70 / 6, y + (y < 400 ? 76 : 86)); g.stroke(); } }
    // politiebord
    sign(c, 520, 276, 240, 62, c.spec.sign || 'POLITIE', { bg: '#1d4fa8', fg: '#ffffff', rim: '#f4f4f4', size: 42, spacing: 6, lit: true, lightText: true });
    // embleem
    g.fillStyle = '#e8c84a'; g.beginPath(); for (let i = 0; i < 12; i++) { const a = i * TAU / 12, r0 = i % 2 ? 22 : 28; g.lineTo(640 + Math.cos(a) * r0, 360 + Math.sin(a) * r0); } g.closePath(); g.fill(); g.fillStyle = '#1d4fa8'; g.beginPath(); g.arc(640, 360, 16, 0, TAU); g.fill(); txt(g, '★', 640, 361, 16, '#ffd84a');
    // dak: antenne en zwaailicht
    g.fillStyle = '#aab2bc'; g.fillRect(310, 170, 5, 70); g.fillRect(296, 190, 34, 4); g.fillRect(300, 206, 26, 3);
    g.fillStyle = '#2a2e34'; g.fillRect(630, 216, 20, 22); const lampDyn = (gg, t) => { const ph = Math.floor(t * 3) % 2; const col = ph ? '#ff2a2a' : '#2a6aff'; gg.fillStyle = col; rr(gg, 624, 202, 32, 18, 8); gg.fill(); glowAt(gg, 640, 210, 180, col, c.lit ? 0.5 : 0.25); if (c.lit) { gg.save(); gg.globalCompositeOperation = 'lighter'; gg.fillStyle = al(col, 0.07); gg.fillRect(190, 250, 900, B - 250); gg.restore(); } };
    c.D.push(lampDyn);
    // ingang met luifel en trappen, rolstoelhelling
    g.fillStyle = '#4a4e56'; g.fillRect(560, B - 196, 160, 10); g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(560, B - 186, 160, 6); g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(578, B - 182, 124, 182);
    for (const x of [566, 714]) { g.fillStyle = '#7a7e86'; g.fillRect(x - 5, B - 186, 10, 186); }
    stoneStep(c, 640, 150, B, 4); g.fillStyle = '#8a8e96'; poly(g, [720, B, 780, B + 30, 780, B + 36, 720, B + 8]); g.fill(); g.strokeStyle = '#9aa0a8'; g.lineWidth = 3; g.beginPath(); g.moveTo(730, B - 34); g.lineTo(790, B - 4); g.stroke();
    emit(c, (e) => { poolAt(e, 640, B + 26, 160, 24, '#cfe8ff', 0.35); });
    // vlaggen, politieauto's
    flag(c, 150, 640, 260, '#1d4fa8', { w: 60, h: 34, stripe: '#fff' }); flag(c, 1130, 640, 260, '#d8322a', { w: 60, h: 34, col2: '#fff' });
    for (const [x, f] of [[250, 1], [1020, -1]]) { const cr = car(c, x, 704, 290, { type: 'police', col: '#f4f4f6', face: f, lights: true }); c.D.push((gg, t) => { const ph = Math.floor(t * 4 + x) % 2; gg.fillStyle = ph ? '#ff2a2a' : '#2a6aff'; gg.fillRect(x - 12 * f * 0 - 12, 704 - 86 * (290 / 200), 24, 10); glowAt(gg, x, 704 - 86 * (290 / 200) + 5, 90, ph ? '#ff2a2a' : '#2a6aff', c.lit ? 0.55 : 0.25); }); }
    for (const x of [420, 860]) bollard(g, x, 660, 30, '#d8c820');
    lampPost(c, 100, 668, 210, { arm: 18, col: '#d8e8ff' });
    c.door = { x: 640, y: B, w: 118, h: 180, type: 'double', style: 'glass', col: '#8a9aa8', int: 'cool' };
  },
};

function mannequin(g, x, base, h, col, tilt = 0, o = {}) {
  g.save(); g.translate(x, base); g.rotate(tilt); g.fillStyle = '#2a2a2c'; g.beginPath(); g.ellipse(0, -2, 16, 5, 0, 0, TAU); g.fill(); g.fillRect(-2, -h * 0.55, 4, h * 0.55);
  g.fillStyle = grad(g, -14, 0, 14, 0, [[0, sh(col, 0.2)], [1, sh(col, -0.4)]]); g.beginPath(); g.moveTo(-14, -h * 0.55); g.quadraticCurveTo(-18, -h * 0.76, -11, -h * 0.84); g.lineTo(11, -h * 0.84); g.quadraticCurveTo(18, -h * 0.76, 14, -h * 0.55); g.closePath(); g.fill();
  if (o.skirt) { g.beginPath(); g.moveTo(-14, -h * 0.55); g.lineTo(-26, -h * 0.2); g.lineTo(26, -h * 0.2); g.lineTo(14, -h * 0.55); g.fill(); }
  g.fillStyle = '#c8b8a8'; g.fillRect(-3, -h * 0.9, 6, h * 0.06); g.beginPath(); g.ellipse(0, -h * 0.96, h * 0.055, h * 0.075, 0, 0, TAU); g.fill();
  g.strokeStyle = '#c8b8a8'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(-12, -h * 0.8); g.lineTo(-24, -h * 0.62); g.moveTo(12, -h * 0.8); g.lineTo(o.armUp ? 24 : 24, o.armUp ? -h * 0.98 : -h * 0.62); g.stroke();
  g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.arc(-2.5, -h * 0.97, 1.4, 0, TAU); g.arc(2.5, -h * 0.97, 1.4, 0, TAU); g.fill();
  g.restore();
}
KINDS.atelier = {
  doorX: 760, scale: 2.3,
  build(c) {
    const g = c.g;
    // buren
    bricks(g, -20, 290, 400, B - 290, { base: '#5a3a30', mortar: '#7a7060', bw: 22, bh: 9, v: 0.12 }); wallAO(g, -20, 290, 400, B - 290, { top: 0.4, bot: 0.4 }); for (let r = 0; r < 4; r++) win(c, 70 + (r % 2) * 130, 320 + Math.floor(r / 2) * 120, 50, 70, { frame: '#8a8478', p: 0.25, lc: '#9ac0a0', f: 4 });
    bricks(g, 900, 250, 400, B - 250, { base: '#6a4a3a', mortar: '#7a7060', bw: 22, bh: 9, v: 0.12 }); wallAO(g, 900, 250, 400, B - 250, { top: 0.4, bot: 0.4 }); for (let r = 0; r < 4; r++) win(c, 960 + (r % 2) * 130, 290 + Math.floor(r / 2) * 120, 50, 70, { frame: '#8a8478', p: 0.3, lc: '#9ac0a0', f: 4 });
    // atelier zelf: vergeeld pleisterwerk met afbladderen
    plaster(g, 380, 230, 520, B - 230, '#b8a870', { stains: 22, peel: 12, under: '#8a5a40' }); wallAO(g, 380, 230, 520, B - 230, { top: 0.4, bot: 0.45, side: 0.2 });
    g.fillStyle = '#4a4238'; g.fillRect(370, 218, 540, 16); g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(370, 234, 540, 7);
    for (let i = 0; i < 18; i++) { g.strokeStyle = '#4a7a34'; g.lineWidth = 2; const gx = 380 + R() * 520; g.beginPath(); g.moveTo(gx, 218); g.quadraticCurveTo(gx + rnd(-8, 8), 206, gx + rnd(-10, 10), 198); g.stroke(); }
    // verbleekt bord
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(432, 262, 420, 66); g.fillStyle = grad(g, 0, 258, 0, 322, [[0, '#8a7a58'], [1, '#6a5a3c']]); g.fillRect(428, 258, 420, 64); g.strokeStyle = '#3a3226'; g.lineWidth = 4; g.strokeRect(428, 258, 420, 64);
    const sg = c.spec.sign || 'ATELIER'; txt(g, sg, 638, 292, 50, '#c8b888', { spacing: 8, fit: 380, shadow: 'rgba(0,0,0,.3)', blur: 2, sy: 1 }); g.fillStyle = '#6a5a3c'; for (const [x, y, w, h] of [[470, 270, 26, 40], [622, 270, 18, 40], [738, 272, 24, 36]]) g.fillRect(x, y, w, h); // ontbrekende stukken
    flicker(c, 428, 258, 420, 64, 77, { rate: 3.1, depth: 0.5, double: true });
    // scheve luiken boven
    for (const [x, rot] of [[430, -0.06], [620, 0.04], [770, -0.03]]) { g.save(); g.translate(x + 30, 400); g.rotate(rot); win(c, -30, -40, 60, 80, { frame: '#6a5a40', p: 0.3, lc: '#a8c890', f: 4, rows: 3, cols: 2 }); g.fillStyle = '#4a6a4a'; g.fillRect(-30 - 24, -40, 22, 80); g.fillStyle = 'rgba(0,0,0,.3)'; for (let k = 0; k < 6; k++) g.fillRect(-52, -36 + k * 13, 18, 2); g.restore(); }
    // etalage met paspoppen
    const sx = 410, sy = 450, sw = 280, sh2 = 146; g.fillStyle = '#2a2418'; g.fillRect(sx - 8, sy - 8, sw + 16, sh2 + 8); g.fillStyle = '#10140e'; g.fillRect(sx, sy, sw, sh2);
    const shopBody = (e, a) => { e.save(); e.globalAlpha = a; e.beginPath(); e.rect(sx, sy, sw, sh2); e.clip(); e.fillStyle = grad(e, 0, sy, 0, sy + sh2, [[0, '#d8ecc8'], [1, '#7a9a6a']]); e.fillRect(sx, sy, sw, sh2); e.fillStyle = 'rgba(0,0,0,.3)'; e.fillRect(sx, sy + sh2 - 16, sw, 16); mannequin(e, sx + 50, sy + sh2 - 14, 120, '#6a9a4a', 0, { skirt: true }); mannequin(e, sx + 120, sy + sh2 - 14, 130, '#c86a2a', 0.04); mannequin(e, sx + 190, sy + sh2 - 14, 118, '#8a3a8a', -0.05, { skirt: true, armUp: true }); mannequin(e, sx + 250, sy + sh2 - 14, 126, '#3a6a9a', 0.02); e.fillStyle = 'rgba(40,20,10,.22)'; for (let i = 0; i < 8; i++) e.fillRect(sx + R() * sw, sy, rnd(2, 10), sh2); e.restore(); };
    if (c.lit) c.E.push((e) => { shopBody(e, 1); glowAt(e, sx + sw / 2, sy + sh2 / 2, 220, '#b8e8a0', 0.22); }); else shopBody(g, 0.5);
    g.fillStyle = 'rgba(255,255,255,.1)'; poly(g, [sx, sy + 100, sx + 130, sy, sx + 200, sy, sx, sy + 140]); g.fill(); g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 1.2; for (const [px, py] of [[sx + 60, sy], [sx + 200, sy]]) { g.beginPath(); g.moveTo(px, py); g.lineTo(px + 40, py + sh2); g.lineTo(px + 8, py + 90); g.stroke(); } // barst
    c.D.push((gg, t) => { if (!c.lit) return; const f = Math.sin(t * 13) + Math.sin(t * 31); if (f > 1.5) { gg.fillStyle = 'rgba(0,0,0,.35)'; gg.fillRect(sx, sy, sw, sh2); } });
    // paspoppen kijken: kleine gloeiende ogen
    if (c.lit) c.D.push((gg, t) => { const k = 0.5 + 0.5 * Math.sin(t * 2); gg.fillStyle = `rgba(255,60,60,${0.2 + 0.4 * k})`; for (const mx of [sx + 120, sx + 250]) { gg.beginPath(); gg.arc(mx - 2.5, sy + sh2 - 14 - 130 * 0.97, 1.3, 0, TAU); gg.arc(mx + 2.5, sy + sh2 - 14 - 130 * 0.97, 1.3, 0, TAU); gg.fill(); } });
    // deur
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(716, B - 158, 90, 158); g.fillStyle = '#4a4034'; g.fillRect(712, B - 162, 98, 6); g.fillRect(712, B - 162, 6, 162); g.fillRect(806, B - 162, 6, 162);
    stoneStep(c, 762, 86, B, 2);
    // afvoerpijp met roest, graffiti, kledingrek
    g.fillStyle = '#5a4a3a'; g.fillRect(870, 240, 8, B - 240); g.fillStyle = 'rgba(160,80,30,.5)'; for (let i = 0; i < 9; i++) g.fillRect(870, 250 + i * 38, 8, 8);
    g.save(); g.translate(822, 520); g.rotate(-0.05); txt(g, 'X', 0, 0, 40, '#c82a8a', { stroke: '#4a1030', lw: 3 }); g.restore();
    g.strokeStyle = '#4a4a4c'; g.lineWidth = 3; g.beginPath(); g.moveTo(325, 640); g.lineTo(325, 560); g.lineTo(386, 560); g.stroke(); for (let i = 0; i < 4; i++) { g.fillStyle = pick(['#8a3a3a', '#3a5a8a', '#8a8a3a', '#5a3a6a']); g.beginPath(); g.moveTo(335 + i * 14, 562); g.lineTo(345 + i * 14, 562); g.lineTo(350 + i * 14, 610); g.lineTo(334 + i * 14, 610); g.fill(); }
    // vuilcontainer, kapotte lantaarn, mist
    g.fillStyle = '#2a5a3a'; g.fillRect(960, 590, 110, 52); g.fillStyle = '#1a3a24'; g.fillRect(954, 582, 122, 10); g.fillStyle = 'rgba(0,0,0,.3)'; for (let i = 0; i < 4; i++) g.fillRect(968 + i * 26, 596, 3, 44); wheel(g, 985, 644, 8); wheel(g, 1050, 644, 8);
    lampPost(c, 330, 668, 200, { arm: 18, col: '#d8f0b0' }); flicker(c, 280, 440, 160, 220, 91, { rate: 5.5, depth: 0.55, double: true });
    if (c.lit) c.D.push((gg, t) => { gg.save(); gg.globalCompositeOperation = 'lighter'; for (let i = 0; i < 4; i++) { const k = ((t * 0.02 + i * 0.26) % 1); gg.fillStyle = grad(gg, 0, 600, 0, 700, [[0, 'rgba(140,160,180,0)'], [1, 'rgba(140,160,180,.06)']]); gg.beginPath(); gg.ellipse(k * 1500 - 100, 650, 260, 40, 0, 0, TAU); gg.fill(); } gg.restore(); });
    c.door = { x: 762, y: B, w: 84, h: 154, type: 'hinge', style: 'wood', col: '#4a6a4a', int: 'dark', hinge: 1 };
  },
};

KINDS.bankchina = {
  doorX: 640, scale: 2.3,
  build(c) {
    const g = c.g, gold = '#e8c040';
    // zijvleugels
    for (const [x0, x1] of [[100, 340], [940, 1180]]) { plaster(g, x0, 320, x1 - x0, B - 320, '#8a1418', { stains: 6 }); wallAO(g, x0, 320, x1 - x0, B - 320, { top: 0.35 }); lattice(c, x0 + 26, 420, 70, 110, { n: 3 }); lattice(c, x0 + 140, 420, 70, 110, { n: 3 }); cnRoof(c, x0 - 20, x1 + 20, 252, 70, 50, '#d8a82a', { fascia: '#a8181c', tw: 12, th: 8, tip: 14 }); lantern(c, x0 + 60, 360, 12, '#e8301c', { glow: 3.4 }); lantern(c, x0 + 180, 360, 12, '#e8301c', { glow: 3.4 }); }
    // hoofdhal
    plaster(g, 340, 250, 600, B - 250, '#7a1014', { stains: 8 }); wallAO(g, 340, 250, 600, B - 250, { top: 0.4, bot: 0.35, side: 0.3 });
    // gouden banner met naam
    cnRoof(c, 280, 1000, 100, 150, 220, '#d8a82a', { fascia: '#a8181c', tw: 16, th: 10, tip: 22 });
    g.fillStyle = 'rgba(0,0,0,.35)'; rr(g, 436, 272, 408, 62, 6); g.fill(); g.fillStyle = grad(g, 0, 268, 0, 330, [[0, '#a8181c'], [1, '#6a0c10']]); rr(g, 432, 268, 408, 62, 6); g.fill(); g.strokeStyle = gold; g.lineWidth = 4; g.stroke(); g.strokeStyle = 'rgba(232,192,64,.5)'; g.lineWidth = 1.5; rr(g, 440, 276, 392, 46, 4); g.stroke();
    txt(g, c.spec.sign || 'BANK OF CHINA', 636, 300, 38, '#f4d060', { fit: 360, spacing: 4, shadow: 'rgba(0,0,0,.6)', blur: 3, sy: 2 }); emit(c, (e) => { e.save(); e.globalCompositeOperation = 'lighter'; txt(e, c.spec.sign || 'BANK OF CHINA', 636, 300, 38, 'rgba(255,210,80,.35)', { fit: 360, spacing: 4, shadow: '#ffb030', blur: 16, sy: 0 }); e.restore(); });
    // munt-embleem
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(640, 196, 40, 0, TAU); g.fill(); g.fillStyle = grad(g, 600, 160, 680, 232, [[0, '#fff0a0'], [0.5, gold], [1, '#8a6a18']]); g.beginPath(); g.arc(640, 192, 38, 0, TAU); g.fill(); g.strokeStyle = '#7a5410'; g.lineWidth = 3; g.stroke(); g.fillStyle = '#a8181c'; g.fillRect(632, 164, 16, 56); g.fillRect(612, 184, 56, 16); g.fillStyle = gold; g.beginPath(); g.arc(640, 192, 12, 0, TAU); g.fill(); g.fillStyle = '#a8181c'; g.fillRect(636, 188, 8, 8);
    emit(c, (e) => { glowAt(e, 640, 192, 110, '#ffd860', 0.35); });
    // kolommen
    for (let i = 0; i < 8; i++) { const x = 380 + i * 74 + (i > 3 ? 0 : 0); if (i === 3 || i === 4) continue; g.fillStyle = grad(g, x - 13, 0, x + 13, 0, [[0, '#d83a2a'], [0.45, '#a8181c'], [1, '#4a0a0c']]); g.fillRect(x - 13, 348, 26, B - 348); g.fillStyle = gold; g.fillRect(x - 18, 340, 36, 12); g.fillRect(x - 18, B - 14, 36, 14); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x - 11, 352, 3, B - 366); }
    for (const x of [380 + 2 * 74 + 36, 380 + 5 * 74 - 36]) { /* tussenruimte */ }
    g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(560, B - 210, 160, 210); g.fillStyle = gold; g.fillRect(552, B - 218, 176, 10); g.fillRect(552, B - 218, 8, 218); g.fillRect(720, B - 218, 8, 218);
    for (const x of [394, 466, 814, 886]) lattice(c, x - 22, 400, 44, 110, { n: 2, f: 4 });
    // trappen en stenen leeuwen, lantaarns
    for (let i = 0; i < 5; i++) { g.fillStyle = grad(g, 0, B - 8 + i * 8, 0, B + i * 8, [[0, '#d8d2c4'], [1, '#8a8478']]); g.fillRect(330 - i * 16, B - 6 + i * 8, 620 + i * 32, 9); g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(330 - i * 16, B - 6 + i * 8, 620 + i * 32, 1.5); }
    stoneLion(c, 500, B + 6, 1.7, 1); stoneLion(c, 780, B + 6, 1.7, -1);
    for (const x of [330, 950]) { lantern(c, x, 380, 16, '#e8301c', { glow: 4.5 }); }
    lampPost(c, 130, 688, 220, { arm: 18, col: '#ffe0a0' }); lampPost(c, 1150, 688, 220, { arm: -18, col: '#ffe0a0' });
    flag(c, 220, 640, 260, '#d8222a', { w: 60, h: 36, stripe: '#f4d060' }); flag(c, 1060, 640, 260, '#d8222a', { w: 60, h: 36, stripe: '#f4d060' });
    c.door = { x: 640, y: B, w: 148, h: 200, type: 'double', style: 'red', col: '#9a1418', int: 'warm' };
  },
};

// ------------------------------------------------------------------ gebouwen: vliegtuigwrak, resort, schip, vliegveld, kasteel
function jet(c, x, base, len, face = 1) {
  const g = c.g, s = len / 400; g.save(); g.translate(x, base); g.scale(s * face, s); ellShadow(g, 0, 2, 215, 12, 0.4);
  const body = () => { g.beginPath(); g.moveTo(-200, -62); g.bezierCurveTo(-200, -112, -150, -128, -80, -128); g.lineTo(120, -122); g.bezierCurveTo(186, -118, 214, -80, 216, -64); g.bezierCurveTo(200, -34, 150, -30, 100, -30); g.lineTo(-100, -30); g.bezierCurveTo(-170, -30, -200, -40, -200, -62); g.closePath(); };
  // staartvin
  g.fillStyle = grad(g, 0, -230, 0, -100, [[0, '#d83a2a'], [1, '#a02418']]); poly(g, [-190, -100, -150, -228, -108, -228, -120, -112]); g.fill(); g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 2; g.stroke();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(-138, -182, 14, 0, TAU); g.fill(); g.fillStyle = '#d83a2a'; g.fillRect(-142, -192, 8, 20);
  body(); g.fillStyle = grad(g, 0, -128, 0, -30, [[0, '#ffffff'], [0.55, '#dde3e8'], [1, '#8a929c']]); g.fill(); g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 2; g.stroke();
  g.save(); body(); g.clip(); g.fillStyle = '#d83a2a'; g.fillRect(-210, -64, 440, 5); g.fillStyle = '#2a5ab0'; g.fillRect(-210, -58, 440, 8); g.restore();
  g.fillStyle = '#16222e'; for (let i = 0; i < 18; i++) { rr(g, -130 + i * 15, -100, 8, 12, 3); g.fill(); } g.fillStyle = '#16222e'; poly(g, [150, -112, 196, -100, 206, -82, 150, -86]); g.fill();
  // vleugel en motor
  g.fillStyle = grad(g, 0, -60, 0, -20, [[0, '#c8ced4'], [1, '#6a727c']]); poly(g, [-20, -50, 70, -50, 20, 6, -30, 6]); g.fill(); g.strokeStyle = 'rgba(0,0,0,.4)'; g.stroke();
  g.fillStyle = '#9aa2aa'; rr(g, -10, -14, 76, 28, 12); g.fill(); g.fillStyle = '#2a2e34'; g.beginPath(); g.ellipse(62, 0, 6, 14, 0, 0, TAU); g.fill();
  // landingsgestel
  g.fillStyle = '#4a4e56'; g.fillRect(140, -32, 5, 18); g.fillRect(-20, -34, 6, 24); wheel(g, 142, -10, 11); wheel(g, -17, -11, 12); wheel(g, 4, -11, 12);
  g.restore();
  const fx = x + face * 214 * s;
  emit(c, (e) => { glowAt(e, x - face * 150 * s, base - 235 * s, 30, '#ff3a2a', 0.4); poolAt(e, x, base + 4, 190 * s, 8 * s, '#c8d8ff', 0.1); });
}

KINDS.wreck = {
  doorX: 360, scale: 2.2,
  build(c) {
    const g = c.g;
    tree(c, 50, 640, 420, { wide: 0.4, col: '#2f7a3a' }); tree(c, 1230, 640, 400, { wide: 0.4, col: '#2c7034' }); tree(c, 1060, 540, 330, { type: 'palm', lean: -30 }); tree(c, 190, 480, 280, { type: 'palm', lean: 40 });
    // geulen in de grond: ingegraven modderbak
    g.fillStyle = grad(g, 0, 560, 0, 650, [[0, 'rgba(60,40,20,.0)'], [1, 'rgba(60,40,20,.7)']]); g.beginPath(); g.ellipse(640, 610, 620, 50, 0, 0, TAU); g.fill();
    // staartstuk (achterste deel, schuin omhoog)
    g.save(); g.translate(640, 596); g.rotate(-0.12);
    const rear = () => { g.beginPath(); g.moveTo(-6, -176); g.lineTo(380, -150); g.bezierCurveTo(440, -140, 470, -110, 470, -86); g.lineTo(380, 0); g.lineTo(-6, 0); g.lineTo(10, -40); g.lineTo(-10, -70); g.lineTo(8, -110); g.lineTo(-8, -140); g.closePath(); };
    g.fillStyle = grad(g, 0, -176, 0, 0, [[0, '#eceff2'], [0.6, '#cfd5da'], [1, '#7a828c']]); rear(); g.fill(); g.save(); rear(); g.clip(); g.fillStyle = '#2a5ab0'; g.fillRect(-20, -62, 500, 8); g.fillStyle = '#d83a2a'; g.fillRect(-20, -68, 500, 5);
    g.fillStyle = '#16222e'; for (let i = 0; i < 9; i++) { rr(g, 40 + i * 36, -128, 20, 28, 6); g.fill(); }
    for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(20,14,10,${rnd(0.1, 0.35)})`; g.beginPath(); g.ellipse(rnd(0, 440), rnd(-170, 0), rnd(14, 50), rnd(8, 26), 0, 0, TAU); g.fill(); }
    g.restore(); g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 2.5; rear(); g.stroke();
    // staartvin
    g.fillStyle = grad(g, 0, -340, 0, -150, [[0, '#d83a2a'], [1, '#9a2016']]); poly(g, [330, -150, 380, -330, 440, -334, 450, -150]); g.fill(); g.strokeStyle = 'rgba(0,0,0,.5)'; g.stroke(); g.fillStyle = '#fff'; g.fillRect(364, -260, 78, 18); g.fillStyle = 'rgba(20,14,10,.3)'; g.beginPath(); g.ellipse(410, -190, 40, 30, 0, 0, TAU); g.fill();
    g.fillStyle = '#c8ced4'; poly(g, [360, -100, 540, -90, 530, -76, 360, -80]); g.fill(); g.strokeStyle = 'rgba(0,0,0,.4)'; g.stroke();
    g.restore();
    // voorstuk (neus met cockpit en laadluik)
    const front = () => { g.beginPath(); g.moveTo(590, 420); g.lineTo(300, 420); g.bezierCurveTo(190, 420, 130, 470, 126, 528); g.bezierCurveTo(124, 570, 160, 600, 240, 600); g.lineTo(590, 600); g.lineTo(580, 560); g.lineTo(598, 520); g.lineTo(578, 490); g.lineTo(594, 456); g.closePath(); };
    g.fillStyle = grad(g, 0, 420, 0, 600, [[0, '#f2f4f6'], [0.6, '#d2d8de'], [1, '#7a828c']]); front(); g.fill();
    g.save(); front(); g.clip(); g.fillStyle = '#2a5ab0'; g.fillRect(100, 520, 520, 8); g.fillStyle = '#d83a2a'; g.fillRect(100, 514, 520, 5);
    for (let i = 0; i < 9; i++) { g.fillStyle = `rgba(20,14,10,${rnd(0.1, 0.4)})`; g.beginPath(); g.ellipse(rnd(120, 590), rnd(420, 600), rnd(14, 50), rnd(8, 28), 0, 0, TAU); g.fill(); }
    g.fillStyle = '#16222e'; for (const [x, y] of [[150, 470], [185, 462], [222, 456]]) { poly(g, [x, y + 26, x + 14, y, x + 34, y, x + 34, y + 26]); g.fill(); } g.fillStyle = 'rgba(255,255,255,.25)'; poly(g, [150, 496, 164, 470, 176, 470, 164, 496]); g.fill();
    g.fillStyle = '#16222e'; for (let i = 0; i < 5; i++) { rr(g, 440 + i * 30 - 150 + 150, 452, 18, 26, 5); g.fill(); }
    g.fillStyle = grad(g, 0, 560, 0, 600, [[0, 'rgba(70,48,24,0)'], [1, 'rgba(70,48,24,.65)']]); g.fillRect(100, 560, 520, 44);
    g.restore(); g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 2.5; front(); g.stroke();
    // laadluik (kader)
    g.fillStyle = '#1a1c20'; g.fillRect(298, 450, 124, 150); g.strokeStyle = '#8a929c'; g.lineWidth = 4; g.strokeRect(298, 450, 124, 150);
    // gescheurd metaal in de breuk
    g.fillStyle = '#16140f'; poly(g, [586, 456, 640, 470, 626, 520, 646, 560, 600, 596, 590, 600, 580, 560, 598, 520, 578, 490]); g.fill(); g.strokeStyle = '#8a929c'; g.lineWidth = 3; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(590 + (i % 2) * 6, 466 + i * 22); g.lineTo(610 + (i % 3) * 8, 470 + i * 22); g.stroke(); }
    g.strokeStyle = '#d8322a'; g.lineWidth = 2; g.beginPath(); g.moveTo(600, 500); g.bezierCurveTo(640, 480, 650, 540, 620, 590); g.stroke(); g.strokeStyle = '#2a8ad8'; g.beginPath(); g.moveTo(592, 480); g.bezierCurveTo(630, 500, 640, 520, 610, 560); g.stroke();
    // vleugelstomp in de voorgrond, losgeraakte motor
    g.fillStyle = grad(g, 0, 590, 0, 700, [[0, '#d8dde2'], [1, '#6a727c']]); poly(g, [330, 596, 560, 596, 520, 640, 70, 700, 40, 668]); g.fill(); g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 2.5; g.stroke(); g.fillStyle = '#d83a2a'; poly(g, [60, 676, 110, 664, 100, 690, 72, 700]); g.fill(); g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1.5; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(150 + i * 70, 690 - i * 8); g.lineTo(170 + i * 70, 626 - i * 4); g.stroke(); }
    g.fillStyle = grad(g, 0, 650, 0, 720, [[0, '#b8bec4'], [1, '#5a626c']]); g.beginPath(); g.ellipse(1010, 690, 90, 34, -0.1, 0, TAU); g.fill(); g.fillStyle = '#16181c'; g.beginPath(); g.ellipse(930, 696, 18, 30, -0.1, 0, TAU); g.fill(); g.strokeStyle = '#7a8088'; g.lineWidth = 3; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(930, 696); g.lineTo(930 + Math.cos(i) * 14, 696 + Math.sin(i) * 26); g.stroke(); }
    // bagage en brokstukken
    drawSuitcase(g, 700, 690, 1.3, '#a03030'); drawSuitcase(g, 760, 706, 1.1, '#3a6a9a'); drawSuitcase(g, 1100, 650, 1.0, '#6a8a3a'); drawSuitcase(g, 480, 710, 0.9, '#8a5a2a');
    g.fillStyle = '#8a929c'; poly(g, [820, 632, 880, 624, 870, 640, 830, 646]); g.fill(); g.fillStyle = '#5a626c'; poly(g, [980, 600, 1030, 606, 1000, 620]); g.fill();
    // stoelen in het gras
    for (const x of [860, 1130]) { g.fillStyle = '#2a4a8a'; rr(g, x, 650, 28, 26, 4); g.fill(); g.fillRect(x + 2, 626, 24, 26); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x, 674, 28, 4); }
    // vuur en rook
    fire(c, 618, 596, 1.5); fire(c, 1090, 662, 0.9, '#ff7a1a'); smoke(c, 622, 560, { n: 14, rise: 280, drift: 60, size: 14, col: '#2e2e34', a: 0.6 }); smoke(c, 1090, 640, { n: 9, rise: 160, drift: 30, size: 9, col: '#3a3a42', a: 0.5 });
    if (c.lit) c.E.push((e) => { glowAt(e, 614, 570, 260, '#ff7a2a', 0.32); poolAt(e, 614, 640, 200, 22, '#ff8a3a', 0.3); });
    c.door = { x: 360, y: B, w: 116, h: 144, type: 'hinge', style: 'steel', col: '#9aa4ae', int: 'dark' };
  },
};

KINDS.resort = {
  doorX: 640, scale: 2.3,
  build(c) {
    const g = c.g;
    // gevel: drie bouwdelen
    const parts = [[160, 460, 330, 3], [460, 820, 220, 5], [820, 1120, 330, 3]];
    for (const [x0, x1, top, fl] of parts) {
      plaster(g, x0, top, x1 - x0, B - top, '#f2eee2', { stains: 8 }); wallAO(g, x0, top, x1 - x0, B - top, { top: 0.25, bot: 0.35, side: 0.25 });
      const fh = (B - 100 - top) / (fl - 1);
      for (let f = 0; f < fl; f++) {
        const fy = top + 10 + f * fh;
        if (f > 0 || true) { g.fillStyle = '#d6d0c2'; g.fillRect(x0 - 6, fy + fh - 12, x1 - x0 + 12, 10); g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x0 - 6, fy + fh - 2, x1 - x0 + 12, 4); }
        if (f === fl - 1) break;
        const nr = Math.floor((x1 - x0) / 74);
        for (let k = 0; k < nr; k++) { const wx = x0 + 14 + k * ((x1 - x0 - 28) / nr), ww = (x1 - x0 - 28) / nr - 12; win(c, wx, fy + 8, ww, fh - 40, { frame: '#d8d4c8', p: 0.55, lc: pick(['#ffd890', '#fff0c8', '#ffc880']), f: 3, cols: 2, rows: 1, sill: false });
          g.fillStyle = 'rgba(200,230,240,.35)'; g.fillRect(wx - 3, fy + fh - 34, ww + 6, 22); g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 1.5; g.strokeRect(wx - 3, fy + fh - 34, ww + 6, 22); }
      }
    }
    // lobby begane grond (midden): warm glas met houten lamellen
    g.fillStyle = '#2a1c10'; g.fillRect(480, B - 120, 320, 120); const lob = (e, a) => { e.save(); e.globalAlpha = a; e.fillStyle = grad(e, 0, B - 116, 0, B, [[0, '#fff0c8'], [1, '#e8a850']]); e.fillRect(486, B - 114, 308, 114); e.fillStyle = 'rgba(90,50,20,.45)'; for (let i = 0; i < 6; i++) e.fillRect(500 + i * 52, B - 90, 14, 90); e.fillStyle = 'rgba(40,120,60,.8)'; for (const x of [520, 760]) { e.beginPath(); e.ellipse(x, B - 62, 14, 40, 0, 0, TAU); e.fill(); } e.restore(); };
    if (c.lit) c.E.push((e) => { lob(e, 1); glowAt(e, 640, B - 60, 280, '#ffc880', 0.25); }); else lob(g, 0.4);
    wood(g, 470, B - 134, 340, 16, { base: '#7a5230', pw: 4 }); for (let i = 0; i < 11; i++) { g.fillStyle = '#6a4424'; g.fillRect(480 + i * 31, B - 118, 8, 30); } g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(470, B - 118, 340, 6);
    // palapa met rieten dak en neon RESORT
    g.fillStyle = grad(g, 0, 120, 0, 224, [[0, '#c8a458'], [1, '#6a4a22']]); poly(g, [500, 224, 560, 130, 720, 130, 780, 224]); g.fill(); g.strokeStyle = 'rgba(60,36,10,.5)'; g.lineWidth = 1.4; for (let i = 0; i < 32; i++) { const k = i / 31; g.beginPath(); g.moveTo(lerp(560, 500, k), lerp(130, 224, k) - 0); g.lineTo(lerp(720, 780, k) - (780 - 500) * 0, lerp(130, 224, k)); g.stroke(); } for (let y = 140; y < 224; y += 8) { g.beginPath(); g.moveTo(lerp(560, 500, (y - 130) / 94), y); g.lineTo(lerp(720, 780, (y - 130) / 94), y); g.stroke(); }
    neonText(c, c.spec.sign || 'RESORT', 640, 176, 54, '#30e8d0', { fit: 220, spacing: 6 }); flicker(c, 530, 150, 220, 52, 44, { rate: 3.5, depth: 0.5 });
    // ingangsluifel + schuifdeur
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(570, B - 170, 140, 170); stoneStep(c, 640, 150, B, 2);
    // houten loopbrug, tiki-fakkels, lampjes
    g.fillStyle = grad(g, 0, B, 0, 720, [[0, '#8a6a42'], [1, '#6a4a2a']]); poly(g, [580, B, 700, B, 770, 720, 510, 720]); g.fill(); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.5; for (let y = B + 10; y < 720; y += 14) { const k = (y - B) / 124; g.beginPath(); g.moveTo(580 - 70 * k, y); g.lineTo(700 + 70 * k, y); g.stroke(); }
    for (const [x, y] of [[540, 640], [740, 640], [470, 690], [810, 690]]) { g.fillStyle = '#4a3220'; g.fillRect(x - 3, y - 80, 6, 82); g.fillStyle = '#6a4a2a'; rr(g, x - 7, y - 90, 14, 14, 3); g.fill(); fire(c, x, y - 92, 0.6, '#ff8a2a'); if (c.lit) c.E.push((e) => glowAt(e, x, y - 100, 90, '#ff9a3a', 0.28)); }
    if (c.lit) c.D.push((gg, t) => { gg.save(); gg.globalCompositeOperation = 'lighter'; for (let i = 0; i < 22; i++) { const k = i / 21, x = lerp(60, 1220, k), y = 560 + Math.sin(k * Math.PI) * 38 - 0; const tw = 0.6 + 0.4 * Math.sin(t * 3 + i * 1.7); gg.fillStyle = al(i % 3 ? '#ffe0a0' : '#ffb0e0', 0.8 * tw); gg.beginPath(); gg.arc(x, y - 100, 3, 0, TAU); gg.fill(); gg.fillStyle = al('#ffd890', 0.2 * tw); gg.beginPath(); gg.arc(x, y - 100, 12, 0, TAU); gg.fill(); } gg.restore(); });
    g.strokeStyle = 'rgba(40,30,20,.7)'; g.lineWidth = 1.2; g.beginPath(); for (let i = 0; i <= 40; i++) { const k = i / 40, x = lerp(60, 1220, k), y = 560 + Math.sin(k * Math.PI) * 38 - 100; g.lineTo(x, y + 0); } g.stroke();
    for (const x of [60, 1220]) { g.fillStyle = '#4a3220'; g.fillRect(x - 4, 440, 8, 160); }
    // ligstoelen en parasols rechts
    for (const x of [900, 1010]) { g.fillStyle = '#e8e4d8'; poly(g, [x, 652, x + 56, 652, x + 74, 636, x + 70, 626]); g.fill(); g.fillStyle = '#3a8ac8'; poly(g, [x + 6, 650, x + 52, 650, x + 66, 636, x + 62, 630]); g.fill(); g.fillStyle = '#6a4a2a'; g.fillRect(x + 2, 652, 3, 14); g.fillRect(x + 50, 652, 3, 14); }
    c.door = { x: 640, y: B, w: 132, h: 166, type: 'slide', style: 'glass', int: 'warm' };
  },
};

KINDS.ship = {
  doorX: 620, scale: 2.3,
  build(c) {
    const g = c.g;
    // rompen (achter de masten) - eerst masten & zeilen, dan romp
    const masts = [[330, 60], [620, 24], [910, 70]];
    // wanten
    g.strokeStyle = 'rgba(30,20,12,.8)'; g.lineWidth = 1.5; for (const [mx, top] of masts) { for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(mx, top + 70); g.lineTo(mx + sd * 120, 440); g.stroke(); for (let i = 1; i < 9; i++) { const k = i / 9, yy = lerp(top + 70, 440, k), xx = mx + sd * 120 * k; g.beginPath(); g.moveTo(xx, yy); g.lineTo(mx + sd * 120 * (k - 0.02) * 0.4, yy); g.stroke(); } } }
    g.beginPath(); g.moveTo(330, 80); g.lineTo(620, 40); g.lineTo(910, 90); g.moveTo(330, 80); g.lineTo(130, 440); g.moveTo(910, 90); g.lineTo(1160, 380); g.stroke();
    // zeilen
    const sail = (cx, y0, y1, w0, w1, tear) => { g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.moveTo(cx - w0 / 2 + 4, y0 + 4); g.lineTo(cx + w0 / 2 + 4, y0 + 4); g.lineTo(cx + w1 / 2 + 4, y1 + 4); g.lineTo(cx - w1 / 2 + 4, y1 + 4); g.fill(); g.beginPath(); g.moveTo(cx - w0 / 2, y0); g.lineTo(cx + w0 / 2, y0); g.quadraticCurveTo(cx + w1 / 2 + 14, (y0 + y1) / 2, cx + w1 / 2, y1); for (let i = 0; i < tear; i++) { const k = i / tear, tx = cx + w1 / 2 - k * w1; g.lineTo(tx - w1 / (tear * 2), y1 + (i % 2 ? 4 : 18 + (i * 7) % 12)); g.lineTo(tx - w1 / tear, y1); } g.quadraticCurveTo(cx - w1 / 2 - 14, (y0 + y1) / 2, cx - w0 / 2, y0); g.closePath(); g.fillStyle = grad(g, cx - w1 / 2, 0, cx + w1 / 2, 0, [[0, '#e8dcb4'], [0.5, '#d8caa0'], [1, '#a89868']]); g.fill(); g.strokeStyle = 'rgba(60,40,20,.5)'; g.lineWidth = 2; g.stroke();
      g.save(); g.clip(); g.strokeStyle = 'rgba(80,60,30,.25)'; g.lineWidth = 1; for (let y = y0 + 14; y < y1 + 20; y += 16) { g.beginPath(); g.moveTo(cx - w1, y); g.quadraticCurveTo(cx, y + 6, cx + w1, y); g.stroke(); } g.fillStyle = '#8a6a3a'; g.fillRect(cx - w0 * 0.2, y0 + (y1 - y0) * 0.3, 30, 26); g.fillRect(cx + w0 * 0.1, y0 + (y1 - y0) * 0.6, 24, 30); g.strokeStyle = '#4a3418'; g.setLineDash([3, 3]); g.strokeRect(cx - w0 * 0.2, y0 + (y1 - y0) * 0.3, 30, 26); g.setLineDash([]); g.restore();
      g.fillStyle = '#3a2814'; g.fillRect(cx - w0 / 2 - 4, y0 - 3, w0 + 8, 6); };
    for (const [mx, top] of masts) { sail(mx, top + 70, top + 200, 150, 170, 8); sail(mx, top + 226, 410, 200, 226, 10); }
    // masten zelf
    for (const [mx, top] of masts) { g.fillStyle = grad(g, mx - 7, 0, mx + 7, 0, [[0, '#7a5a36'], [0.5, '#5a3e22'], [1, '#2a1c0e']]); g.fillRect(mx - 7, top, 14, 450 - top); g.fillStyle = '#2a1c0e'; g.fillRect(mx - 70, top + 64, 140, 8); g.fillRect(mx - 100, top + 222, 200, 9); }
    // kraaiennest + piratenvlag
    g.fillStyle = '#4a3016'; g.beginPath(); g.moveTo(596, 94); g.lineTo(644, 94); g.lineTo(638, 120); g.lineTo(602, 120); g.fill(); g.strokeStyle = '#2a1c0e'; g.lineWidth = 2; g.stroke();
    c.D.push((gg, t) => { gg.save(); gg.translate(620, 24); gg.fillStyle = '#0c0c10'; gg.beginPath(); gg.moveTo(0, -10); for (let i = 0; i <= 10; i++) gg.lineTo(i * 5, -10 + Math.sin(t * 4 + i * 0.7) * 3); for (let i = 10; i >= 0; i--) gg.lineTo(i * 5, 14 + Math.sin(t * 4 + i * 0.7) * 3); gg.fill(); gg.fillStyle = '#f0f0e8'; gg.beginPath(); gg.arc(24, 2 + Math.sin(t * 4 + 3) * 2, 5, 0, TAU); gg.fill(); gg.fillRect(20, 6 + Math.sin(t * 4 + 3) * 2, 8, 3); gg.restore(); });
    for (const mx of [330, 910]) { g.fillStyle = '#4a3016'; g.fillRect(mx - 10, mx === 330 ? 120 : 130, 20, 4); }
    // romp: houten planken met kanonnen
    const hull = () => { g.beginPath(); g.moveTo(80, 410); g.quadraticCurveTo(110, 520, 220, 566); g.quadraticCurveTo(300, 586, 400, 588); g.lineTo(1000, 588); g.quadraticCurveTo(1110, 580, 1160, 520); g.lineTo(1190, 340); g.lineTo(1020, 340); g.lineTo(1000, 420); g.lineTo(190, 440); g.quadraticCurveTo(120, 430, 80, 410); g.closePath(); };
    g.save(); hull(); g.clip(); wood(g, 60, 330, 1160, 270, { base: '#5a3c22', pw: 15 }); g.fillStyle = grad(g, 0, 430, 0, 590, [[0, 'rgba(255,220,160,.1)'], [1, 'rgba(0,0,10,.55)']]); g.fillRect(60, 330, 1160, 270);
    g.fillStyle = 'rgba(20,50,30,.35)'; g.fillRect(60, 560, 1160, 40); speckle(g, 60, 500, 1160, 100, 1200, ['#2a4a2a', '#000000'], 0.3, 3); g.restore();
    g.save(); hull(); g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 3; g.stroke(); g.restore();
    g.fillStyle = '#c8a030'; g.beginPath(); g.moveTo(88, 420); g.lineTo(190, 450); g.lineTo(1000, 430); g.lineTo(1024, 350); g.lineTo(1186, 350); g.lineTo(1186, 358); g.lineTo(1030, 358); g.lineTo(1006, 438); g.lineTo(190, 458); g.lineTo(96, 428); g.fill(); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(190, 458, 810, 4);
    // geschutspoorten
    for (let i = 0; i < 8; i++) { const px = 250 + i * 95, py = 490; g.fillStyle = '#16100a'; g.fillRect(px, py, 40, 32); g.strokeStyle = '#2a1c0e'; g.lineWidth = 2.5; g.strokeRect(px, py, 40, 32); g.fillStyle = '#0a0a0e'; g.beginPath(); g.arc(px + 20, py + 18, 11, 0, TAU); g.fill(); g.fillStyle = '#6a3a1c'; g.fillRect(px - 2, py - 8, 44, 8); if (c.lit && (i % 3 === 1)) c.E.push((e) => { e.fillStyle = 'rgba(255,190,100,.55)'; e.fillRect(px + 4, py + 4, 32, 24); glowAt(e, px + 20, py + 16, 60, '#ffb050', 0.25); }); }
    // achterkasteel met ramen
    for (let i = 0; i < 4; i++) win(c, 1040 + i * 36, 372, 24, 40, { frame: '#c8a030', p: 0.95, lc: '#ffc060', f: 3, rows: 2, cols: 1, sill: false });
    g.fillStyle = '#c8a030'; g.fillRect(1030, 338, 160, 8); for (let i = 0; i < 9; i++) g.fillRect(1032 + i * 18, 324, 10, 14);
    txt(g, 'ZWARTE PAREL', 400, 574, 15, '#c8a030', { weight: 600, spacing: 3, shadow: 'rgba(0,0,0,.6)', blur: 2, sy: 1 });
    // boegspriet
    g.strokeStyle = '#4a3016'; g.lineWidth = 12; g.lineCap = 'round'; g.beginPath(); g.moveTo(130, 430); g.lineTo(30, 372); g.stroke(); g.lineCap = 'butt';
    // lantaarns op dek
    for (const x of [230, 470, 780]) { g.strokeStyle = '#2a1c0e'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, 410); g.lineTo(x, 440); g.stroke(); g.fillStyle = '#4a3016'; g.fillRect(x - 6, 438, 12, 14); emit(c, (e) => { glowAt(e, x, 446, 110, '#ffb060', 0.5); e.fillStyle = '#ffd890'; e.fillRect(x - 4, 440, 8, 10); }); }
    // loopplank + luik in de romp (de deur)
    g.fillStyle = '#16100a'; g.fillRect(570, 452, 100, 144); g.strokeStyle = '#c8a030'; g.lineWidth = 4; g.strokeRect(570, 452, 100, 144);
    g.fillStyle = '#7a5a2e'; poly(g, [566, 596, 674, 596, 684, 606, 556, 606]); g.fill(); g.strokeStyle = '#3a2a14'; g.lineWidth = 2; g.stroke();
    // water: reflectie van de lichten en schuimranden (dynamisch)
    g.fillStyle = 'rgba(180,210,230,.35)'; g.beginPath(); g.moveTo(90, 560); for (let x = 90; x < 1200; x += 20) g.lineTo(x, 584 + Math.sin(x * 0.07) * 3); g.lineTo(1200, 596); g.lineTo(90, 596); g.fill();
    c.D.push((gg, t) => { gg.save(); gg.beginPath(); gg.rect(0, 540, W, 56); gg.clip(); gg.strokeStyle = 'rgba(210,235,255,.35)'; gg.lineWidth = 1.6; for (let i = 0; i < 26; i++) { const x = ((i * 53 + t * 18) % 1280), y = 584 + (i % 4) * 4; gg.beginPath(); gg.moveTo(x, y); gg.quadraticCurveTo(x + 14, y - 3, x + 30, y); gg.stroke(); } gg.restore(); if (c.lit) { gg.save(); gg.globalCompositeOperation = 'lighter'; for (const x of [230, 470, 780, 1080]) { for (let i = 0; i < 6; i++) { gg.fillStyle = `rgba(255,170,80,${0.18 - i * 0.025})`; gg.fillRect(x - 20 + Math.sin(t * 2 + i) * 6, 560 + i * 5, 40 - i * 3, 2.4); } } gg.restore(); } });
    c.door = { x: 620, y: B, w: 88, h: 138, type: 'hinge', style: 'wood', col: '#4a3016', int: 'warm', hinge: 1 };
  },
};

KINDS.tower = {
  doorX: 770, scale: 2.3,
  build(c) {
    const g = c.g;
    // terminal links
    concrete(g, 40, 380, 560, B - 380, { base: '#a8aeb6', panels: 80, cracks: 0 }); wallAO(g, 40, 380, 560, B - 380, { top: 0.3 });
    g.fillStyle = '#e8ecf0'; g.beginPath(); g.moveTo(20, 372); g.lineTo(620, 372); g.lineTo(640, 392); g.lineTo(0, 392); g.fill(); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 392, 640, 8);
    for (let i = 0; i < 7; i++) { const x = 66 + i * 76; g.fillStyle = '#16202e'; g.fillRect(x, 410, 68, 160); const gl = (e, a) => { e.save(); e.globalAlpha = a; e.fillStyle = grad(e, 0, 410, 0, 570, [[0, '#e0f0ff'], [1, '#8ab0d0']]); e.fillRect(x + 3, 413, 62, 154); e.fillStyle = 'rgba(40,60,90,.4)'; for (let k = 0; k < 3; k++) { e.beginPath(); e.arc(x + 14 + k * 22, 520, 7, 0, TAU); e.fill(); e.fillRect(x + 8 + k * 22, 526, 12, 30); } e.restore(); }; if (c.lit) c.E.push((e) => { gl(e, 1); glowAt(e, x + 34, 490, 80, '#cfe8ff', 0.15); }); else gl(g, 0.35); g.fillStyle = 'rgba(255,255,255,.18)'; poly(g, [x, 520, x + 40, 410, x + 52, 410, x, 560]); g.fill(); }
    sign(c, 150, 330, 330, 40, c.spec.sign || 'VLIEGVELD', { bg: '#1a3a7a', fg: '#ffffff', size: 28, spacing: 8, lit: true, lightText: true, r: 6 });
    g.fillStyle = '#d8b02a'; g.fillRect(0, 578, 640, 6);
    // verkeerstoren
    const tx = 770; g.fillStyle = grad(g, tx - 70, 0, tx + 70, 0, [[0, '#cfd4d8'], [0.5, '#e8ebee'], [1, '#8a9098']]); poly(g, [tx - 70, B, tx - 42, 190, tx + 42, 190, tx + 70, B]); g.fill(); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; g.stroke();
    speckle(g, tx - 70, 190, 140, B - 190, 700, ['#000', '#fff'], 0.1, 2); wallAO(g, tx - 70, 190, 140, B - 190, { top: 0.2, bot: 0.4, side: 0.4 });
    for (let i = 0; i < 6; i++) { const y = 230 + i * 56, w = 22 + i * 1.5; g.fillStyle = '#16202e'; g.fillRect(tx - 6, y, 12, 26); }
    for (let i = 0; i < 6; i++) { const y = 232 + i * 56; c.E.push((e) => { e.fillStyle = 'rgba(255,224,150,.8)'; e.fillRect(tx - 5, y + 2, 10, 22); }); }
    g.fillStyle = '#d83a2a'; g.fillRect(tx - 60, 450, 120, 14); g.fillStyle = '#f4f4f4'; for (let i = 0; i < 8; i++) g.fillRect(tx - 60 + i * 30, 450, 15, 14);
    // cabine bovenin
    g.fillStyle = '#9aa2aa'; poly(g, [tx - 44, 190, tx + 44, 190, tx + 110, 160, tx - 110, 160]); g.fill(); g.fillStyle = grad(g, 0, 104, 0, 162, [[0, '#2a3a50'], [1, '#101826']]); poly(g, [tx - 112, 160, tx + 112, 160, tx + 122, 100, tx - 122, 100]); g.fill(); g.strokeStyle = '#6a727c'; g.lineWidth = 4; g.stroke();
    for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(tx - 112 + i * 37.3, 160); g.lineTo(tx - 122 + i * 40.7, 100); g.stroke(); }
    const cab = (e) => { e.fillStyle = grad(e, 0, 100, 0, 160, [[0, '#ffe8b0'], [1, '#e8a850']]); poly(e, [tx - 109, 157, tx + 109, 157, tx + 118, 103, tx - 118, 103]); e.fill(); e.fillStyle = '#6a727c'; for (let i = 1; i < 6; i++) { e.save(); e.lineWidth = 4; e.strokeStyle = '#6a727c'; e.beginPath(); e.moveTo(tx - 112 + i * 37.3, 160); e.lineTo(tx - 122 + i * 40.7, 100); e.stroke(); e.restore(); } e.fillStyle = 'rgba(30,20,10,.7)'; for (const dx of [-60, 10, 70]) { e.beginPath(); e.arc(tx + dx, 142, 8, 0, TAU); e.fill(); e.fillRect(tx + dx - 6, 144, 12, 14); } };
    if (c.lit) c.E.push((e) => { cab(e); glowAt(e, tx, 130, 200, '#ffc870', 0.3); }); else { g.save(); g.globalAlpha = 0.3; cab(g); g.restore(); }
    g.fillStyle = '#8a929a'; poly(g, [tx - 130, 100, tx + 130, 100, tx + 90, 80, tx - 90, 80]); g.fill(); g.fillStyle = '#5a626c'; g.fillRect(tx - 6, 40, 12, 40); g.fillRect(tx + 30, 30, 4, 50); g.fillRect(tx - 40, 50, 3, 30);
    c.D.push((gg, t) => { gg.save(); gg.translate(tx - 36, 52); const sx = Math.cos(t * 2.2); gg.fillStyle = '#c8ced4'; gg.beginPath(); gg.ellipse(0, 0, 30 * Math.abs(sx) + 3, 7, 0, 0, TAU); gg.fill(); gg.strokeStyle = '#6a727c'; gg.lineWidth = 2; gg.stroke(); gg.restore(); if (Math.sin(t * 3) > -0.3) { glowAt(gg, tx + 32, 26, 40, '#ff2a2a', 0.8); gg.fillStyle = '#ff6a6a'; gg.beginPath(); gg.arc(tx + 32, 26, 3.5, 0, TAU); gg.fill(); } });
    beam(c, tx, 126, 600, 60, '#e8f4ff', 0.9, 0, 0.1, 1.2);
    // deur, drempel
    g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(728, B - 156, 84, 156); g.fillStyle = '#4a4e56'; g.fillRect(722, B - 162, 96, 8);
    stoneStep(c, 770, 90, B, 2);
    // vliegtuig + bagagekarren + landingslichten
    jet(c, 1140, 708, 360, 1);
    for (let i = 0; i < 3; i++) { const x = 120 + i * 78; g.fillStyle = '#4a5058'; rr(g, x, 628, 64, 22, 3); g.fill(); g.fillStyle = '#c8302a'; g.fillRect(x + 4, 616, 56, 14); box(g, x + 8, 616, 22, 18, '#3a6a9a'); box(g, x + 34, 616, 20, 14, '#a03a3a'); wheel(g, x + 14, 654, 7); wheel(g, x + 50, 654, 7); }
    for (let i = 0; i < 26; i++) { const x = 20 + i * 50, y = 700 + (i % 2) * 0; c.E.push((e) => { glowAt(e, x, y, 24, '#4aa8ff', 0.85); e.fillStyle = '#bfe0ff'; e.beginPath(); e.arc(x, y, 2.2, 0, TAU); e.fill(); }); g.fillStyle = '#16202e'; g.beginPath(); g.arc(x, y, 3, 0, TAU); g.fill(); }
    for (const x of [90, 660]) lampPost(c, x, 668, 260, { arm: 0, col: '#fff0c8', r: 150 });
    c.door = { x: 770, y: B, w: 80, h: 152, type: 'hinge', style: 'steel', col: '#8a9aa8', int: 'dark' };
  },
};

KINDS.castle = {
  doorX: 640, scale: 2.3,
  build(c) {
    const g = c.g;
    const stone = '#5a5c6a';
    // hoge donjon achter de poort
    stoneBlocks(g, 560, 160, 160, B - 160, { base: '#4e505e', bh: 28 }); wallAO(g, 560, 160, 160, B - 160, { top: 0.3, side: 0.35 });
    // kantelen en muur
    for (const [x0, x1] of [[90, 540], [740, 1190]]) { stoneBlocks(g, x0, 330, x1 - x0, B - 330, { base: stone, bh: 30 }); wallAO(g, x0, 330, x1 - x0, B - 330, { top: 0.4, bot: 0.4 }); g.fillStyle = '#4a4c58'; g.fillRect(x0 - 6, 312, x1 - x0 + 12, 22); for (let x = x0 - 6; x < x1; x += 34) { g.fillStyle = '#5a5c6a'; g.fillRect(x, 292, 20, 24); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x, 292, 20, 2); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x + 18, 292, 4, 24); } }
    // torens met rode kaboutermutsen als dak
    const towers = [[80, 190, 160, 100], [1100, 190, 160, 100], [420, 250, 130, 70], [860, 250, 130, 70]];
    for (const [x, y, w, hh] of [[110, 190, 100, 0], [1170, 190, 100, 0]]) { /* plaats */ }
    const tower = (cx, top, w, capH, tilt) => { const x0 = cx - w / 2; stoneBlocks(g, x0, top, w, B - top, { base: '#565866', bh: 28 }); wallAO(g, x0, top, w, B - top, { top: 0.3, bot: 0.3, side: 0.45 }); g.fillStyle = '#3e404c'; g.fillRect(x0 - 8, top - 2, w + 16, 14); for (let i = 0; i < Math.floor(w / 24); i++) win(c, x0 + w * 0.5 - 9 + (i - (Math.floor(w / 24) - 1) / 2) * 30, top + 50 + (i % 2) * 40, 18, 44, { frame: '#2a2c36', arch: true, p: 1, lc: pick(['#9aff8a', '#ffb050', '#ff7a5a']), f: 3, rows: 2, cols: 1, sill: false });
      g.save(); g.translate(cx, top); g.rotate(tilt); g.fillStyle = grad(g, -w / 2, 0, w / 2, 0, [[0, '#e04a34'], [0.5, '#b8281c'], [1, '#601008']]); g.beginPath(); g.moveTo(-w / 2 - 12, 8); g.quadraticCurveTo(-w * 0.3, -capH * 0.35, -w * 0.05, -capH * 0.85); g.quadraticCurveTo(w * 0.1, -capH * 1.05, w * 0.3, -capH * 1.0); g.quadraticCurveTo(w * 0.12, -capH * 0.75, w * 0.34, -capH * 0.32); g.quadraticCurveTo(w * 0.5, -capH * 0.1, w / 2 + 12, 8); g.quadraticCurveTo(0, 22, -w / 2 - 12, 8); g.fill(); g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 2.5; g.stroke(); g.fillStyle = '#f4f0e0'; g.beginPath(); g.ellipse(0, 10, w / 2 + 10, 8, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.2)'; g.beginPath(); g.moveTo(-w * 0.3, -capH * 0.2); g.quadraticCurveTo(-w * 0.15, -capH * 0.55, -w * 0.02, -capH * 0.78); g.lineTo(0, -capH * 0.6); g.quadraticCurveTo(-w * 0.1, -capH * 0.4, -w * 0.18, -capH * 0.12); g.fill(); g.restore(); };
    tower(165, 230, 120, 170, -0.06); tower(1115, 230, 120, 170, 0.06); tower(640, 160, 150, 110, 0.02);
    for (const [fx, fy] of [[165 - 0.06 * 170 - 6, 56], [1115 + 0.06 * 170, 56]]) flag(c, fx, fy + 50, 54, '#8a1c18', { w: 40, h: 22 });
    // poortgebouw met grote poort
    stoneBlocks(g, 500, 300, 280, B - 300, { base: '#4a4c5a', bh: 26 }); wallAO(g, 500, 300, 280, B - 300, { top: 0.3, side: 0.3 }); g.fillStyle = '#3a3c48'; g.fillRect(494, 280, 292, 26); for (let x = 494; x < 790; x += 34) { g.fillStyle = '#4e505e'; g.fillRect(x, 262, 22, 22); }
    g.fillStyle = 'rgba(0,0,0,.6)'; g.beginPath(); g.moveTo(552, B); g.lineTo(552, 456); g.arc(640, 456, 88, Math.PI, 0); g.lineTo(728, B); g.fill(); g.strokeStyle = '#2a2c36'; g.lineWidth = 8; g.beginPath(); g.moveTo(548, B); g.lineTo(548, 456); g.arc(640, 456, 92, Math.PI, 0); g.lineTo(732, B); g.stroke();
    for (let i = 0; i < 9; i++) { g.fillStyle = '#4e505e'; g.fillRect(556 + i * 19, 380 + Math.abs(i - 4) * -2, 8, 6); } // sluitsteen
    txt(g, '☠', 640, 340, 30, '#2a2c36', {}); 
    // fakkels
    for (const x of [524, 756]) { g.fillStyle = '#2a1c0e'; g.fillRect(x - 3, 470, 6, 60); g.fillStyle = '#4a4c58'; rr(g, x - 8, 462, 16, 12, 3); g.fill(); fire(c, x, 462, 0.9); if (c.lit) c.E.push((e) => { glowAt(e, x, 450, 130, '#ff9a3a', 0.4); poolAt(e, x, B + 14, 100, 14, '#ff8a2a', 0.3); }); }
    for (const x of [300, 980]) for (const y of [440]) win(c, x - 12, y - 60, 24, 60, { frame: '#2a2c36', arch: true, p: 1, lc: '#9aff8a', f: 3, rows: 2, cols: 1, sill: false });
    // slotgracht en ophaalbrug
    g.save(); g.beginPath(); g.rect(0, 598, W, 40); g.clip(); waterRect(c, 0, 598, W, 40, { cols: c.P.key === 'day' ? ['#4a7a6a', '#2a4a4a'] : ['#1a3040', '#07101c'] }); g.restore(); g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, 596, W, 5);
    for (const [x0, x1] of [[0, 560], [720, 1280]]) { g.fillStyle = '#4a4c58'; g.fillRect(x0, 634, x1 - x0, 6); }
    g.fillStyle = grad(g, 0, 598, 0, 640, [[0, '#8a6a3a'], [1, '#5a3e1e']]); poly(g, [572, 598, 708, 598, 722, 640, 558, 640]); g.fill(); g.strokeStyle = '#2a1c0e'; g.lineWidth = 1.5; for (let y = 604; y < 640; y += 7) { g.beginPath(); g.moveTo(572 - (y - 598) * 0.33, y); g.lineTo(708 + (y - 598) * 0.33, y); g.stroke(); } g.strokeStyle = '#2a2c36'; g.lineWidth = 3; g.beginPath(); g.moveTo(572, 598); g.lineTo(560, 520); g.moveTo(708, 598); g.lineTo(720, 520); g.stroke();
    if (c.lit) c.E.push((e) => { e.save(); e.globalCompositeOperation = 'lighter'; for (const x of [524, 756, 300, 980]) { for (let i = 0; i < 4; i++) { e.fillStyle = `rgba(255,150,60,${0.14 - i * 0.03})`; e.fillRect(x - 12, 606 + i * 7, 24, 2); } } e.restore(); });
    // dode bomen, kraaien, nevel
    tree(c, 40, 700, 280, { type: 'dead' }); tree(c, 1250, 700, 300, { type: 'dead' });
    c.D.push((gg, t) => { gg.fillStyle = c.P.key === 'day' ? '#222' : '#06070c'; for (let i = 0; i < 5; i++) { const x = ((t * (26 + i * 5) + i * 280) % 1500) - 110, y = 90 + i * 34 + Math.sin(t * 1.3 + i) * 14, f = Math.sin(t * 9 + i * 2) * 7; gg.beginPath(); gg.moveTo(x - 12, y - f); gg.quadraticCurveTo(x - 5, y - 3, x, y); gg.quadraticCurveTo(x + 5, y - 3, x + 12, y - f); gg.quadraticCurveTo(x + 5, y + 2, x, y + 4); gg.quadraticCurveTo(x - 5, y + 2, x - 12, y - f); gg.fill(); } });
    c.D.push((gg, t) => { gg.save(); for (let i = 0; i < 5; i++) { const k = ((t * 0.012 + i * 0.21) % 1), x = k * 1700 - 200; gg.fillStyle = grad(gg, 0, 590, 0, 700, [[0, 'rgba(150,170,200,0)'], [0.5, `rgba(150,170,200,${c.P.key === 'night' ? 0.13 : 0.08})`], [1, 'rgba(150,170,200,0)']]); gg.beginPath(); gg.ellipse(x, 650 + (i % 2) * 22, 280, 34, 0, 0, TAU); gg.fill(); } gg.restore(); });
    c.door = { x: 640, y: B, w: 150, h: 196, type: 'double', style: 'gate', round: true, col: '#4a3220', int: 'dark' };
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
  const dir = 1;
  const startX = dir > 0 ? -90 : W + 90, restX = clamp(door.x - 300, 150, 1060), standX = door.x - dir * (door.w / 2 + 44 * s0 / 2.3);
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
    drawChar({ x, y, s, face, walk, t: rt, outfit, mask, gloves, sack: true, pose, alpha, rolled, hatLift: outfit === 'black' && mask < 0.5 ? 400 : 0 }, clip, dark);
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
