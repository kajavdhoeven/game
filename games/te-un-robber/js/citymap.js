// Te-Un the Robber - stadskaart (citymap.js): per hoofdstuk een kaart van bovenaf met 5 gebouwen om te kiezen.
// Alles procedureel op canvas. Zware lagen (terrein, gebouwen) worden 1 keer gecachet; per frame alleen bewegende dingen.
import { drawTeUn } from './chars.js';
import { CHAPTERS, LEVELS } from './story.js';

const W = 1280, H = 720, TAU = Math.PI * 2, FONT = 'Fredoka, sans-serif';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
function RNG(seed) { let s = seed >>> 0; return () => { s += 0x6D2B79F5; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------------------------------------------------------------- kleur
const h2r = (c) => { if (c.length === 4) c = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3]; return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; };
const r2h = (r) => '#' + r.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const A = h2r(a), B = h2r(b); return r2h(A.map((v, i) => v + (B[i] - v) * t)); };
const lite = (c, t) => mix(c, '#ffffff', t);
const dark = (c, t) => mix(c, '#000000', t);
const rgba = (c, a) => { const r = h2r(c); return `rgba(${r[0]},${r[1]},${r[2]},${a})`; };
const LG = (g, x0, y0, x1, y1, cols) => { const gr = g.createLinearGradient(x0, y0, x1, y1); cols.forEach((c, i) => gr.addColorStop(cols.length === 1 ? 0 : i / (cols.length - 1), c)); return gr; };
const RG = (g, x, y, r0, r1, cols, cx = x, cy = y) => { const gr = g.createRadialGradient(cx, cy, r0, x, y, r1); cols.forEach((c, i) => gr.addColorStop(i / (cols.length - 1), c)); return gr; };
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
const ell = (g, x, y, rx, ry, fill) => { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); if (fill) { g.fillStyle = fill; g.fill(); } };
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };

// zachte schaduw-vlek op de grond (schuin van links boven: valt naar rechtsonder)
function softShadow(g, x, y, rx, ry, a = 0.3) { g.save(); g.translate(x, y); g.scale(1, ry / rx); g.fillStyle = RG(g, 0, 0, 0, rx, [`rgba(0,0,0,${a})`, `rgba(0,0,0,${a * 0.7})`, 'rgba(0,0,0,0)']); g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.fill(); g.restore(); }
function glowBlob(g, x, y, r, color, a) { g.fillStyle = RG(g, x, y, 0, r, [rgba(color, a), rgba(color, a * 0.4), rgba(color, 0)]); g.fillRect(x - r, y - r, r * 2, r * 2); }
// scherpe schaduw van een volume: omhullende van voetafdruk en verplaatste voetafdruk
function hullShadow(g, pts, h, a = 0.3, blur = 6) {
  const all = []; const ox = h * 0.55, oy = h * 0.14;
  for (const p of pts) { all.push(p); all.push([p[0] + ox, p[1] + oy]); }
  all.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cr = (o, p, q) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
  const lo = []; for (const p of all) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  const up = []; for (let i = all.length - 1; i >= 0; i--) { const p = all[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  const hull = lo.slice(0, -1).concat(up.slice(0, -1));
  g.save(); g.shadowColor = `rgba(0,0,0,${a})`; g.shadowBlur = blur; g.shadowOffsetX = 4000; g.beginPath();
  hull.forEach((p, i) => (i ? g.lineTo(p[0] - 4000, p[1]) : g.moveTo(p[0] - 4000, p[1]))); g.closePath(); g.fillStyle = '#000'; g.fill(); g.restore();
}

// ---------------------------------------------------------------- schuine 3D (oblique): x rechts, y omhoog, z de diepte in (schuin rechts omhoog)
const DX = 0.6, DY = 0.42;
const sx = (x, z) => x + z * DX, sy = (y, z) => -y - z * DY;
function path3(g, pts) { g.beginPath(); pts.forEach((p, i) => { const x = p[0] + p[2] * DX, y = -p[1] - p[2] * DY; if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.closePath(); }
function poly3(g, pts, fill, stroke, lw = 1) { path3(g, pts); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); } }
function box3(g, x0, x1, y0, y1, z0, z1, f, o = {}) {
  const s = o.s || dark(f, 0.34), t = o.t || lite(f, 0.3);
  poly3(g, [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], LG(g, sx(x1, z0), sy(y1, z0), sx(x1, z1), sy(y0, z0), [s, dark(s, 0.25)]), 'rgba(0,0,0,.22)');
  poly3(g, [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], t, 'rgba(0,0,0,.18)');
  poly3(g, [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], o.ff || LG(g, 0, sy(y1, z0), 0, sy(y0, z0), [lite(f, 0.1), dark(f, 0.12)]), 'rgba(0,0,0,.26)');
  if (o.ao !== false) { g.fillStyle = LG(g, 0, sy(y0, z0), 0, sy(y0, z0) - 16, ['rgba(0,0,0,.3)', 'rgba(0,0,0,0)']); g.fillRect(x0, sy(y0, z0) - 16, x1 - x0, 16); }
}
function brick(g, x0, x1, y0, y1, base, R, bw = 16, bh = 8) {
  g.save(); g.beginPath(); g.rect(x0, -y1, x1 - x0, y1 - y0); g.clip();
  for (let r = 0, yy = -y1; yy < -y0; yy += bh, r++) for (let xx = x0 - (r % 2) * bw / 2; xx < x1; xx += bw) {
    const v = R(); g.fillStyle = v < 0.5 ? `rgba(255,255,255,${(0.05 + v * 0.1).toFixed(3)})` : `rgba(0,0,0,${(0.04 + (v - 0.5) * 0.14).toFixed(3)})`; g.fillRect(xx + 1, yy + 1, bw - 2, bh - 2);
  }
  g.strokeStyle = rgba(dark(base, 0.4), 0.35); g.lineWidth = 1; g.beginPath();
  for (let yy = -y1; yy < -y0; yy += bh) { g.moveTo(x0, yy); g.lineTo(x1, yy); }
  g.stroke(); g.restore();
}
function tiles(g, A, B, C, D, col, rows = 7, dens = 9) { // dak-vlak met pannen: A,B onderrand (links, rechts), C,D bovenrand (rechts, links)
  g.save(); g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.lineTo(C[0], C[1]); g.lineTo(D[0], D[1]); g.closePath(); g.clip();
  g.strokeStyle = rgba(dark(col, 0.45), 0.5); g.lineWidth = 1.1;
  for (let k = 0; k <= rows; k++) {
    const t = k / rows, ax = lerp(A[0], D[0], t), ay = lerp(A[1], D[1], t), bx = lerp(B[0], C[0], t), by = lerp(B[1], C[1], t);
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
    if (k < rows) { const t2 = (k + 1) / rows, cx = lerp(A[0], D[0], t2), cy = lerp(A[1], D[1], t2), dx = lerp(B[0], C[0], t2), dy = lerp(B[1], C[1], t2); const n = Math.max(3, Math.floor(Math.hypot(bx - ax, by - ay) / dens)); g.beginPath(); for (let i = 0; i <= n; i++) { const u = (i + (k % 2) * 0.5) / n; if (u > 1) continue; g.moveTo(lerp(ax, bx, u), lerp(ay, by, u)); g.lineTo(lerp(cx, dx, u), lerp(cy, dy, u)); } g.stroke(); }
  }
  g.fillStyle = 'rgba(255,255,255,.07)'; g.fill(); g.restore();
}
// dak met nok langs x (voorvlak zichtbaar) en de gevel rechts
function roofX(g, x0, x1, y1, z0, z1, rh, col, o = {}) {
  const ov = o.ov ?? 7, zm = (z0 + z1) / 2, wall = o.wall || '#d8c8a8';
  poly3(g, [[x1, y1, z0], [x1, y1, z1], [x1, y1 + rh, zm]], dark(wall, 0.35), 'rgba(0,0,0,.25)');
  const A = [sx(x0 - ov, z0 - ov), sy(y1 - ov * 0.35, z0 - ov)], B = [sx(x1 + ov, z0 - ov), sy(y1 - ov * 0.35, z0 - ov)], C = [sx(x1 + ov, zm), sy(y1 + rh, zm)], D = [sx(x0 - ov, zm), sy(y1 + rh, zm)];
  g.beginPath(); g.moveTo(...A); g.lineTo(...B); g.lineTo(...C); g.lineTo(...D); g.closePath(); g.fillStyle = LG(g, 0, A[1], 0, D[1], [lite(col, 0.04), lite(col, 0.22)]); g.fill();
  tiles(g, A, B, C, D, col, o.rows ?? 6, o.dens ?? 10);
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(...A); g.lineTo(...B); g.lineTo(...C); g.lineTo(...D); g.closePath(); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(D[0], D[1]); g.lineTo(C[0], C[1]); g.stroke();
  g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.moveTo(...A); g.lineTo(...B); g.lineTo(B[0], B[1] + 5); g.lineTo(A[0], A[1] + 5); g.closePath(); g.fill();
}
// dak met nok langs z (gevel naar voren, rechter dakvlak zichtbaar)
function roofZ(g, x0, x1, y1, z0, z1, rh, col, wallCol, o = {}) {
  const ov = o.ov ?? 5, xm = (x0 + x1) / 2;
  poly3(g, [[x0, y1, z0], [x1, y1, z0], [xm, y1 + rh, z0]], LG(g, 0, sy(y1 + rh, z0), 0, sy(y1, z0), [lite(wallCol, 0.1), dark(wallCol, 0.1)]), 'rgba(0,0,0,.28)');
  const A = [sx(x1 + ov, z0 - ov), sy(y1 - ov * 0.4, z0 - ov)], B = [sx(x1 + ov, z1 + ov), sy(y1 - ov * 0.4, z1 + ov)], C = [sx(xm, z1 + ov), sy(y1 + rh, z1 + ov)], D = [sx(xm, z0 - ov), sy(y1 + rh, z0 - ov)];
  g.beginPath(); g.moveTo(...A); g.lineTo(...B); g.lineTo(...C); g.lineTo(...D); g.closePath(); g.fillStyle = LG(g, A[0], 0, D[0], 0, [dark(col, 0.28), dark(col, 0.1)]); g.fill();
  // pannen: rijen evenwijdig aan de nok (tegen de helling in)
  g.save(); g.clip(); g.strokeStyle = rgba(dark(col, 0.55), 0.55); g.lineWidth = 1.1;
  const rows = o.rows ?? 6; for (let k = 1; k < rows; k++) { const t = k / rows; g.beginPath(); g.moveTo(lerp(A[0], D[0], t), lerp(A[1], D[1], t)); g.lineTo(lerp(B[0], C[0], t), lerp(B[1], C[1], t)); g.stroke(); }
  const n = 10; g.beginPath(); for (let i = 1; i < n; i++) { const u = i / n; g.moveTo(lerp(A[0], B[0], u), lerp(A[1], B[1], u)); g.lineTo(lerp(D[0], C[0], u), lerp(D[1], C[1], u)); } g.stroke(); g.restore();
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(...A); g.lineTo(...B); g.lineTo(...C); g.lineTo(...D); g.closePath(); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(...D); g.lineTo(...C); g.stroke();
}

// ---------------------------------------------------------------- gevel-onderdelen (op het voorvlak z=0, y = schermcoordinaat van de bovenkant)
function win(g, x, y, w, h, o = {}) {
  const lit = o.lit ?? 0, fr = o.frame || '#f2ece0', arch = o.arch;
  g.save();
  if (o.shut) { g.fillStyle = o.shut; g.fillRect(x - w * 0.34, y, w * 0.3, h); g.fillRect(x + w * 1.04, y, w * 0.3, h); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1; for (let i = 1; i < 5; i++) { const yy = y + h * i / 5; g.beginPath(); g.moveTo(x - w * 0.34, yy); g.lineTo(x - w * 0.04, yy); g.moveTo(x + w * 1.04, yy); g.lineTo(x + w * 1.34, yy); g.stroke(); } }
  g.fillStyle = fr; g.beginPath(); if (arch) { g.moveTo(x - 2.5, y + h + 2.5); g.lineTo(x - 2.5, y + w / 2); g.arc(x + w / 2, y + w / 2, w / 2 + 2.5, Math.PI, 0); g.lineTo(x + w + 2.5, y + h + 2.5); } else g.rect(x - 2.5, y - 2.5, w + 5, h + 5); g.fill();
  g.beginPath(); if (arch) { g.moveTo(x, y + h); g.lineTo(x, y + w / 2); g.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); g.lineTo(x + w, y + h); } else g.rect(x, y, w, h); g.closePath();
  const day = LG(g, x, y, x + w, y + h, ['#9fc4e0', '#4c78a0', '#2a4666']); const warm = LG(g, x, y, x, y + h, ['#ffe9a0', '#ffc860', '#ff9a40']);
  g.fillStyle = day; g.fill(); if (lit > 0) { g.globalAlpha = lit; g.fillStyle = warm; g.fill(); g.globalAlpha = 1; }
  g.save(); g.clip(); g.fillStyle = 'rgba(255,255,255,.22)'; g.beginPath(); g.moveTo(x, y + h * 0.5); g.lineTo(x + w * 0.55, y); g.lineTo(x + w * 0.8, y); g.lineTo(x, y + h * 0.8); g.fill(); g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(x, y, w, Math.max(3, h * 0.12)); g.restore();
  g.strokeStyle = fr; g.lineWidth = o.thin ? 1.2 : 2; g.beginPath(); if (o.cols !== 1) { g.moveTo(x + w / 2, y); g.lineTo(x + w / 2, y + h); } if (o.rowsN !== 0) { g.moveTo(x, y + h * 0.45); g.lineTo(x + w, y + h * 0.45); } g.stroke();
  g.fillStyle = lite(fr, 0.2); g.fillRect(x - 4, y + h + 2, w + 8, 4); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x - 4, y + h + 6, w + 8, 2);
  g.restore();
}
function door(g, x, y, w, h, col, o = {}) { // y = bovenkant; deur staat op y+h
  g.save(); g.fillStyle = o.frame || '#f0e8d8'; g.beginPath(); if (o.arch) { g.moveTo(x - 3, y + h); g.lineTo(x - 3, y + w / 2); g.arc(x + w / 2, y + w / 2, w / 2 + 3, Math.PI, 0); g.lineTo(x + w + 3, y + h); } else g.rect(x - 3, y - 3, w + 6, h + 3); g.fill();
  g.beginPath(); if (o.arch) { g.moveTo(x, y + h); g.lineTo(x, y + w / 2); g.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); g.lineTo(x + w, y + h); } else g.rect(x, y, w, h); g.closePath();
  g.fillStyle = LG(g, x, y, x + w, y + h, [lite(col, 0.15), dark(col, 0.25)]); g.fill(); g.clip();
  g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1.2; g.strokeRect(x + w * 0.14, y + h * 0.16, w * 0.32, h * 0.36); g.strokeRect(x + w * 0.54, y + h * 0.16, w * 0.32, h * 0.36); g.strokeRect(x + w * 0.14, y + h * 0.6, w * 0.72, h * 0.3);
  if (o.glass) { g.fillStyle = o.glass; g.fillRect(x + w * 0.14, y + h * 0.16, w * 0.32, h * 0.36); g.fillRect(x + w * 0.54, y + h * 0.16, w * 0.32, h * 0.36); }
  g.restore(); g.fillStyle = '#e8c860'; g.beginPath(); g.arc(x + w * 0.82, y + h * 0.58, 2, 0, TAU); g.fill();
  g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x - 3, y + h, w + 6, 2);
}
function stairs(g, x0, x1, n, step, col) { for (let i = 0; i < n; i++) { const d = i * 4; g.fillStyle = mix(col, '#000', 0.08 * i); g.fillRect(x0 - d, -step * (n - i), x1 - x0 + d * 2, step); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x0 - d, -step * (n - i), x1 - x0 + d * 2, 1.5); } }
function awning(g, x, y, w, h, c1, c2, n = 7) {
  const sw = w / n; for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? c2 : c1; g.beginPath(); g.moveTo(x + i * sw, y); g.lineTo(x + (i + 1) * sw, y); g.lineTo(x + (i + 1) * sw + 1, y + h); g.arc(x + (i + 0.5) * sw, y + h, sw / 2, 0, Math.PI); g.lineTo(x + i * sw - 1, y + h); g.fill(); }
  g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x, y + h * 0.5, w, h * 0.5 + sw / 2); g.fillStyle = LG(g, 0, y, 0, y + h, ['rgba(255,255,255,.25)', 'rgba(255,255,255,0)']); g.fillRect(x, y, w, h);
}
function sign(g, text, x, y, w, h, bg, fg, o = {}) {
  g.save(); g.fillStyle = 'rgba(0,0,0,.35)'; rr(g, x + 3, y + 4, w, h, h * 0.2); g.fill();
  g.fillStyle = LG(g, 0, y, 0, y + h, [lite(bg, 0.18), dark(bg, 0.15)]); rr(g, x, y, w, h, h * 0.2); g.fill(); g.strokeStyle = o.border || dark(bg, 0.5); g.lineWidth = 2; g.stroke();
  if (o.glow) { g.shadowColor = o.glow; g.shadowBlur = 10; }
  let fs = o.fs || h * 0.62; g.font = `700 ${fs}px ${FONT}`; while (g.measureText(text).width > w - 10 && fs > 6) { fs -= 1; g.font = `700 ${fs}px ${FONT}`; }
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = fg; g.fillText(text, x + w / 2, y + h / 2 + 1); g.restore();
}
function lantern(g, x, y, s = 1, col = '#e8342a') {
  g.save(); g.translate(x, y); g.scale(s, s); g.strokeStyle = '#3a2a1a'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(0, -6); g.lineTo(0, 0); g.stroke();
  g.fillStyle = '#e8c050'; g.fillRect(-3.5, 0, 7, 2.2); g.fillStyle = RG(g, 0, 8, 1, 10, [lite(col, 0.55), col, dark(col, 0.35)], -2, 6); g.beginPath(); g.ellipse(0, 8, 7.5, 8.5, 0, 0, TAU); g.fill();
  g.strokeStyle = rgba(dark(col, 0.5), 0.6); g.lineWidth = 0.8; for (const k of [-3.5, 0, 3.5]) { g.beginPath(); g.ellipse(0, 8, Math.abs(k) + 0.5, 8.5, 0, 0, TAU); g.stroke(); }
  g.fillStyle = '#e8c050'; g.fillRect(-3.5, 15.5, 7, 2); g.strokeStyle = '#e8c050'; g.beginPath(); g.moveTo(0, 17.5); g.lineTo(0, 22); g.stroke(); g.restore();
}
function star5(g, x, y, r, ri = r * 0.45) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? ri : r; g.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); } g.closePath(); }
function padlock(g, x, y, s, col = '#d8b040') {
  g.save(); g.translate(x, y); g.scale(s, s); g.strokeStyle = '#8a8f9a'; g.lineWidth = 5; g.beginPath(); g.arc(0, -6, 8, Math.PI, 0); g.lineTo(8, 0); g.moveTo(-8, -6); g.lineTo(-8, 0); g.stroke();
  g.fillStyle = LG(g, 0, 0, 0, 20, [lite(col, 0.25), dark(col, 0.2)]); rr(g, -12, -2, 24, 19, 4); g.fill(); g.strokeStyle = dark(col, 0.55); g.lineWidth = 1.5; g.stroke(); g.fillStyle = dark(col, 0.6); g.beginPath(); g.arc(0, 6.5, 3, 0, TAU); g.fill(); g.fillRect(-1.2, 7, 2.4, 6); g.restore();
}

// ---------------------------------------------------------------- props: bomen, struiken, bloemen, auto's, lantaarns
function tree(g, x, y, s, kind, R, col) {
  g.save(); g.translate(x, y); g.scale(s, s);
  if (kind === 'pine') {
    softShadow(g, 14, 4, 30, 9, 0.32);
    g.fillStyle = '#4a3220'; g.fillRect(-4, -14, 8, 16);
    const base = col || '#2a7a42';
    for (let i = 0; i < 4; i++) {
      const yy = -12 - i * 24, w = 42 - i * 9;
      g.fillStyle = LG(g, -w, yy - 30, w, yy, [lite(base, 0.18 - i * 0.02), dark(base, 0.35 + i * 0.04)]); g.beginPath(); g.moveTo(0, yy - 34); g.lineTo(w, yy); g.quadraticCurveTo(0, yy + 9, -w, yy); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,.1)'; g.beginPath(); g.moveTo(0, yy - 34); g.lineTo(-w, yy); g.quadraticCurveTo(-w * 0.4, yy - 4, 0, yy - 10); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-w * 0.9, yy - 1); g.quadraticCurveTo(0, yy + 8, w * 0.9, yy - 1); g.stroke();
    }
  } else if (kind === 'palm') {
    softShadow(g, 24, 4, 40, 9, 0.3);
    const lean = (R() - 0.5) * 30 + 8; g.strokeStyle = '#8a6a44'; g.lineCap = 'round'; g.lineWidth = 9; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(lean * 0.2, -45, lean, -90); g.stroke();
    g.strokeStyle = '#a58259'; g.lineWidth = 6; g.beginPath(); g.moveTo(-1, 0); g.quadraticCurveTo(lean * 0.2 - 1, -45, lean - 1, -90); g.stroke();
    g.strokeStyle = 'rgba(60,40,20,.35)'; g.lineWidth = 1; for (let i = 1; i < 9; i++) { const t = i / 9; const px = lean * t * t * 1.0 + 0, py = -90 * t; g.beginPath(); g.moveTo(px - 4, py); g.lineTo(px + 4, py - 2); g.stroke(); }
    const gc = col || '#2f9a4a'; const cx = lean, cy = -90;
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU + 0.3, L = 46 + R() * 12, ex = cx + Math.cos(a) * L, ey = cy + Math.sin(a) * L * 0.55 + 14;
      g.fillStyle = LG(g, cx, cy, ex, ey, [dark(gc, 0.2), lite(gc, 0.1)]); g.beginPath(); g.moveTo(cx, cy); g.quadraticCurveTo((cx + ex) / 2 + 4, (cy + ey) / 2 - 22, ex, ey); g.quadraticCurveTo((cx + ex) / 2 - 4, (cy + ey) / 2 - 8, cx, cy); g.fill();
    }
    g.fillStyle = '#5a3a1c'; g.beginPath(); g.arc(cx - 3, cy + 4, 4, 0, TAU); g.arc(cx + 3, cy + 5, 4, 0, TAU); g.fill();
  } else if (kind === 'poplar') {
    softShadow(g, 12, 3, 20, 6, 0.3); g.fillStyle = '#5a4630'; g.fillRect(-3, -14, 6, 16);
    const base = col || '#3d8a3a'; g.fillStyle = LG(g, -16, -120, 16, 0, [lite(base, 0.15), dark(base, 0.4)]); g.beginPath(); g.moveTo(0, -128); g.bezierCurveTo(22, -100, 20, -40, 12, -12); g.lineTo(-12, -12); g.bezierCurveTo(-20, -40, -22, -100, 0, -128); g.fill();
    g.fillStyle = 'rgba(255,255,255,.14)'; g.beginPath(); g.ellipse(-5, -78, 5, 40, 0.05, 0, TAU); g.fill();
  } else { // loofboom: gelaagde kruin met diepte
    const base = col === 'pink' ? '#e8a0b8' : (col || '#3f8f3a'), n = kind === 'big' ? 1.25 : 1;
    softShadow(g, 24 * n, 6, 46 * n, 12 * n, 0.34);
    g.fillStyle = LG(g, -6, 0, 6, 0, ['#6a4a2c', '#3a2614']); g.beginPath(); g.moveTo(-6, 2); g.lineTo(-4, -26 * n); g.lineTo(4, -26 * n); g.lineTo(7, 2); g.fill();
    g.strokeStyle = '#3a2614'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -20 * n); g.lineTo(-14 * n, -38 * n); g.moveTo(0, -20 * n); g.lineTo(14 * n, -36 * n); g.stroke();
    const cy = -50 * n, bl = [[-22, 6, 26], [20, 8, 25], [0, -6, 32], [-14, -22, 24], [14, -20, 24], [0, -34, 21]];
    for (const [bx, by, br] of bl) { g.fillStyle = dark(base, 0.42); g.beginPath(); g.arc(bx * n + 3, cy + by * n + 4, br * n, 0, TAU); g.fill(); }
    for (const [bx, by, br] of bl) {
      g.fillStyle = RG(g, bx * n, cy + by * n, 1, br * n, [lite(base, 0.3), base, dark(base, 0.25)], bx * n - br * 0.35 * n, cy + by * n - br * 0.4 * n);
      g.beginPath(); g.arc(bx * n, cy + by * n, br * n, 0, TAU); g.fill();
    }
    for (let i = 0; i < 40; i++) { const a = R() * TAU, rd = Math.sqrt(R()) * 40 * n; const px = Math.cos(a) * rd, py = cy - 6 * n + Math.sin(a) * rd * 0.8; g.fillStyle = R() < 0.5 ? rgba(lite(base, 0.4), 0.35) : rgba(dark(base, 0.5), 0.3); g.beginPath(); g.arc(px, py, 2 + R() * 3, 0, TAU); g.fill(); }
    if (col === 'pink' || kind === 'blossom') { for (let i = 0; i < 26; i++) { g.fillStyle = R() < 0.5 ? '#ffd0e0' : '#ff9ec0'; g.beginPath(); g.arc((R() - 0.5) * 80 * n, cy + (R() - 0.5) * 60 * n, 2 + R() * 2.5, 0, TAU); g.fill(); } }
  }
  g.restore();
}
function bush(g, x, y, s, col, R) {
  g.save(); g.translate(x, y); g.scale(s, s); softShadow(g, 10, 3, 22, 6, 0.28);
  for (const [bx, by, br] of [[-9, -6, 9], [8, -6, 10], [0, -12, 11]]) { g.fillStyle = RG(g, bx, by, 1, br, [lite(col, 0.25), col, dark(col, 0.3)], bx - 3, by - 4); g.beginPath(); g.arc(bx, by, br, 0, TAU); g.fill(); }
  g.restore();
}
function flowers(g, R, x, y, w, h, n, cols) {
  for (let i = 0; i < n; i++) {
    const px = x + R() * w, py = y + R() * h, c = cols[(R() * cols.length) | 0];
    g.strokeStyle = '#2f6a2a'; g.lineWidth = 1; g.beginPath(); g.moveTo(px, py); g.lineTo(px, py + 4); g.stroke();
    g.fillStyle = c; for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; g.beginPath(); g.arc(px + Math.cos(a) * 1.9, py + Math.sin(a) * 1.9, 1.5, 0, TAU); g.fill(); }
    g.fillStyle = '#ffe070'; g.beginPath(); g.arc(px, py, 1.1, 0, TAU); g.fill();
  }
}
function tulips(g, R, x, y, w, h, cols, rows = 4) { // tulpenveld met rijen
  const rh = h / rows;
  for (let r = 0; r < rows; r++) {
    const c = cols[r % cols.length], yy = y + r * rh; g.fillStyle = '#4a7a30'; g.fillRect(x, yy + rh * 0.6, w, rh * 0.4);
    for (let px = x; px < x + w; px += 5) { g.strokeStyle = '#2f6a2a'; g.lineWidth = 1; g.beginPath(); g.moveTo(px, yy + rh); g.lineTo(px, yy + rh * 0.5); g.stroke(); g.fillStyle = R() < 0.1 ? lite(c, 0.4) : c; g.beginPath(); g.ellipse(px, yy + rh * 0.38, 2.2, 3.2, 0, 0, TAU); g.fill(); }
    g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x, yy + rh - 2, w, 2);
  }
}
function rock(g, x, y, s, col = '#8a8a86') {
  g.save(); g.translate(x, y); g.scale(s, s); softShadow(g, 6, 2, 16, 4, 0.3); g.fillStyle = RG(g, 0, -6, 1, 15, [lite(col, 0.3), col, dark(col, 0.4)], -4, -10); g.beginPath(); g.moveTo(-12, 0); g.quadraticCurveTo(-14, -12, -4, -14); g.quadraticCurveTo(8, -18, 13, -4); g.quadraticCurveTo(14, 1, 8, 2); g.closePath(); g.fill(); g.restore();
}
function lamppost(g, x, y, s = 1, lit = 0, style = 'iron') {
  g.save(); g.translate(x, y); g.scale(s, s); softShadow(g, 6, 1, 14, 3, 0.25);
  g.fillStyle = '#262a30'; g.fillRect(-2, -62, 4, 62); g.fillRect(-5, -4, 10, 4);
  g.fillStyle = style === 'iron' ? '#2a2f36' : '#5a4630'; g.beginPath(); g.moveTo(-8, -62); g.lineTo(8, -62); g.lineTo(5, -74); g.lineTo(-5, -74); g.closePath(); g.fill();
  g.fillStyle = lit > 0 ? '#ffe9a8' : '#cfd8e0'; g.fillRect(-5.5, -73, 11, 10); g.fillStyle = '#2a2f36'; g.beginPath(); g.moveTo(-8, -74); g.lineTo(0, -80); g.lineTo(8, -74); g.fill(); g.restore();
}
function fence(g, x0, y, x1, col = '#d8c8a0', h = 14) {
  g.fillStyle = col; for (let x = x0; x < x1; x += 7) { g.fillRect(x, y - h, 4, h); g.beginPath(); g.moveTo(x, y - h); g.lineTo(x + 2, y - h - 3); g.lineTo(x + 4, y - h); g.fill(); }
  g.fillStyle = dark(col, 0.12); g.fillRect(x0, y - h * 0.75, x1 - x0, 2.5); g.fillRect(x0, y - h * 0.3, x1 - x0, 2.5);
}
function crate(g, x, y, s, col = '#b88a50') { g.save(); g.translate(x, y); g.scale(s, s); box3(g, -8, 8, 0, 14, 0, 10, col); g.strokeStyle = rgba(dark(col, 0.5), 0.6); g.beginPath(); g.moveTo(-8, -14); g.lineTo(8, 0); g.moveTo(8, -14); g.lineTo(-8, 0); g.stroke(); g.restore(); }

// auto van opzij (rijdt naar rechts: dir 1); gecachet per kleur
const carCache = new Map();
function carSprite(col, kind = 'car', night = 0) {
  const key = col + kind + night; if (carCache.has(key)) return carCache.get(key);
  const c = mk(120, 60), g = c.getContext('2d'); g.translate(60, 46);
  const bodyL = kind === 'van' ? 70 : kind === 'bus' ? 100 : 58, hH = kind === 'van' ? 26 : kind === 'bus' ? 32 : 16;
  const hw = bodyL / 2; g.save(); softShadow(g, 4, 5, hw + 6, 6, 0.4); g.restore();
  g.fillStyle = LG(g, 0, -hH - 8, 0, 0, [lite(col, 0.28), col, dark(col, 0.28)]);
  g.beginPath(); g.moveTo(-hw, -3); g.lineTo(-hw, -11); g.quadraticCurveTo(-hw, -15, -hw + 6, -15);
  if (kind === 'car') { g.lineTo(-hw * 0.35, -16); g.lineTo(-hw * 0.18, -hH - 6); g.lineTo(hw * 0.42, -hH - 6); g.lineTo(hw * 0.64, -16); g.lineTo(hw - 4, -15); } else { g.lineTo(-hw + 6, -hH - 8); g.lineTo(hw * 0.5, -hH - 8); g.lineTo(hw * 0.64, -16); g.lineTo(hw - 4, -15); }
  g.quadraticCurveTo(hw, -14, hw, -9); g.lineTo(hw, -3); g.closePath(); g.fill(); g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1.3; g.stroke();
  g.fillStyle = 'rgba(190,225,255,.88)';
  if (kind === 'car') { g.beginPath(); g.moveTo(-hw * 0.3, -16); g.lineTo(-hw * 0.15, -hH - 3); g.lineTo(hw * 0.12, -hH - 3); g.lineTo(hw * 0.12, -16); g.fill(); g.beginPath(); g.moveTo(hw * 0.17, -16); g.lineTo(hw * 0.17, -hH - 3); g.lineTo(hw * 0.4, -hH - 3); g.lineTo(hw * 0.58, -16); g.fill(); }
  else if (kind === 'van') { g.fillRect(hw * 0.12, -hH - 4, hw * 0.34, 12); } else { for (let i = 0; i < 6; i++) g.fillRect(-hw + 8 + i * 15, -hH - 4, 11, 11); }
  g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(-hw + 4, -12, bodyL - 8, 1.5);
  for (const wx of [-hw * 0.58, hw * 0.55]) { g.fillStyle = '#15171b'; g.beginPath(); g.arc(wx, -3, 7, 0, TAU); g.fill(); g.fillStyle = '#9aa0a8'; g.beginPath(); g.arc(wx, -3, 3.4, 0, TAU); g.fill(); g.fillStyle = '#15171b'; g.beginPath(); g.arc(wx, -3, 1.2, 0, TAU); g.fill(); }
  g.fillStyle = '#ffeaa0'; g.fillRect(hw - 4, -11, 4, 3); g.fillStyle = '#d02020'; g.fillRect(-hw, -11, 3, 3);
  carCache.set(key, c); return c;
}
function drawCar(g, x, y, dir, col, kind, lights) {
  const c = carSprite(col, kind); g.save(); g.translate(x, y); g.scale(dir, 1); g.drawImage(c, -60, -46);
  if (lights) { g.globalCompositeOperation = 'lighter'; const hw = (kind === 'van' ? 35 : kind === 'bus' ? 50 : 29); g.fillStyle = RG(g, hw + 14, -9, 0, 26, ['rgba(255,235,160,.55)', 'rgba(255,235,160,0)']); g.fillRect(hw - 8, -34, 50, 50); }
  g.restore();
}
function drawBike(g, x, y, dir, t, col) {
  g.save(); g.translate(x, y); g.scale(dir, 1); softShadow(g, 2, 1, 14, 3, 0.3);
  for (const wx of [-10, 10]) { g.strokeStyle = '#1c1c20'; g.lineWidth = 1.8; g.beginPath(); g.arc(wx, -8, 8, 0, TAU); g.stroke(); g.lineWidth = 0.6; g.beginPath(); for (let k = 0; k < 4; k++) { const a = t * 8 + k * Math.PI / 4; g.moveTo(wx + Math.cos(a) * 8, -8 + Math.sin(a) * 8); g.lineTo(wx - Math.cos(a) * 8, -8 - Math.sin(a) * 8); } g.stroke(); }
  g.strokeStyle = col; g.lineWidth = 2.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(-10, -8); g.lineTo(-3, -18); g.lineTo(8, -18); g.lineTo(10, -8); g.moveTo(-3, -18); g.lineTo(0, -8); g.lineTo(-10, -8); g.stroke();
  g.strokeStyle = '#1c1c20'; g.lineWidth = 2; g.beginPath(); g.moveTo(8, -18); g.lineTo(7, -23); g.lineTo(11, -23); g.stroke();
  const sw = Math.sin(t * 8) * 3; g.strokeStyle = '#3a4a6a'; g.lineWidth = 3; g.beginPath(); g.moveTo(-3, -27); g.lineTo(0 + sw, -12); g.moveTo(-3, -27); g.lineTo(2 - sw, -9); g.stroke();
  g.fillStyle = '#e0702a'; rr(g, -7, -42, 9, 16, 4); g.fill(); g.strokeStyle = '#e0702a'; g.lineWidth = 3; g.beginPath(); g.moveTo(-1, -38); g.lineTo(9, -24); g.stroke();
  g.fillStyle = '#f0c8a0'; g.beginPath(); g.arc(-1, -48, 5, 0, TAU); g.fill(); g.fillStyle = '#4a3220'; g.beginPath(); g.arc(-2, -49, 5, Math.PI, TAU); g.fill(); g.restore();
}
function drawWalker(g, x, y, dir, t, col, umb) {
  g.save(); g.translate(x, y); softShadow(g, 2, 1, 8, 2.5, 0.3); const sw = Math.sin(t * 7) * 3;
  g.strokeStyle = '#2a2a34'; g.lineWidth = 2.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, -12); g.lineTo(sw, 0); g.moveTo(0, -12); g.lineTo(-sw, 0); g.stroke();
  g.fillStyle = col; rr(g, -4.5, -26, 9, 15, 4); g.fill(); g.fillStyle = '#f0c8a0'; g.beginPath(); g.arc(0, -30, 4.3, 0, TAU); g.fill(); g.fillStyle = '#2a1c14'; g.beginPath(); g.arc(0, -31, 4.3, Math.PI, TAU); g.fill();
  if (umb) { g.fillStyle = umb; g.beginPath(); g.arc(dir * 2, -37, 12, Math.PI, 0); g.fill(); g.strokeStyle = '#3a2a1a'; g.lineWidth = 1; g.beginPath(); g.moveTo(dir * 2, -37); g.lineTo(dir * 2, -22); g.stroke(); }
  g.restore();
}
function drawBird(g, x, y, t, s = 1) {
  const f = Math.sin(t * 9) * 0.8; g.save(); g.translate(x, y); g.scale(s, s); g.strokeStyle = 'rgba(20,20,30,.75)'; g.lineWidth = 1.8; g.lineCap = 'round'; g.beginPath(); g.moveTo(-7, -2 * f - 1); g.quadraticCurveTo(-3, -5 * f - 3, 0, 0); g.quadraticCurveTo(3, -5 * f - 3, 7, -2 * f - 1); g.stroke(); g.restore();
}

// ---------------------------------------------------------------- terrein-gereedschap
function curveSample(pts, step = 6) { // Catmull-Rom door de punten, als dichte polylijn
  const out = [], P = [pts[0], ...pts, pts[pts.length - 1]];
  for (let i = 1; i < P.length - 2; i++) {
    const p0 = P[i - 1], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2], len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), n = Math.max(2, Math.ceil(len / step));
    for (let k = 0; k < n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t; out.push([0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3), 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]); }
  }
  out.push(pts[pts.length - 1]); return out;
}
function strokePoly(g, poly, w, style, cap = 'round') { g.beginPath(); poly.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.lineWidth = w; g.strokeStyle = style; g.lineCap = cap; g.lineJoin = 'round'; g.stroke(); }
function polyPath(poly) { const p = new Path2D(); poly.forEach((q, i) => (i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1]))); p.closePath(); return p; }
function paintGrass(g, R, x0, y0, x1, y1, base, pal) {
  g.save(); g.beginPath(); g.rect(x0, y0, x1 - x0, y1 - y0); g.clip();
  g.fillStyle = LG(g, 0, y0, 0, y1, [lite(base, 0.08), base, dark(base, 0.12)]); g.fillRect(x0, y0, x1 - x0, y1 - y0);
  for (let i = 0; i < 70; i++) { const px = x0 + R() * (x1 - x0), py = y0 + R() * (y1 - y0), r = 40 + R() * 110, c = R() < 0.5 ? pal[(R() * pal.length) | 0] : dark(base, 0.25); glowBlob(g, px, py, r, c, 0.16 + R() * 0.14); }
  const area = (x1 - x0) * (y1 - y0), n = area / 50;
  for (let b = 0; b < pal.length; b++) {
    g.strokeStyle = rgba(pal[b], 0.55); g.lineWidth = 1.1; g.beginPath();
    for (let i = 0; i < n / pal.length; i++) { const px = x0 + R() * (x1 - x0), py = y0 + R() * (y1 - y0), a = -Math.PI / 2 + (R() - 0.5) * 1.1, l = 3 + R() * 5; g.moveTo(px, py); g.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); }
    g.stroke();
  }
  g.restore();
}
function paintAsphalt(g, R, x, y, w, h, base = '#4a4d54') {
  g.fillStyle = LG(g, 0, y, 0, y + h, [lite(base, 0.06), base, dark(base, 0.1)]); g.fillRect(x, y, w, h);
  for (let i = 0; i < w * h / 90; i++) { const px = x + R() * w, py = y + R() * h; g.fillStyle = R() < 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.07)'; g.fillRect(px, py, 1 + R() * 2, 1 + R() * 2); }
  for (let i = 0; i < Math.max(2, w * h / 12000); i++) { const px = x + R() * w, py = y + R() * h, r = 8 + R() * 22; g.save(); g.translate(px, py); g.scale(2.2, 1); glowBlob(g, 0, 0, r, '#000', 0.1 + R() * 0.1); g.restore(); }
  g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 0.9; for (let i = 0; i < w * h / 14000; i++) { let px = x + R() * w, py = y + R() * h; g.beginPath(); g.moveTo(px, py); for (let k = 0; k < 5; k++) { px += (R() - 0.3) * 10; py += (R() - 0.5) * 6; g.lineTo(px, py); } g.stroke(); }
}
function dashLine(g, x0, y0, x1, y1, col = '#e8e0c0', w = 3, dash = [22, 18]) { g.save(); g.setLineDash(dash); g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.restore(); }
function zebra(g, x, y, w, h, vertical = true) { g.fillStyle = 'rgba(240,240,235,.8)'; if (vertical) for (let i = 0; i < w / 10; i++) g.fillRect(x + i * 10, y, 5, h); else for (let i = 0; i < h / 10; i++) g.fillRect(x, y + i * 10, w, 5); }
function cobble(g, R, x, y, w, h, base, size = 9) {
  g.fillStyle = base; g.fillRect(x, y, w, h);
  for (let r = 0, yy = y; yy < y + h; yy += size * 0.75, r++) for (let xx = x - (r % 2) * size / 2; xx < x + w; xx += size) {
    const v = R() * 0.22 - 0.08; g.fillStyle = v > 0 ? lite(base, v) : dark(base, -v); g.beginPath(); g.roundRect(Math.max(x, xx + 0.8), yy + 0.6, size - 1.6, size * 0.75 - 1.2, 2); g.fill();
  }
}
function paintWater(g, R, path, c1, c2, o = {}) {
  g.save(); g.clip(path);
  g.fillStyle = LG(g, 0, o.y0 ?? 0, 0, o.y1 ?? H, [c1, c2]); g.fill(path);
  for (let i = 0; i < (o.n ?? 90); i++) { const px = (o.x0 ?? 0) + R() * ((o.x1 ?? W) - (o.x0 ?? 0)), py = (o.y0 ?? 0) + R() * ((o.y1 ?? H) - (o.y0 ?? 0)), l = 10 + R() * 26; g.strokeStyle = R() < 0.6 ? 'rgba(255,255,255,.14)' : 'rgba(0,0,40,.12)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(px, py); g.quadraticCurveTo(px + l / 2, py - 2.5, px + l, py); g.stroke(); }
  g.restore();
}
function collectGlints(g, R, path, box, n) { const out = []; let guard = 0; while (out.length < n && guard++ < n * 20) { const x = box[0] + R() * (box[2] - box[0]), y = box[1] + R() * (box[3] - box[1]); if (g.isPointInPath(path, x, y)) out.push({ x, y, w: 5 + R() * 11, ph: R() * 7, sp: 0.8 + R() * 1.4 }); } return out; }
function bridgeWood(g, x, y, w, len, ang = 0) { // houten bruggetje (dwars over de rivier), midden (x,y), lengte langs de weg
  g.save(); g.translate(x, y); g.rotate(ang);
  g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(-len / 2 + 4, -w / 2 + 5, len, w);
  for (let i = 0; i < len / 7; i++) { g.fillStyle = i % 2 ? '#a07848' : '#b8885a'; g.fillRect(-len / 2 + i * 7, -w / 2, 6.4, w); }
  g.fillStyle = '#6a4a28'; g.fillRect(-len / 2, -w / 2 - 4, len, 5); g.fillRect(-len / 2, w / 2 - 1, len, 5); for (let i = 0; i <= 4; i++) { g.fillStyle = '#5a3c1e'; g.fillRect(-len / 2 + i * len / 4 - 2, -w / 2 - 8, 4, 10); g.fillRect(-len / 2 + i * len / 4 - 2, w / 2 - 4, 4, 10); }
  g.restore();
}
function bridgeStone(g, x, y, w, len, col = '#c8c0b0') { // stenen gracht-brug, bovenaanzicht schuin
  g.save(); g.translate(x, y); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(-len / 2 + 5, -w / 2 + 7, len, w);
  g.fillStyle = LG(g, 0, -w / 2, 0, w / 2, [lite(col, 0.1), col, dark(col, 0.1)]); g.fillRect(-len / 2, -w / 2, len, w);
  g.fillStyle = '#4a4d54'; g.fillRect(-len / 2 + 6, -w / 2 + 6, len - 12, w - 12); dashLine(g, -len / 2 + 8, 0, len / 2 - 8, 0, '#e8e0c0', 2, [10, 10]);
  g.fillStyle = dark(col, 0.2); g.fillRect(-len / 2, -w / 2 - 6, len, 8); g.fillRect(-len / 2, w / 2 - 2, len, 8); g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(-len / 2, -w / 2 - 6, len, 2); g.restore();
}

// ================================================================ gebouwen (lokale coordinaten: (0,0) = midden onderkant van de voorgevel)
const BUILD = {};
function cyl(g, cx, y0, y1, r, col, o = {}) { // staande cilinder, voeten op y0 (scherm-y), top op y1 (< y0)
  const ry = r * 0.36;
  g.fillStyle = LG(g, cx - r, 0, cx + r, 0, [lite(col, 0.3), col, dark(col, 0.25), dark(col, 0.5)]);
  g.beginPath(); g.moveTo(cx - r, y1); g.lineTo(cx - r, y0); g.ellipse(cx, y0, r, ry, 0, Math.PI, 0, true); g.lineTo(cx + r, y1); g.ellipse(cx, y1, r, ry, 0, 0, Math.PI); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 1; g.stroke();
  if (o.top !== false) { ell(g, cx, y1, r, ry, o.topCol || lite(col, 0.35)); g.strokeStyle = 'rgba(0,0,0,.25)'; g.stroke(); }
}
function cone(g, cx, yb, r, h, col) {
  const ry = r * 0.36; g.fillStyle = LG(g, cx - r, 0, cx + r, 0, [lite(col, 0.25), col, dark(col, 0.3), dark(col, 0.55)]);
  g.beginPath(); g.moveTo(cx - r, yb); g.lineTo(cx, yb - h); g.lineTo(cx + r, yb); g.ellipse(cx, yb, r, ry, 0, 0, Math.PI); g.closePath(); g.fill(); g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1; g.stroke();
}
function pagodaRoof(g, cx, y, w, rise, col, o = {}) { // Chinees dak met opgetrokken hoeken; y = onderkant van de dakrand
  const hw = w / 2, up = o.up ?? 14, tg = o.trim || '#e8c050';
  g.save(); g.translate(cx, y);
  g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.moveTo(-hw - up, -up + 5); g.quadraticCurveTo(-hw * 0.5, 14, 0, 12); g.quadraticCurveTo(hw * 0.5, 14, hw + up, -up + 5); g.lineTo(hw, 8); g.lineTo(-hw, 8); g.fill();
  g.beginPath(); g.moveTo(-hw - up, -up); g.quadraticCurveTo(-hw * 0.55, 9, 0, 8); g.quadraticCurveTo(hw * 0.55, 9, hw + up, -up);
  g.quadraticCurveTo(hw * 0.7, -rise * 0.55, hw * 0.4, -rise); g.lineTo(-hw * 0.4, -rise); g.quadraticCurveTo(-hw * 0.7, -rise * 0.55, -hw - up, -up); g.closePath();
  g.fillStyle = LG(g, 0, -rise, 0, 10, [lite(col, 0.28), col, dark(col, 0.25)]); g.fill(); g.save(); g.clip();
  g.strokeStyle = rgba(dark(col, 0.5), 0.55); g.lineWidth = 1.1; g.beginPath(); for (let i = -hw - up; i < hw + up; i += 7) { g.moveTo(i * 0.55, -rise); g.lineTo(i, 14); } g.stroke();
  g.strokeStyle = rgba(lite(col, 0.4), 0.5); g.beginPath(); for (let k = 1; k < 5; k++) { const yy = -rise + (rise + 10) * k / 5; g.moveTo(-hw - up, yy); g.lineTo(hw + up, yy); } g.stroke(); g.restore();
  g.strokeStyle = tg; g.lineWidth = 3; g.beginPath(); g.moveTo(-hw - up, -up); g.quadraticCurveTo(-hw * 0.55, 9, 0, 8); g.quadraticCurveTo(hw * 0.55, 9, hw + up, -up); g.stroke();
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-hw - up, -up); g.quadraticCurveTo(-hw * 0.7, -rise * 0.55, -hw * 0.4, -rise); g.lineTo(hw * 0.4, -rise); g.quadraticCurveTo(hw * 0.7, -rise * 0.55, hw + up, -up); g.stroke();
  g.fillStyle = tg; g.beginPath(); g.arc(-hw - up, -up - 2, 3.2, 0, TAU); g.arc(hw + up, -up - 2, 3.2, 0, TAU); g.fill(); rr(g, -hw * 0.42, -rise - 4, hw * 0.84, 5, 2); g.fill();
  g.restore();
}
function column(g, cx, y0, y1, r, col = '#f2ecdc') { g.fillStyle = LG(g, cx - r, 0, cx + r, 0, [dark(col, 0.12), lite(col, 0.4), col, dark(col, 0.3)]); g.fillRect(cx - r, y1, r * 2, y0 - y1); g.fillStyle = dark(col, 0.1); g.fillRect(cx - r - 3, y0 - 5, r * 2 + 6, 5); g.fillRect(cx - r - 3, y1, r * 2 + 6, 5); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(cx - r - 3, y1 + 5, r * 2 + 6, 2); }
function crenel(g, x0, x1, y, h, col, n = 9) { const w = (x1 - x0) / (n * 2 - 1); for (let i = 0; i < n; i++) { g.fillStyle = LG(g, 0, y - h, 0, y, [lite(col, 0.15), col]); g.fillRect(x0 + i * 2 * w, y - h, w, h); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x0 + i * 2 * w, y - h, w, 2); } }
function flagPole(g, x, y, h, t, col, w = 26) { // vlag die wappert
  g.strokeStyle = '#d8d8dc'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - h); g.stroke(); g.fillStyle = col; g.beginPath(); g.moveTo(x, y - h);
  const n = 8; for (let i = 1; i <= n; i++) g.lineTo(x + i / n * w, y - h + Math.sin(t * 4 + i * 0.9) * 2.2 * (i / n)); for (let i = n; i >= 0; i--) g.lineTo(x + i / n * w, y - h + 14 + Math.sin(t * 4 + i * 0.9) * 2.2 * (i / n)); g.closePath(); g.fill();
}

// ---------------------------------------------------------------- kabouterdorp
function mushroomDraw(v) {
  return (g, R, o) => {
    const night = o.night, cap = o.color, sw = [44, 33, 46][v], sh = [58, 118, 56][v], cw = [104, 92, 112][v], chh = [68, 66, 56][v], stemC = ['#f4ead0', '#efe6d2', '#e4d4b0'][v];
    g.save();
    softShadow(g, 54, 6, 110, 18, 0.34);
    if (v === 1) { // vijver
      const wp = new Path2D(); wp.ellipse(-78, 16, 52, 14, 0, 0, TAU); g.fillStyle = '#5a4630'; g.beginPath(); g.ellipse(-78, 16, 56, 17, 0, 0, TAU); g.fill();
      g.fillStyle = LG(g, 0, 4, 0, 30, ['#6ab8d8', '#2c6a96']); g.fill(wp); g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.ellipse(-92, 12, 14, 2.2, 0, 0, TAU); g.fill();
      g.fillStyle = '#4aa050'; g.beginPath(); g.ellipse(-62, 19, 9, 3.4, 0, 0.3, TAU); g.fill(); g.fillStyle = '#ffb0c8'; g.beginPath(); g.arc(-60, 17, 2.6, 0, TAU); g.fill();
    }
    if (v === 2) g.rotate(0.07);
    // stam
    g.beginPath(); g.moveTo(-sw * 1.25, 2); g.quadraticCurveTo(-sw * 0.8, -sh * 0.3, -sw * 0.78, -sh); g.lineTo(sw * 0.78, -sh); g.quadraticCurveTo(sw * 0.8, -sh * 0.3, sw * 1.25, 2); g.quadraticCurveTo(0, 12, -sw * 1.25, 2); g.closePath();
    g.fillStyle = LG(g, -sw, 0, sw, 0, [lite(stemC, 0.2), stemC, dark(stemC, 0.2), dark(stemC, 0.4)]); g.fill(); g.strokeStyle = 'rgba(80,50,20,.4)'; g.lineWidth = 1.6; g.stroke();
    g.save(); g.clip(); g.strokeStyle = 'rgba(120,80,40,.14)'; g.lineWidth = 2; for (let i = -sw; i < sw; i += 6) { g.beginPath(); g.moveTo(i, -sh); g.lineTo(i * 1.3, 4); g.stroke(); } g.fillStyle = LG(g, 0, 0, 0, -30, ['rgba(60,30,10,.3)', 'rgba(60,30,10,0)']); g.fillRect(-sw * 1.3, -30, sw * 2.6, 34); g.restore();
    // deur en ramen
    const dh = v === 1 ? 44 : 36, dw = 21; door(g, -dw / 2 + (v === 2 ? 6 : 0), -dh, dw, dh, v === 2 ? '#6a4020' : '#8a5a2c', { arch: true, frame: '#d8b878' });
    stairs(g, -14, 14, 2, 4, '#9a9a96');
    const wn = (x, y, r) => { g.fillStyle = '#7a5428'; g.beginPath(); g.arc(x, y, r + 3, 0, TAU); g.fill(); g.fillStyle = LG(g, x, y - r, x, y + r, night > 0.3 ? ['#ffe9a0', '#ff9a40'] : ['#aad4f0', '#4c78a0']); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.strokeStyle = '#7a5428'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x - r, y); g.lineTo(x + r, y); g.moveTo(x, y - r); g.lineTo(x, y + r); g.stroke(); g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(x - r * 0.35, y - r * 0.35, r * 0.28, 0, TAU); g.fill(); };
    if (v === 0) { wn(-27, -34, 8); wn(27, -34, 8); } else if (v === 1) { wn(0, -75, 9); wn(-17, -100, 6); wn(17, -100, 6); g.fillStyle = '#8a5a2c'; g.fillRect(-18, -88, 36, 3); } else { wn(-24, -30, 9); wn(25, -40, 5.5); g.fillStyle = '#a88858'; g.fillRect(14, -52, 22, 6); }
    // hoed
    const top = -sh;
    g.fillStyle = LG(g, 0, top - 2, 0, top + 16, ['#4a3020', '#c8b898']); g.beginPath(); g.ellipse(0, top + 1, cw * 0.97, 15, 0, 0, Math.PI); g.fill(); // plaatjes (lamellen)
    g.strokeStyle = 'rgba(90,60,30,.35)'; g.lineWidth = 1; for (let i = -cw * 0.9; i < cw * 0.9; i += 7) { g.beginPath(); g.moveTo(i, top + 3); g.lineTo(i * 0.96, top + 3 + 13 * Math.sqrt(Math.max(0, 1 - (i / cw) * (i / cw)))); g.stroke(); }
    g.beginPath(); g.moveTo(-cw, top); g.bezierCurveTo(-cw * 1.02, top - chh * 1.35, cw * 1.02, top - chh * 1.35, cw, top); g.quadraticCurveTo(0, top + 17, -cw, top); g.closePath();
    g.fillStyle = RG(g, 0, top - chh * 0.5, 4, cw * 1.1, [lite(cap, 0.38), cap, dark(cap, 0.28), dark(cap, 0.55)], -cw * 0.3, top - chh * 0.85); g.fill();
    g.save(); g.clip(); const sp = R(); const spots = v === 1 ? [[-44, -0.5, 9], [-8, -0.8, 11], [32, -0.55, 8], [58, -0.2, 6], [-70, -0.25, 7], [12, -0.3, 7]] : [[-52, -0.55, 11], [-14, -0.85, 13], [30, -0.65, 10], [62, -0.3, 8], [-78, -0.25, 7], [8, -0.28, 8], [48, -0.12, 5]];
    for (const [sx0, sy0, sr] of spots) { const px = sx0, py = top + chh * sy0 * 1.0 * 1; g.fillStyle = v === 2 ? '#f0e0b0' : '#fff'; g.beginPath(); g.ellipse(px, py, sr, sr * 0.72, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(0,0,0,.12)'; g.beginPath(); g.ellipse(px + 2, py + 3, sr * 0.8, sr * 0.5, 0, 0, TAU); g.fill(); }
    g.fillStyle = LG(g, 0, top - 4, 0, top + 18, ['rgba(0,0,0,0)', 'rgba(0,0,0,.35)']); g.fillRect(-cw, top - 4, cw * 2, 24);
    g.fillStyle = 'rgba(255,255,255,.28)'; g.beginPath(); g.ellipse(-cw * 0.38, top - chh * 0.62, cw * 0.28, chh * 0.13, -0.55, 0, TAU); g.fill(); g.restore();
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(-cw, top); g.bezierCurveTo(-cw * 1.02, top - chh * 1.35, cw * 1.02, top - chh * 1.35, cw, top); g.quadraticCurveTo(0, top + 17, -cw, top); g.stroke();
    // schoorsteen
    if (v !== 1) { const cx = cw * 0.42, cy = top - chh * 0.78; g.save(); g.translate(cx, cy); g.rotate(v === 2 ? -0.25 : 0.1); box3(g, -7, 7, 0, 22, 0, 10, '#9a5a42'); g.fillStyle = '#2a1a14'; g.fillRect(-8, -24, 16, 4); g.restore(); }
    // tuin
    if (v === 0) { fence(g, -cw * 0.95, 30, -34, '#e8dcc0', 12); fence(g, 34, 30, cw * 0.95, '#e8dcc0', 12); flowers(g, R, -100, 16, 62, 20, 18, ['#ff6a8a', '#ffe060', '#fff', '#c070ff']); flowers(g, R, 38, 16, 62, 20, 18, ['#ff6a8a', '#ffe060', '#fff', '#c070ff']); g.fillStyle = '#6a4a2a'; g.fillRect(70, 0, 3, 18); g.fillStyle = '#d83a2a'; rr(g, 64, -6, 16, 10, 3); g.fill(); }
    if (v === 1) { flowers(g, R, 28, 14, 70, 22, 22, ['#80c0ff', '#fff', '#ffe060']); bush(g, 82, 14, 0.9, '#2f7a3a', R); g.fillStyle = '#ffe9a0'; g.fillRect(36, -16, 2, 20); g.fillStyle = night > 0.3 ? '#ffd060' : '#d8c060'; g.fillRect(31, -22, 12, 8); }
    if (v === 2) { g.save(); g.rotate(-0.07); fence(g, -118, 28, -40, '#b89868', 12); g.restore(); flowers(g, R, 40, 14, 60, 18, 10, ['#ff9a3a', '#ffe060']); rock(g, 66, 14, 0.8); g.fillStyle = '#c87a3a'; g.beginPath(); g.ellipse(-94, 6, 6, 10, 0, 0, TAU); g.fill(); }
    g.restore();
  };
}
const mushRoof = (v) => (g, t) => { const cw = [104, 92, 112][v], sh = [58, 118, 56][v], chh = [68, 66, 56][v]; if (v !== 1) { g.save(); if (v === 2) g.rotate(0.07); smokeAt(g, cw * 0.42, -sh - chh * 0.78 - 24, t, { rise: 60, a: 0.55, drift: 16, seed: v * 0.3 }); g.restore(); } };
BUILD.m1 = { bb: [150, 170, 175, 40], hw: 105, up: 135, draw: mushroomDraw(0), anim: mushRoof(0), lights: [[-27, -34, 26, '#ffc060', 0.5, 0.4], [27, -34, 26, '#ffc060', 0.5, 0.4]] };
BUILD.m2 = { bb: [160, 170, 215, 40], hw: 96, up: 185, draw: mushroomDraw(1), anim: mushRoof(1), lights: [[0, -75, 28, '#ffc060', 0.5, 0.4]] };
BUILD.m3 = { bb: [160, 175, 175, 40], hw: 110, up: 125, draw: mushroomDraw(2), anim: mushRoof(2), lights: [[-24, -30, 26, '#ffc060', 0.5, 0.5]] };

BUILD.townhall = {
  bb: [150, 195, 262, 40], hw: 128, up: 232,
  draw(g, R, o) {
    const st = '#e8dcc0', rc = '#b83c30', n = o.night;
    hullShadow(g, [[-130, 0], [130, 0], [150 + 30, -36], [-110, -36]], 120, 0.32, 8);
    box3(g, -130, -38, 0, 78, 0, 54, st); roofX(g, -130, -38, 78, 0, 54, 34, rc, { wall: st });
    box3(g, 38, 130, 0, 78, 0, 54, st); roofX(g, 38, 130, 78, 0, 54, 34, rc, { wall: st });
    box3(g, -44, 44, 0, 122, 0, 62, st, { ff: LG(g, 0, -122, 0, 0, [lite(st, 0.12), dark(st, 0.1)]) });
    for (let i = 0; i < 2; i++) for (let k = 0; k < 2; k++) { const x = i ? 62 + k * 34 : -96 + k * 34; win(g, x, -64, 18, 30, { lit: n * 0.7, shut: '#3a7a4a', arch: false }); }
    for (const sgn of [-1, 1]) win(g, sgn * 30 - 8, -108, 16, 22, { lit: n * 0.7, arch: true });
    // klokkentoren
    box3(g, -24, 24, 122, 168, 8, 38, '#efe4cc'); g.save(); g.translate(0, 0);
    const clockY = -147; g.fillStyle = '#c8a040'; g.beginPath(); g.arc(0, clockY, 17, 0, TAU); g.fill(); g.fillStyle = '#fffdf0'; g.beginPath(); g.arc(0, clockY, 14, 0, TAU); g.fill(); g.strokeStyle = '#2a2018'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, clockY); g.lineTo(0, clockY - 10); g.moveTo(0, clockY); g.lineTo(7, clockY + 3); g.stroke(); for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; g.beginPath(); g.moveTo(Math.cos(a) * 12, clockY + Math.sin(a) * 12); g.lineTo(Math.cos(a) * 13.5, clockY + Math.sin(a) * 13.5); g.stroke(); } g.restore();
    poly3(g, [[-30, 168, 0], [30, 168, 0], [0, 224, 21]], LG(g, -30, 0, 30, 0, [lite(rc, 0.1), dark(rc, 0.2)]), 'rgba(0,0,0,.35)');
    poly3(g, [[30, 168, 0], [30, 168, 42], [0, 224, 21]], dark(rc, 0.4), 'rgba(0,0,0,.35)');
    g.fillStyle = '#e8c050'; g.beginPath(); g.arc(sx(0, 21), sy(226, 21), 3.4, 0, TAU); g.fill();
    // portiek
    for (const cx of [-30, -10, 10, 30]) column(g, cx, -2, -62, 4.5, '#f6f0e0'); box3(g, -38, 38, 62, 70, -4, 14, '#efe4cc', { ao: false }); poly3(g, [[-42, 70, -6], [42, 70, -6], [0, 90, -6]], '#e8dcc0', 'rgba(0,0,0,.3)');
    sign(g, 'GEMEENTEHUIS', -34, -69, 68, 10, '#2a5a3a', '#ffe9a0', { fs: 8 });
    door(g, -11, -50, 22, 48, '#5a3a20', { arch: true, frame: '#f0e8d8' }); stairs(g, -38, 38, 3, 4, '#bdb6a6');
    for (const sgn of [-1, 1]) { bush(g, sgn * 112, 14, 1.1, '#2f7a3a', R); lamppost(g, sgn * 70, 22, 0.9, n, 'wood'); }
    flowers(g, R, -100, 16, 200, 14, 30, ['#ff6a8a', '#ffe060', '#fff']);
  },
  anim(g, t, n) { flagPole(g, sx(0, 21), sy(224, 21), 30, t, '#d03a3a', 26); },
  lights: [[-30, -90, 30, '#ffc060', 0.35, 0.3], [30, -90, 30, '#ffc060', 0.35, 0.3], [-20, 20, 24, '#ffd890', 0.3, 0.4], [20, 20, 24, '#ffd890', 0.3, 0.4]],
};

BUILD.mushbank = {
  bb: [150, 190, 220, 40], hw: 125, up: 185,
  draw(g, R, o) {
    const st = '#e6ddc8', n = o.night;
    hullShadow(g, [[-120, 0], [120, 0], [150, -34], [-100, -34]], 100, 0.32, 8);
    box3(g, -120, 120, 0, 92, 0, 56, st, { ff: LG(g, 0, -92, 0, 0, [lite(st, 0.1), dark(st, 0.1)]) });
    // ramen met tralies
    for (const x of [-100, -76, 62, 86]) { win(g, x, -62, 14, 30, { lit: n * 0.6, frame: '#c8b068', cols: 1 }); g.strokeStyle = '#2a2a30'; g.lineWidth = 1.2; for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(x + k * 3.5, -62); g.lineTo(x + k * 3.5, -32); g.stroke(); } }
    for (const cx of [-56, -19, 19, 56]) column(g, cx, -2, -78, 7, '#f4eedc');
    box3(g, -66, 66, 78, 92, -6, 14, '#efe6d0', { ao: false });
    sign(g, 'BANK', -26, -92, 52, 13, '#2a5a3a', '#ffe9a0', { border: '#e0b850' });
    // kluisdeur
    g.fillStyle = '#c8a040'; g.beginPath(); g.arc(0, -34, 26, 0, TAU); g.fill(); g.fillStyle = LG(g, -20, -54, 20, -14, ['#f0d070', '#a8802a']); g.beginPath(); g.arc(0, -34, 22, 0, TAU); g.fill();
    g.strokeStyle = '#6a4a10'; g.lineWidth = 2; g.beginPath(); g.arc(0, -34, 14, 0, TAU); g.stroke(); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; g.beginPath(); g.moveTo(0, -34); g.lineTo(Math.cos(a) * 14, -34 + Math.sin(a) * 14); g.stroke(); } g.fillStyle = '#6a4a10'; g.beginPath(); g.arc(0, -34, 4, 0, TAU); g.fill();
    stairs(g, -70, 70, 3, 4, '#c8c0ac');
    // paddenstoelhoed op het dak
    const top = -92, cw = 122, chh = 62, cap = '#d8362a';
    g.fillStyle = LG(g, 0, top - 2, 0, top + 14, ['#4a3020', '#c8b898']); g.beginPath(); g.ellipse(0, top + 1, cw * 0.95, 13, 0, 0, Math.PI); g.fill();
    g.beginPath(); g.moveTo(-cw, top); g.bezierCurveTo(-cw * 1.0, top - chh * 1.35, cw * 1.0, top - chh * 1.35, cw, top); g.quadraticCurveTo(0, top + 16, -cw, top); g.closePath(); g.fillStyle = RG(g, 0, top - chh * 0.5, 4, cw * 1.1, [lite(cap, 0.35), cap, dark(cap, 0.3), dark(cap, 0.55)], -cw * 0.3, top - chh * 0.9); g.fill();
    g.save(); g.clip(); for (const [px, py, sr] of [[-70, 0.55, 11], [-30, 0.85, 13], [20, 0.7, 11], [60, 0.45, 9], [-96, 0.25, 8], [92, 0.22, 6], [-4, 0.28, 8]]) { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(px, top - chh * py, sr, sr * 0.7, 0, 0, TAU); g.fill(); } g.fillStyle = LG(g, 0, top - 4, 0, top + 16, ['rgba(0,0,0,0)', 'rgba(0,0,0,.35)']); g.fillRect(-cw, top - 4, cw * 2, 22); g.fillStyle = 'rgba(255,255,255,.26)'; g.beginPath(); g.ellipse(-cw * 0.4, top - chh * 0.65, cw * 0.28, chh * 0.12, -0.5, 0, TAU); g.fill(); g.restore();
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(-cw, top); g.bezierCurveTo(-cw, top - chh * 1.35, cw, top - chh * 1.35, cw, top); g.quadraticCurveTo(0, top + 16, -cw, top); g.stroke();
    // geldzakken en lantaarns
    for (const sgn of [-1, 1]) { lamppost(g, sgn * 100, 24, 0.9, n, 'wood'); bush(g, sgn * 130, 14, 1, '#2f7a3a', R); }
    g.fillStyle = '#c8a040'; for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(-110 + k * 5, 18 - (k % 2) * 3, 5, 0, TAU); g.fill(); g.strokeStyle = '#6a4a10'; g.lineWidth = 1; g.stroke(); }
  },
  anim(g, t) { g.save(); g.globalCompositeOperation = 'lighter'; const a = 0.25 + Math.sin(t * 3) * 0.12; glowBlob(g, 0, -34, 40, '#ffd860', a); g.restore(); },
  lights: [[-88, -45, 26, '#ffc060', 0.3, 0.3], [74, -45, 26, '#ffc060', 0.3, 0.3]],
};

// ---------------------------------------------------------------- Nederland
BUILD.rowhouse = {
  bb: [150, 190, 200, 44], hw: 108, up: 160,
  draw(g, R, o) {
    const n = o.night; hullShadow(g, [[-100, 0], [100, 0], [100 + 0.6 * 60, -26], [-100, -26]], 120, 0.3, 7);
    const hs = [{ x0: -102, x1: -34, h: 104, br: '#b5543a', rf: '#3e4452', dr: '#2f6a8a' }, { x0: -34, x1: 34, h: 128, br: '#a04630', rf: '#8a3a2a', dr: '#3a7a4a' }, { x0: 34, x1: 102, h: 110, br: '#c2704e', rf: '#4a4452', dr: '#a83a2a' }];
    for (const hh of hs) {
      box3(g, hh.x0, hh.x1, 0, hh.h, 0, 56, hh.br, { ff: LG(g, 0, -hh.h, 0, 0, [lite(hh.br, 0.1), dark(hh.br, 0.14)]) }); brick(g, hh.x0, hh.x1, 0, hh.h, hh.br, R);
      roofZ(g, hh.x0, hh.x1, hh.h, 0, 56, 34, hh.rf, hh.br, { ov: 3 });
      const cx = (hh.x0 + hh.x1) / 2; win(g, cx - 9, -hh.h + 16, 18, 24, { lit: n * 0.6 }); win(g, hh.x0 + 8, -hh.h + 52, 15, 24, { lit: n * 0.6 }); win(g, hh.x1 - 23, -hh.h + 52, 15, 24, { lit: n * 0.6 });
      if (hh.h > 120) win(g, cx - 8, -hh.h + 52 - 0, 16, 22, { lit: n * 0.6 });
      door(g, hh.x1 - 25, -36, 17, 34, hh.dr); win(g, hh.x0 + 8, -40, 16, 22, { lit: n * 0.7 }); g.fillStyle = '#a89a88'; g.fillRect(hh.x0 + 3, -3, hh.x1 - hh.x0 - 6, 3);
      // bloembak
      g.fillStyle = '#5a3a28'; g.fillRect(hh.x0 + 6, -17, 20, 4);
    }
    // schoorstenen
    box3(g, -62, -50, 120, 140, 24, 36, '#8a4a38'); box3(g, 56, 68, 128, 148, 24, 36, '#8a4a38');
    // tulpenborders en fiets
    for (const [x, w, cols] of [[-100, 66, ['#e8342a', '#ffd23a']], [-30, 62, ['#ff9ec0', '#fff', '#e8342a']], [38, 62, ['#ffd23a', '#c070ff']]]) { g.fillStyle = '#4a3320'; g.fillRect(x, 8, w, 12); tulips(g, R, x + 2, 6, w - 4, 14, cols, 2); }
    drawBike(g, 118, 22, 1, 0, '#2a6ac0'); g.fillStyle = '#6a6a62'; g.fillRect(-104, 20, 210, 5);
    lamppost(g, -118, 26, 0.8, n);
  },
  anim(g, t) { smokeAt(g, -56, -142, t, { rise: 44, a: 0.5 }); smokeAt(g, 62, -150, t, { rise: 44, a: 0.5, seed: 0.5 }); },
  lights: [[-52, -80, 24, '#ffc870', 0.4, 0.3], [0, -90, 26, '#ffc870', 0.4, 0.3], [70, -70, 24, '#ffc870', 0.35, 0.3]],
};
BUILD.canalhouse = {
  bb: [150, 190, 250, 44], hw: 100, up: 225,
  draw(g, R, o) {
    const n = o.night; hullShadow(g, [[-100, 0], [100, 0], [160, -26], [-60, -26]], 190, 0.3, 8);
    // buurhuis rechts (laag, trapgevel)
    const nb = '#d8c8a8'; box3(g, 34, 104, 0, 132, 0, 64, nb); brick(g, 34, 104, 0, 132, nb, R, 14, 8);
    for (let k = 0; k < 3; k++) box3(g, 44 + k * 8, 94 - k * 8, 132 + k * 12, 144 + k * 12, 0, 64, nb, { ao: false });
    // hoofdhuis (donkerrood, klokgevel)
    const br = '#8a3a2a'; box3(g, -100, 34, 0, 170, 0, 66, br); brick(g, -100, 34, 0, 170, br, R, 14, 8);
    box3(g, -80, 14, 170, 190, 0, 66, br, { ao: false }); brick(g, -80, 14, 170, 190, br, R, 14, 8); box3(g, -58, -8, 190, 204, 0, 66, br, { ao: false }); box3(g, -36, 14 - 36, 204, 214, 0, 66, '#efe8d8', { ao: false });
    // witte gevelrand
    g.strokeStyle = '#f2ecdc'; g.lineWidth = 3; g.beginPath(); g.moveTo(-100, -170); g.lineTo(-80, -170); g.lineTo(-80, -190); g.lineTo(-58, -190); g.lineTo(-58, -204); g.lineTo(-8, -204); g.lineTo(-8, -190); g.lineTo(14, -190); g.lineTo(14, -170); g.lineTo(34, -170); g.stroke();
    // hijsbalk
    g.strokeStyle = '#3a2a1a'; g.lineWidth = 4; g.beginPath(); g.moveTo(-33, -214); g.lineTo(-33, -236); g.lineTo(-18, -240); g.stroke(); g.lineWidth = 1.4; g.beginPath(); g.moveTo(-18, -240); g.lineTo(-18, -222); g.stroke(); g.beginPath(); g.arc(-18, -219, 3, 0, Math.PI); g.stroke();
    // ramen met luiken (hoog, smal)
    for (const y of [-28, -78, -128]) for (const x of [-84, -42, 0]) { if (y === -28 && x === -42) continue; win(g, x, y - 34, 16, 34, { lit: n * 0.7, shut: '#2a5a3a', arch: false }); }
    win(g, -26, -200, 14, 16, { lit: n * 0.6, arch: true, frame: '#f2ecdc' });
    door(g, -50, -42, 22, 40, '#1f4a3a', { frame: '#f2ecdc' }); stairs(g, -56, -22, 3, 4, '#a89a88'); g.fillStyle = '#f2ecdc'; g.fillRect(-100, -4, 134, 4);
    for (const y of [-40, -90, -140]) win(g, 52, y - 22, 16, 24, { lit: n * 0.6 }); win(g, 78, -140 - 22, 16, 24, { lit: n * 0.6 }); win(g, 78, -90 - 22, 16, 24, { lit: n * 0.6 }); win(g, 78, -40 - 22, 16, 24, { lit: n * 0.6 }); door(g, 52, -44, 18, 42, '#c8a040'); win(g, 52, -92 - 40, 16, 24, { lit: n * 0.6 });
    // gracht-hekje en fiets
    g.fillStyle = '#2a2a30'; g.fillRect(-110, 18, 230, 3); for (let x = -108; x < 118; x += 12) g.fillRect(x, 8, 2, 12); drawBike(g, -92, 30, -1, 0, '#c02828');
    lamppost(g, 112, 30, 0.85, n);
  },
  lights: [[-76, -62, 24, '#ffc870', 0.4, 0.3], [-34, -112, 24, '#ffc870', 0.4, 0.3], [8, -162, 24, '#ffc870', 0.4, 0.3], [88, -62, 24, '#ffc870', 0.35, 0.3]],
};
BUILD.supermarket = {
  bb: [160, 200, 160, 50], hw: 150, up: 118,
  draw(g, R, o) {
    const n = o.night; hullShadow(g, [[-140, 0], [140, 0], [140 + 0.6 * 80, -34], [-140, -34]], 90, 0.3, 7);
    const wc = '#f4f2ec'; box3(g, -140, 140, 0, 82, 0, 80, wc, { ff: LG(g, 0, -82, 0, 0, [lite(wc, 0.1), dark(wc, 0.1)]) });
    // glazen pui
    g.fillStyle = '#2a3a4a'; g.fillRect(-124, -66, 180, 64); g.fillStyle = LG(g, 0, -66, 0, -2, n > 0.2 ? ['#fff2c0', '#ffd890'] : ['#a8d0e8', '#5a88a8']); g.fillRect(-122, -64, 176, 60);
    g.fillStyle = 'rgba(40,60,40,.75)'; for (let k = 0; k < 6; k++) { g.fillRect(-116 + k * 28, -40, 20, 6); g.fillRect(-116 + k * 28, -24, 20, 6); g.fillStyle = k % 2 ? '#e84a3a' : '#f0c030'; g.fillRect(-114 + k * 28, -46, 16, 5); g.fillRect(-114 + k * 28, -30, 16, 5); g.fillStyle = 'rgba(40,60,40,.75)'; }
    g.strokeStyle = '#d8dce0'; g.lineWidth = 3; for (let x = -122; x <= 54; x += 44) { g.beginPath(); g.moveTo(x, -64); g.lineTo(x, -4); g.stroke(); } g.fillStyle = 'rgba(255,255,255,.2)'; g.beginPath(); g.moveTo(-122, -30); g.lineTo(-70, -64); g.lineTo(-40, -64); g.lineTo(-122, -4); g.fill();
    // schuifdeuren
    g.fillStyle = '#9ac8e8'; g.fillRect(70, -60, 46, 58); g.strokeStyle = '#d8dce0'; g.lineWidth = 3; g.strokeRect(70, -60, 46, 58); g.beginPath(); g.moveTo(93, -60); g.lineTo(93, -2); g.stroke(); g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(74, -56, 10, 40);
    // luifel en bord
    g.fillStyle = '#2f9a4a'; g.fillRect(-140, -86, 280, 20); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(-140, -70, 280, 4); g.fillStyle = '#f0a020'; g.fillRect(-140, -90, 280, 5);
    // dak met airco
    box3(g, -90, -50, 82, 94, 20, 52, '#c8ccd0'); box3(g, 20, 70, 82, 98, 30, 62, '#c8ccd0'); g.strokeStyle = 'rgba(0,0,0,.3)'; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(sx(26 + k * 10, 30), sy(98, 30)); g.lineTo(sx(26 + k * 10, 30), sy(82, 30)); g.stroke(); }
    sign(g, 'SUPER', -96, -128, 130, 40, '#f0a020', '#fff', { fs: 30, border: '#2f9a4a' }); g.fillStyle = '#2f9a4a'; g.beginPath(); g.arc(-110, -108, 12, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.font = `700 14px ${FONT}`; g.textAlign = 'center'; g.fillText('S', -110, -103);
    // winkelwagentjes
    for (let k = 0; k < 4; k++) { const x = 22 + k * 13; g.strokeStyle = '#8a8f98'; g.lineWidth = 1.4; g.strokeRect(x, 6 - k * 0.5, 12, 8); g.beginPath(); g.moveTo(x, 6); g.lineTo(x - 3, 0); g.stroke(); g.fillStyle = '#222'; g.beginPath(); g.arc(x + 2, 17, 1.6, 0, TAU); g.arc(x + 10, 17, 1.6, 0, TAU); g.fill(); }
    flowers(g, R, -128, 8, 70, 12, 14, ['#ff6a8a', '#ffe060', '#fff']); bush(g, -132, 20, 0.9, '#3a8a3a', R); g.fillStyle = '#6a6a62'; g.fillRect(-140, 16, 190, 4);
  },
  anim(g, t, n) { g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(255,240,180,${0.1 + n * 0.14})`; g.fillRect(-122, -64, 176, 60); g.restore(); },
  lights: [[-34, -34, 70, '#ffe0a0', 0.35, 0.2]],
};
BUILD.casino = {
  bb: [150, 200, 250, 52], hw: 125, up: 210,
  draw(g, R, o) {
    const n = o.night; hullShadow(g, [[-120, 0], [120, 0], [120 + 0.6 * 70, -30], [-120, -30]], 120, 0.34, 8);
    const c = '#42245a'; box3(g, -120, 120, 0, 110, 0, 70, c, { ff: LG(g, 0, -110, 0, 0, [lite(c, 0.14), dark(c, 0.12)]) });
    g.fillStyle = '#e8c050'; g.fillRect(-120, -112, 240, 5); g.fillRect(-120, -44, 240, 3);
    // gouden zuilen
    for (const x of [-96, -64, 64, 96]) column(g, x, -2, -108, 5, '#e8c860');
    for (const x of [-100, -70, 56, 86]) { win(g, x, -96, 14, 26, { lit: 0.9, frame: '#e8c050' }); win(g, x, -62, 14, 26, { lit: 0.9, frame: '#e8c050' }); }
    // entree-boog
    g.fillStyle = '#d02a4a'; g.fillRect(-26, -4, 52, 3); g.fillStyle = '#16101e'; g.beginPath(); g.moveTo(-28, -2); g.lineTo(-28, -52); g.arc(0, -52, 28, Math.PI, 0); g.lineTo(28, -2); g.fill();
    g.fillStyle = LG(g, 0, -80, 0, 0, ['#ffe090', '#d8602a']); g.beginPath(); g.moveTo(-22, -2); g.lineTo(-22, -52); g.arc(0, -52, 22, Math.PI, 0); g.lineTo(22, -2); g.fill();
    stairs(g, -34, 34, 2, 4, '#7a2030'); g.fillStyle = '#d02a4a'; g.fillRect(-18, 2, 36, 22);
    // neonbord op het dak
    g.fillStyle = '#2a1a38'; g.fillRect(-90, -178, 180, 62); g.fillStyle = '#e8c050'; g.fillRect(-95, -184, 190, 6); g.fillRect(-95, -118, 190, 4);
    g.save(); g.shadowColor = '#ff3a8a'; g.shadowBlur = 16; g.font = `700 44px ${FONT}`; g.textAlign = 'center'; g.fillStyle = '#ff5aa0'; g.fillText('CASINO', 0, -132); g.shadowColor = '#fff'; g.shadowBlur = 4; g.fillStyle = '#ffe6f2'; g.fillText('CASINO', 0, -132); g.restore();
    // dobbelstenen en schoppen
    g.save(); g.translate(-72, -150); g.rotate(-0.2); g.fillStyle = '#fff'; rr(g, -12, -12, 24, 24, 5); g.fill(); g.fillStyle = '#d02a4a'; for (const [a, b] of [[-6, -6], [6, 6], [0, 0], [-6, 6], [6, -6]]) { g.beginPath(); g.arc(a, b, 2.4, 0, TAU); g.fill(); } g.restore();
    g.fillStyle = '#ffe9a0'; g.beginPath(); g.moveTo(74, -140); g.bezierCurveTo(60, -158, 86, -164, 74, -148); g.fill(); g.font = `700 26px ${FONT}`; g.fillStyle = '#ff5aa0'; g.fillText('♠', 76, -142);
    // rode loper en kolommen met touw
    g.fillStyle = '#d8b040'; for (const x of [-36, 36]) { g.fillRect(x - 1.5, 4, 3, 16); g.beginPath(); g.arc(x, 4, 4, 0, TAU); g.fill(); } g.strokeStyle = '#b02a3a'; g.lineWidth = 2; g.beginPath(); g.moveTo(-36, 7); g.quadraticCurveTo(0, 18, 36, 7); g.stroke();
    lamppost(g, -120, 26, 0.8, 1);
  },
  anim(g, t) {
    // bolletjes langs het bord knipperen
    for (let k = 0; k < 18; k++) { const x = -88 + k * 10.4, on = Math.floor(t * 4 + k) % 3 === 0; g.fillStyle = on ? '#fff6b0' : '#6a5a30'; g.beginPath(); g.arc(x, -181, 2.2, 0, TAU); g.fill(); g.beginPath(); g.arc(x, -116, 2.2, 0, TAU); g.fill(); }
    g.save(); g.globalCompositeOperation = 'lighter'; const a = 0.22 + Math.sin(t * 7) * 0.05 + (Math.sin(t * 31) > 0.92 ? -0.12 : 0); glowBlob(g, 0, -150, 90, '#ff3a8a', a); g.restore();
    // zoeklichten
    g.save(); g.globalCompositeOperation = 'lighter'; for (const [bx, ph] of [[-104, 0], [104, 2]]) { const ang = -Math.PI / 2 + Math.sin(t * 0.8 + ph) * 0.5; g.fillStyle = LG(g, bx, -190, bx + Math.cos(ang) * 130, -190 + Math.sin(ang) * 130, ['rgba(255,240,180,.28)', 'rgba(255,240,180,0)']); g.beginPath(); g.moveTo(bx - 5, -190); g.lineTo(bx + 5, -190); g.lineTo(bx + Math.cos(ang) * 130 + 22, -190 + Math.sin(ang) * 130); g.lineTo(bx + Math.cos(ang) * 130 - 22, -190 + Math.sin(ang) * 130); g.fill(); } g.restore();
  },
  lights: [[0, -20, 60, '#ffb050', 0.4, 0.4], [-100, -78, 40, '#ffd070', 0.3, 0.3], [90, -78, 40, '#ffd070', 0.3, 0.3]],
};
BUILD.chinese = {
  bb: [160, 200, 220, 52], hw: 115, up: 192,
  draw(g, R, o) {
    const n = o.night; hullShadow(g, [[-100, 0], [100, 0], [100 + 0.6 * 60, -26], [-100, -26]], 130, 0.3, 7);
    const rc = '#b8261e'; box3(g, -100, 100, 0, 72, 0, 60, rc, { ff: LG(g, 0, -72, 0, 0, [lite(rc, 0.1), dark(rc, 0.15)]) });
    for (const x of [-100, -52, 52, 98]) { g.fillStyle = LG(g, x - 5, 0, x + 5, 0, ['#e8442a', '#8a1a14']); g.fillRect(x - 5, -72, 10, 72); }
    g.fillStyle = '#e8c050'; g.fillRect(-100, -72, 200, 4);
    // gouden rondvenster en deur
    g.fillStyle = '#e8c050'; g.beginPath(); g.arc(-76, -40, 17, 0, TAU); g.fill(); g.fillStyle = LG(g, 0, -56, 0, -24, ['#ffe9a0', '#ff9a40']); g.beginPath(); g.arc(-76, -40, 14, 0, TAU); g.fill(); g.strokeStyle = '#7a1a10'; g.lineWidth = 2; for (let k = 0; k < 4; k++) { const a = k * Math.PI / 4; g.beginPath(); g.moveTo(-76 + Math.cos(a) * 14, -40 + Math.sin(a) * 14); g.lineTo(-76 - Math.cos(a) * 14, -40 - Math.sin(a) * 14); g.stroke(); }
    g.fillStyle = '#e8c050'; g.beginPath(); g.arc(76, -40, 17, 0, TAU); g.fill(); g.fillStyle = LG(g, 0, -56, 0, -24, ['#ffe9a0', '#ff9a40']); g.beginPath(); g.arc(76, -40, 14, 0, TAU); g.fill(); g.strokeStyle = '#7a1a10'; for (let k = 0; k < 4; k++) { const a = k * Math.PI / 4; g.beginPath(); g.moveTo(76 + Math.cos(a) * 14, -40 + Math.sin(a) * 14); g.lineTo(76 - Math.cos(a) * 14, -40 - Math.sin(a) * 14); g.stroke(); }
    g.fillStyle = '#e8c050'; g.beginPath(); g.moveTo(-28, -2); g.lineTo(-28, -42); g.arc(0, -42, 28, Math.PI, 0); g.lineTo(28, -2); g.fill(); g.fillStyle = '#5a1008'; g.beginPath(); g.moveTo(-23, -2); g.lineTo(-23, -42); g.arc(0, -42, 23, Math.PI, 0); g.lineTo(23, -2); g.fill();
    g.fillStyle = '#c02a20'; g.fillRect(-21, -42, 20, 40); g.fillRect(1, -42, 20, 40); g.fillStyle = '#e8c050'; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { g.beginPath(); g.arc(-17 + c * 6, -34 + r * 10, 1.4, 0, TAU); g.arc(5 + c * 6, -34 + r * 10, 1.4, 0, TAU); g.fill(); }
    // eerste dak, bovenverdieping, tweede dak
    pagodaRoof(g, 0, -72, 230, 30, '#1f6a5a', { trim: '#e8c050' });
    box3(g, -64, 64, 72, 118, 6, 54, '#c02a20'); for (const x of [-64, -22, 22, 64]) { g.fillStyle = LG(g, x - 4, 0, x + 4, 0, ['#e8442a', '#8a1a14']); g.fillRect(x - 4, -118, 8, 46); }
    for (const x of [-48, -6, 34]) win(g, x, -108, 14, 26, { lit: n * 0.8 + 0.1, frame: '#e8c050' });
    pagodaRoof(g, 0, -118, 170, 34, '#1f6a5a', { trim: '#e8c050' });
    // gouden draak boven
    g.save(); g.translate(0, -156); g.strokeStyle = '#e8c050'; g.lineWidth = 3.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(-16, 2); g.bezierCurveTo(-10, -14, -2, 6, 4, -8); g.bezierCurveTo(8, -16, 14, -8, 16, -14); g.stroke(); g.fillStyle = '#e8c050'; g.beginPath(); g.arc(17, -15, 3, 0, TAU); g.fill(); g.restore();
    sign(g, 'GOUDEN DRAAK', -70, -100 + 20, 140, 18, '#7a1a10', '#ffe08a', { fs: 13, border: '#e8c050' });
    // lantaarns en leeuwen
    for (const x of [-92, -40, 40, 92]) lantern(g, x, -66, 1, '#e8342a');
    for (const sgn of [-1, 1]) { g.save(); g.translate(sgn * 46, 0); g.fillStyle = LG(g, -9, 0, 9, 0, ['#e0d0a8', '#8a7a58']); rr(g, -9, -20, 18, 20, 5); g.fill(); g.beginPath(); g.arc(0, -26, 8, 0, TAU); g.fill(); g.fillStyle = '#3a2a1a'; g.fillRect(-4, -27, 2, 2); g.fillRect(2, -27, 2, 2); g.restore(); }
    stairs(g, -30, 30, 2, 4, '#9a9a90'); lamppost(g, 118, 30, 0.8, n);
  },
  anim(g, t) { for (const x of [-92, -40, 40, 92]) { g.save(); g.globalCompositeOperation = 'lighter'; glowBlob(g, x, -58, 20, '#ff4a2a', 0.5 + Math.sin(t * 3 + x) * 0.12); g.restore(); } },
  lights: [[-76, -40, 28, '#ffc060', 0.4, 0.3], [76, -40, 28, '#ffc060', 0.4, 0.3], [0, -30, 40, '#ffa040', 0.35, 0.3]],
};

// ---------------------------------------------------------------- China
BUILD.hutong = {
  bb: [150, 195, 225, 48], hw: 120, up: 190,
  draw(g, R, o) {
    const n = o.night, gr = '#8a8d94'; hullShadow(g, [[-110, 0], [110, 0], [110 + 0.6 * 70, -30], [-110, -30]], 90, 0.3, 7);
    // achterhal (met dak) en binnenplaatsboom
    box3(g, -80, 80, 0, 60, 70, 120, '#9a9a9e'); roofX(g, -80, 80, 60, 70, 120, 30, '#4a4d54', { wall: '#9a9a9e', ov: 10 });
    // gingko-boom op de binnenplaats
    g.save(); g.translate(sx(-60, 40), sy(0, 40)); g.fillStyle = '#4a3220'; g.fillRect(-3, -50, 6, 50); for (const [bx, by, br, c] of [[-14, -66, 22, '#d8b030'], [14, -68, 22, '#e0c040'], [0, -84, 24, '#e8c850']]) { g.fillStyle = RG(g, bx, by, 1, br, [lite(c, 0.3), c, dark(c, 0.3)], bx - 5, by - 6); g.beginPath(); g.arc(bx, by, br, 0, TAU); g.fill(); } g.restore();
    // muur van grijze baksteen
    box3(g, -110, 110, 0, 44, 0, 20, gr); brick(g, -110, 110, 0, 44, gr, R, 14, 7); g.fillStyle = '#5a5d64'; g.fillRect(-112, -48, 224, 6); g.fillStyle = '#4a4d54'; for (let x = -110; x < 110; x += 8) g.fillRect(x, -50, 6, 3);
    // poortgebouw
    box3(g, -36, 36, 0, 70, -8, 36, '#7a7d84', { ff: LG(g, 0, -70, 0, 0, [lite('#7a7d84', 0.1), dark('#7a7d84', 0.15)]) }); for (const x of [-36, 33]) { g.fillStyle = LG(g, x - 4, 0, x + 4, 0, ['#e8442a', '#8a1a14']); g.fillRect(x - 3, -70, 7, 70); }
    g.fillStyle = '#3a1008'; g.fillRect(-24, -52, 48, 50); g.fillStyle = LG(g, -24, 0, 24, 0, ['#d8382a', '#8a1a14']); g.fillRect(-23, -51, 23, 49); g.fillRect(1, -51, 22, 49); g.fillStyle = '#e8c050'; for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) { g.beginPath(); g.arc(-18 + c * 5.5, -44 + r * 9, 1.4, 0, TAU); g.arc(6 + c * 5.5, -44 + r * 9, 1.4, 0, TAU); g.fill(); } g.beginPath(); g.arc(-3, -26, 3, 0, TAU); g.arc(3, -26, 3, 0, TAU); g.fill();
    pagodaRoof(g, 0, -70, 100, 26, '#5a5d66', { trim: '#c8a040', up: 12 });
    sign(g, '', -14, -64, 28, 9, '#2a1008', '#e8c050'); stairs(g, -30, 30, 2, 4, '#8a8a84');
    for (const x of [-50, 50]) lantern(g, x, -40, 1.1, '#e8342a'); lantern(g, -34, -44, 0.9, '#e8342a'); lantern(g, 34, -44, 0.9, '#e8342a');
    // stenen leeuwen en bamboe
    for (const sgn of [-1, 1]) { g.save(); g.translate(sgn * 60, 10); g.fillStyle = LG(g, -8, 0, 8, 0, ['#c8c8c0', '#6a6a68']); rr(g, -8, -18, 16, 18, 4); g.fill(); g.beginPath(); g.arc(0, -24, 7, 0, TAU); g.fill(); g.restore(); }
    g.strokeStyle = '#6aa040'; g.lineWidth = 3; for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(100 + k * 4, 14); g.lineTo(100 + k * 4 + (k - 3) * 2, -50 - k * 5); g.stroke(); g.fillStyle = '#4a8a30'; for (let j = 0; j < 4; j++) { g.beginPath(); g.ellipse(100 + k * 4 + (k - 3) * 2 + 5, -50 - k * 5 + j * 8, 7, 2, 0.5, 0, TAU); g.fill(); } }
  },
  anim(g, t) { smokeAt(g, -30, -80, t, { rise: 42, a: 0.4 }); for (const x of [-50, 50, -34, 34]) { g.save(); g.globalCompositeOperation = 'lighter'; glowBlob(g, x, -34, 16, '#ff4a2a', 0.45 + Math.sin(t * 3 + x) * 0.1); g.restore(); } },
  lights: [[0, -30, 36, '#ff8a3a', 0.3, 0.3]],
};
BUILD.apartment = {
  bb: [110, 160, 230, 40], hw: 76, up: 205,
  draw(g, R, o) {
    const n = o.night, c = '#c8bca0'; hullShadow(g, [[-70, 0], [70, 0], [70 + 0.6 * 60, -26], [-70, -26]], 200, 0.3, 8);
    box3(g, -70, 70, 0, 190, 0, 64, c, { ff: LG(g, 0, -190, 0, 0, [lite(c, 0.12), dark(c, 0.16)]) });
    g.save(); g.fillStyle = 'rgba(90,70,50,.08)'; for (let i = 0; i < 60; i++) g.fillRect(-70 + R() * 140, -190 + R() * 190, 2 + R() * 14, 2 + R() * 10); g.restore();
    g.fillStyle = 'rgba(70,60,50,.35)'; for (let x = -66; x < 70; x += 18) g.fillRect(x + 4, -190, 3, 190 * (0.3 + R() * 0.6)); // regensporen
    for (let r = 0; r < 5; r++) for (let k = 0; k < 3; k++) {
      const x = -52 + k * 38, y = -54 - r * 34 + 4; const lit = ((r * 3 + k) * 7 % 5) / 5 < 0.35 + n * 0.5 ? 1 : 0; win(g, x, y - 16, 20, 22, { lit, frame: '#e8e0cc', cols: 1, thin: true });
      if (r > 0) { g.fillStyle = '#6a6a70'; g.fillRect(x - 4, y + 8, 28, 3); g.strokeStyle = '#4a4a50'; g.lineWidth = 1; g.beginPath(); for (let q = 0; q < 6; q++) { g.moveTo(x - 3 + q * 5.2, y + 8); g.lineTo(x - 3 + q * 5.2, y - 1); } g.stroke(); }
      if ((r + k) % 4 === 1) { g.fillStyle = '#b0b4b8'; g.fillRect(x + 2, y + 12, 14, 9); g.strokeStyle = '#6a6a70'; g.lineWidth = 0.8; g.strokeRect(x + 2, y + 12, 14, 9); }
      if ((r * 2 + k) % 5 === 2) { g.strokeStyle = '#8a8a8a'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - 4, y + 8); g.lineTo(x + 24, y + 8); g.stroke(); for (let q = 0; q < 4; q++) { g.fillStyle = ['#e8342a', '#f0f0e8', '#3a8ad0', '#f0c030'][q]; g.fillRect(x - 2 + q * 7, y + 9, 6, 9); } }
    }
    // winkelpui met rode luifel
    g.fillStyle = '#e8c860'; g.fillRect(-70, -34, 140, 34); awning(g, -68, -36, 136, 10, '#d02a20', '#f0e0b0', 9); g.fillStyle = LG(g, 0, -26, 0, -2, ['#ffe8a0', '#ffc060']); g.fillRect(-60, -26, 42, 24); door(g, 14, -30, 22, 28, '#5a3a2a'); g.fillStyle = '#e8342a'; g.fillRect(-56, -22, 8, 20); g.fillStyle = '#f0c030'; g.fillRect(-44, -22, 8, 20);
    box3(g, 60, 78, 0, 6, 0, 10, '#3a3a40', { ao: false });
    // dak: watertank en antennes
    box3(g, 70 - 40, 70 - 8, 190, 198, 20, 50, '#6a6a70'); cyl(g, -30, -196, -214, 12, '#8a6a4a'); g.strokeStyle = '#4a4a50'; g.lineWidth = 1.5; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(24 + k * 10, -198); g.lineTo(24 + k * 10, -216 - k * 6); g.moveTo(16 + k * 10, -210 - k * 6); g.lineTo(32 + k * 10, -210 - k * 6); g.stroke(); }
    for (let k = 0; k < 3; k++) bush(g, -50 + k * 28, 18, 0.55, '#3a8a3a', R); lamppost(g, 88, 26, 0.8, n);
  },
  lights: [[-30, -110, 40, '#ffc070', 0.25, 0.4], [20, -60, 40, '#ffc070', 0.25, 0.4], [10, -150, 40, '#ffc070', 0.25, 0.4]],
};
BUILD.teashop = {
  bb: [140, 190, 215, 48], hw: 108, up: 185,
  draw(g, R, o) {
    const n = o.night; hullShadow(g, [[-100, 0], [100, 0], [100 + 0.6 * 60, -26], [-100, -26]], 110, 0.3, 7);
    const wd = '#8a5a34'; box3(g, -90, 90, 0, 60, 0, 60, wd, { ff: LG(g, 0, -60, 0, 0, [lite(wd, 0.08), dark(wd, 0.16)]) });
    g.strokeStyle = 'rgba(40,20,5,.3)'; g.lineWidth = 1; for (let y = -58; y < 0; y += 6) { g.beginPath(); g.moveTo(-90, y); g.lineTo(90, y); g.stroke(); }
    for (const x of [-90, -45, 45, 88]) { g.fillStyle = LG(g, x - 5, 0, x + 5, 0, ['#e8442a', '#7a1a14']); g.fillRect(x - 5, -62, 10, 62); }
    // houten raamwerk met lichte binnenkant
    for (const [x0, x1] of [[-80, -52], [52, 80]]) { g.fillStyle = LG(g, 0, -50, 0, -10, n > 0.2 ? ['#ffe9a0', '#ffc060'] : ['#e8d8a8', '#b89860']); g.fillRect(x0, -50, x1 - x0, 40); g.strokeStyle = '#5a3418'; g.lineWidth = 2; for (let k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(x0 + k * (x1 - x0) / 4, -50); g.lineTo(x0 + k * (x1 - x0) / 4, -10); g.stroke(); } for (let k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(x0, -50 + k * 10); g.lineTo(x1, -50 + k * 10); g.stroke(); } }
    g.fillStyle = '#4a2a14'; g.fillRect(-40, -50, 80, 50); g.fillStyle = LG(g, 0, -50, 0, 0, n > 0.2 ? ['#ffd890', '#ff9a40'] : ['#d8c090', '#a08050']); g.fillRect(-36, -46, 72, 46);
    g.fillStyle = '#6a3a1a'; for (let r = 0; r < 3; r++) { g.fillRect(-36, -34 + r * 14, 72, 3); for (let k = 0; k < 8; k++) { g.fillStyle = ['#2a8a4a', '#d84a2a', '#e8c030', '#a060d0'][(k + r) % 4]; g.fillRect(-32 + k * 9, -43 + r * 14, 6, 9); } g.fillStyle = '#6a3a1a'; }
    pagodaRoof(g, 0, -60, 210, 26, '#2a8a5a', { trim: '#e8c050', up: 16 });
    box3(g, -60, 60, 60, 100, 8, 50, wd); for (const x of [-60, -20, 20, 60]) { g.fillStyle = LG(g, x - 4, 0, x + 4, 0, ['#e8442a', '#7a1a14']); g.fillRect(x - 4, -102, 8, 42); }
    for (const x of [-48, -8, 32]) { g.fillStyle = '#4a2a14'; g.fillRect(x, -96, 18, 28); g.fillStyle = n > 0.2 ? '#ffe9a0' : '#e8d8a8'; g.fillRect(x + 2, -94, 14, 24); g.strokeStyle = '#5a3418'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + 9, -94); g.lineTo(x + 9, -70); g.moveTo(x + 2, -82); g.lineTo(x + 16, -82); g.stroke(); }
    pagodaRoof(g, 0, -100, 150, 32, '#2a8a5a', { trim: '#e8c050' });
    // top-ornament
    g.fillStyle = '#e8c050'; g.beginPath(); g.moveTo(-3, -134); g.lineTo(0, -150); g.lineTo(3, -134); g.fill(); g.beginPath(); g.arc(0, -134, 5, 0, TAU); g.fill();
    // verticale bord-banier
    g.fillStyle = '#7a1a10'; g.fillRect(100, -96, 24, 70); g.fillStyle = '#e8c050'; g.fillRect(98, -98, 28, 4); g.font = `700 16px ${FONT}`; g.textAlign = 'center'; g.fillText('THEE', 112, -76); g.font = `700 22px ${FONT}`; g.fillText('茶', 112, -52); g.strokeStyle = '#5a3418'; g.lineWidth = 3; g.beginPath(); g.moveTo(112, -98); g.lineTo(112, -108); g.stroke();
    for (const x of [-70, -22, 22, 70]) lantern(g, x, -58, 1, '#e8342a');
    // theevaten en pot
    for (const x of [-96, 96]) { g.fillStyle = LG(g, x - 9, 0, x + 9, 0, ['#c89a68', '#6a4a2a']); rr(g, x - 9, -20, 18, 20, 4); g.fill(); g.fillStyle = '#4a2a14'; g.fillRect(x - 9, -14, 18, 2); }
    stairs(g, -30, 30, 2, 4, '#8a7a64'); bush(g, -112, 20, 0.8, '#3a8a3a', R);
  },
  anim(g, t) { smokeAt(g, 98, -22, t, { rise: 30, a: 0.4, grow: 6, n: 4, drift: 6 }); for (const x of [-70, -22, 22, 70]) { g.save(); g.globalCompositeOperation = 'lighter'; glowBlob(g, x, -50, 18, '#ff4a2a', 0.45 + Math.sin(t * 3 + x) * 0.1); g.restore(); } },
  lights: [[0, -26, 40, '#ffc060', 0.35, 0.3]],
};
BUILD.electronics = {
  bb: [150, 190, 200, 48], hw: 118, up: 168,
  draw(g, R, o) {
    const n = o.night; hullShadow(g, [[-105, 0], [105, 0], [105 + 0.6 * 60, -26], [-105, -26]], 110, 0.3, 7);
    const c = '#2c303c'; box3(g, -105, 105, 0, 112, 0, 62, c, { ff: LG(g, 0, -112, 0, 0, [lite(c, 0.14), dark(c, 0.14)]) });
    // led-schermen grid
    const cols = [['#ff3a8a', '#3a8aff'], ['#3aeaff', '#8a3aff'], ['#ffe03a', '#ff3a3a'], ['#3aff8a', '#3a6aff']];
    for (let r = 0; r < 2; r++) for (let k = 0; k < 6; k++) { const x = -96 + k * 31, y = -104 + r * 44, cc = cols[(r * 3 + k) % 4]; g.fillStyle = '#0c0e14'; g.fillRect(x - 1, y - 1, 30, 40); g.fillStyle = LG(g, x, y, x + 28, y + 38, cc); g.fillRect(x, y, 28, 38); g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(x, y, 28, 10); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1; for (let q = 0; q < 8; q++) { g.beginPath(); g.moveTo(x, y + q * 5); g.lineTo(x + 28, y + q * 5); g.stroke(); } }
    // etalage + deur
    g.fillStyle = '#0c0e14'; g.fillRect(-100, -22, 140, 20); g.fillStyle = LG(g, 0, -22, 0, -2, ['#bfeaff', '#5a8ab0']); g.fillRect(-98, -20, 136, 16); for (let k = 0; k < 7; k++) { g.fillStyle = '#2a2e3a'; g.fillRect(-92 + k * 19, -15, 12, 9); g.fillStyle = cols[k % 4][0]; g.fillRect(-90 + k * 19, -13, 8, 5); }
    g.fillStyle = '#0c0e14'; g.fillRect(52, -48, 42, 48); g.fillStyle = LG(g, 0, -46, 0, -2, ['#9ad8ff', '#3a6a90']); g.fillRect(54, -46, 38, 44); g.strokeStyle = '#cfd8e0'; g.lineWidth = 2; g.beginPath(); g.moveTo(73, -46); g.lineTo(73, -2); g.stroke();
    sign(g, 'ELECTRO', -66, -140, 132, 28, '#10131c', '#7aeaff', { fs: 22, border: '#3aeaff', glow: '#3aeaff' });
    g.strokeStyle = '#3aeaff'; g.lineWidth = 2; g.shadowColor = '#3aeaff'; g.shadowBlur = 8; g.beginPath(); g.moveTo(-105, -114); g.lineTo(105, -114); g.stroke(); g.shadowBlur = 0;
    // schotel en antennes
    g.save(); g.translate(sx(70, 24), sy(112, 24)); g.fillStyle = '#c8ccd0'; g.beginPath(); g.ellipse(0, -10, 14, 8, -0.5, 0, TAU); g.fill(); g.strokeStyle = '#6a6e74'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -8); g.stroke(); g.restore();
    stairs(g, 48, 98, 1, 4, '#6a6e78'); flowers(g, R, -100, 8, 70, 10, 8, ['#3aeaff', '#ff3a8a']);
  },
  anim(g, t) {
    for (let r = 0; r < 2; r++) for (let k = 0; k < 6; k++) { const x = -96 + k * 31, y = -104 + r * 44, ph = (t * 0.9 + k * 0.4 + r) % 2; g.fillStyle = `rgba(255,255,255,${0.12 + Math.sin(t * 2 + k + r) * 0.08})`; g.fillRect(x, y + (ph < 1 ? ph * 34 : 0), 28, 3); }
    g.save(); g.globalCompositeOperation = 'lighter'; glowBlob(g, 0, -126, 80, '#3aeaff', 0.2 + (Math.sin(t * 40) > 0.97 ? -0.1 : 0.05)); glowBlob(g, 0, -70, 110, '#a03aff', 0.16 + Math.sin(t) * 0.04); g.restore();
  },
  lights: [[-30, -60, 100, '#a05aff', 0.22, 0.4]],
};
BUILD.warehouse = {
  bb: [180, 230, 210, 50], hw: 160, up: 160,
  draw(g, R, o) {
    const n = o.night; hullShadow(g, [[-150, 0], [150, 0], [150 + 0.6 * 100, -42], [-150, -42]], 100, 0.34, 8);
    const c = '#6a7a94'; box3(g, -150, 150, 0, 100, 0, 100, c, { ff: LG(g, 0, -100, 0, 0, [lite(c, 0.12), dark(c, 0.14)]) });
    g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 1.2; for (let x = -150; x < 150; x += 7) { g.beginPath(); g.moveTo(x, -100); g.lineTo(x, 0); g.stroke(); } g.strokeStyle = 'rgba(255,255,255,.1)'; for (let x = -147; x < 150; x += 7) { g.beginPath(); g.moveTo(x, -100); g.lineTo(x, 0); g.stroke(); }
    g.fillStyle = '#e8a020'; g.fillRect(-150, -100, 300, 7); g.fillStyle = '#4a5468'; g.fillRect(-150, -8, 300, 8);
    // laaddokken
    for (let k = 0; k < 5; k++) { const x = -132 + k * 54; g.fillStyle = '#1a1e28'; g.fillRect(x, -62, 44, 60); g.fillStyle = LG(g, 0, -62, 0, -2, ['#c8ccd2', '#8a909a']); g.fillRect(x + 1, -62, 42, 24); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1; for (let q = 0; q < 6; q++) { g.beginPath(); g.moveTo(x + 1, -62 + q * 4); g.lineTo(x + 43, -62 + q * 4); g.stroke(); } g.fillStyle = '#e8a020'; g.fillRect(x + 4, -10, 36, 3); g.fillStyle = '#f0c030'; g.fillRect(x + 16, -70, 12, 5); g.fillStyle = '#1a1e28'; g.font = `700 8px ${FONT}`; g.textAlign = 'center'; g.fillText(String(k + 1), x + 22, -66); }
    // vrachtwagens aan dok 2 en 4 (achterkant), dozen
    for (const k of [1, 3]) { const x = -132 + k * 54; g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x - 2, 4, 52, 8); g.fillStyle = k === 1 ? '#f0f0ea' : '#e8e0c8'; g.fillRect(x + 2, -58, 40, 58); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x + 34, -58, 8, 58); g.fillStyle = '#d02a20'; g.fillRect(x + 4, -8, 6, 4); g.fillRect(x + 34, -8, 6, 4); g.fillStyle = '#15171b'; g.fillRect(x + 2, 0, 8, 7); g.fillRect(x + 34, 0, 8, 7); g.fillStyle = '#e8a020'; g.fillRect(x + 8, -42, 28, 12); g.fillStyle = '#2a2a30'; g.font = `700 9px ${FONT}`; g.fillText('BUDDLEY', x + 22, -33); }
    for (const [x, y] of [[-140, 4], [-150, 2], [-134, 8]]) crate(g, x, y, 0.9, '#c8a060'); for (const [x, y] of [[148, 6], [160, 6], [154, 2]]) crate(g, x, y, 1, '#d8b070');
    // BUDDLEY-bord
    sign(g, 'BUDDLEY', -88, -158, 176, 50, '#13203a', '#ff9a2a', { fs: 40, border: '#ff9a2a', glow: '#ff9a2a' });
    g.fillStyle = '#4a5468'; g.fillRect(-84, -108, 6, 10); g.fillRect(78, -108, 6, 10);
    // dakventilatoren
    for (const x of [-120, -80, 90, 120]) { box3(g, x - 12, x + 12, 100, 112, 30, 56, '#aab0b8'); cyl(g, sx(x, 44), sy(112, 44), sy(124, 44), 9, '#8a909a'); }
    // lampen
    for (const x of [-140, 140]) { g.fillStyle = '#2a2e38'; g.fillRect(x - 1.5, -140, 3, 40); g.fillStyle = '#fff6c0'; g.fillRect(x - 6, -143, 12, 5); }
  },
  anim(g, t) { g.save(); g.globalCompositeOperation = 'lighter'; glowBlob(g, 0, -132, 100, '#ff9a2a', 0.2 + Math.sin(t * 2) * 0.03); for (const x of [-140, 140]) { g.globalAlpha = 0.5; g.drawImage(glowSprite('#fff2b0'), x - 28, -168, 56, 56); } g.restore(); },
  lights: [[-140, -140, 50, '#fff2b0', 0.5, 0.1], [140, -140, 50, '#fff2b0', 0.5, 0.1]],
};

// ---------------------------------------------------------------- Hoofdkantoor-stad
BUILD.hq = {
  bb: [140, 190, 330, 50], hw: 88, up: 300,
  draw(g, R, o) {
    const n = o.night; hullShadow(g, [[-80, 0], [80, 0], [80 + 0.6 * 90, -40], [-80, -40]], 280, 0.36, 10);
    // voet / lobby
    box3(g, -100, 100, 0, 34, 0, 84, '#3a4258'); g.fillStyle = LG(g, 0, -30, 0, -2, ['#bfe8ff', '#4a7aa0']); g.fillRect(-92, -30, 184, 28); g.strokeStyle = '#1a2030'; g.lineWidth = 2; for (let x = -92; x <= 92; x += 23) { g.beginPath(); g.moveTo(x, -30); g.lineTo(x, -2); g.stroke(); } g.fillStyle = `rgba(255,236,170,${0.25 + n * 0.45})`; g.fillRect(-92, -30, 184, 28);
    // toren
    const gl = '#3a78b0'; box3(g, -62, 62, 34, 270, 4, 70, gl, { ff: LG(g, -62, 0, 62, 0, [lite(gl, 0.25), gl, dark(gl, 0.3)]), s: '#1e3c60', t: '#8ac8f0', ao: false });
    // rasters van het glas, verlichte verdiepingen
    g.save(); g.beginPath(); g.rect(-62, -270, 124, 236); g.clip();
    for (let r = 0; r < 20; r++) for (let k = 0; k < 8; k++) { const lit = ((r * 31 + k * 17) % 11) / 11 < 0.12 + n * 0.5; g.fillStyle = lit ? `rgba(255,232,150,${0.55 + R() * 0.3})` : `rgba(10,30,60,${0.12 + R() * 0.12})`; g.fillRect(-60 + k * 15.5 + 1, -268 + r * 11.7 + 1, 13, 9.5); }
    g.strokeStyle = 'rgba(210,235,255,.5)'; g.lineWidth = 1; for (let k = 0; k <= 8; k++) { g.beginPath(); g.moveTo(-62 + k * 15.5, -270); g.lineTo(-62 + k * 15.5, -34); g.stroke(); } for (let r = 0; r <= 20; r++) { g.beginPath(); g.moveTo(-62, -270 + r * 11.8); g.lineTo(62, -270 + r * 11.8); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,.14)'; g.beginPath(); g.moveTo(-62, -110); g.lineTo(-62, -200); g.lineTo(20, -270); g.lineTo(60, -270); g.closePath(); g.fill(); g.restore();
    // rechterzijde: donker glas
    g.save(); g.beginPath(); path3(g, [[62, 34, 4], [62, 34, 70], [62, 270, 70], [62, 270, 4]]); g.clip(); for (let r = 0; r < 20; r++) { for (let k = 0; k < 4; k++) { const lit = ((r * 13 + k * 7) % 9) / 9 < 0.1 + n * 0.4; poly3(g, [[62, 40 + r * 11.7, 8 + k * 16], [62, 40 + r * 11.7, 22 + k * 16], [62, 49 + r * 11.7, 22 + k * 16], [62, 49 + r * 11.7, 8 + k * 16]], lit ? 'rgba(255,225,140,.7)' : 'rgba(8,20,40,.35)'); } } g.restore();
    // kroon en antenne
    box3(g, -46, 46, 270, 282, 12, 60, '#2a3a58', { ao: false }); box3(g, -22, 22, 282, 296, 24, 48, '#3a4a68', { ao: false }); g.strokeStyle = '#c8ccd0'; g.lineWidth = 3; g.beginPath(); g.moveTo(sx(0, 36), sy(296, 36)); g.lineTo(sx(0, 36), sy(332, 36)); g.stroke();
    // bord en luifel
    g.fillStyle = '#10131c'; g.fillRect(-60, -64, 120, 20); g.fillStyle = '#ff9a2a'; g.fillRect(-60, -44, 120, 2); sign(g, 'HOOFDKANTOOR', -56, -62, 112, 15, '#10131c', '#ffe08a', { fs: 11, border: '#ff9a2a' });
    g.fillStyle = 'rgba(30,40,60,.9)'; g.fillRect(-30, -40, 60, 8); g.fillStyle = '#1a2030'; g.fillRect(-14, -26, 28, 24); g.fillStyle = 'rgba(200,230,255,.5)'; g.fillRect(-12, -24, 11, 22); g.fillRect(1, -24, 11, 22);
    stairs(g, -30, 30, 2, 4, '#5a6070'); for (const sgn of [-1, 1]) { lamppost(g, sgn * 96, 30, 0.9, 1); bush(g, sgn * 120, 18, 0.9, '#2a5a3a', R); }
  },
  anim(g, t) { const on = Math.sin(t * 3) > 0; g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = on ? '#ff3030' : '#601818'; g.beginPath(); g.arc(sx(0, 36), sy(334, 36), 3, 0, TAU); g.fill(); if (on) glowBlob(g, sx(0, 36), sy(334, 36), 26, '#ff3030', 0.7); g.restore(); },
  lights: [[0, -16, 70, '#ffe6a0', 0.4, 0.2]],
};
BUILD.house = {
  bb: [150, 200, 190, 50], hw: 120, up: 150,
  draw(g, R, o) {
    const n = o.night, wc = '#f0ece0'; hullShadow(g, [[-110, 0], [110, 0], [110 + 0.6 * 60, -30], [-110, -30]], 110, 0.3, 7);
    // garage rechts
    box3(g, 34, 112, 0, 62, 0, 58, wc); roofX(g, 34, 112, 62, 0, 58, 26, '#4a5e78', { wall: wc });
    g.fillStyle = LG(g, 0, -56, 0, -2, ['#dcdcd8', '#b0b0ac']); g.fillRect(44, -54, 58, 52); g.strokeStyle = 'rgba(0,0,0,.22)'; for (let k = 1; k < 5; k++) { g.beginPath(); g.moveTo(44, -54 + k * 10.4); g.lineTo(102, -54 + k * 10.4); g.stroke(); }
    // woonhuis
    box3(g, -100, 34, 0, 100, 0, 62, wc, { ff: LG(g, 0, -100, 0, 0, [lite(wc, 0.1), dark(wc, 0.1)]) }); g.strokeStyle = 'rgba(0,0,0,.08)'; g.lineWidth = 1; for (let y = -98; y < 0; y += 6) { g.beginPath(); g.moveTo(-100, y); g.lineTo(34, y); g.stroke(); }
    roofX(g, -100, 34, 100, 0, 62, 44, '#4a5e78', { wall: wc, ov: 8 });
    win(g, -88, -84, 22, 28, { lit: n * 0.8, shut: '#3a6a8a' }); win(g, -24, -84, 22, 28, { lit: n * 0.8, shut: '#3a6a8a' }); win(g, -88, -36, 22, 28, { lit: n * 0.8, shut: '#3a6a8a' });
    door(g, -22, -46, 22, 44, '#a83a2a'); win(g, 6, -34, 18, 26, { lit: n * 0.8 }); stairs(g, -26, 4, 2, 4, '#b0b0aa'); box3(g, -34, 10, 46, 50, -10, 20, '#e8e2d0', { ao: false });
    box3(g, -40, -28, 100, 124, 20, 32, '#a85a42'); g.fillStyle = '#a0a0a0'; g.fillRect(-114, 22, 230, 4);
    // oprit, heg, brievenbus, boom, auto
    g.fillStyle = '#6a6a70'; g.beginPath(); g.moveTo(44, 0); g.lineTo(102, 0); g.lineTo(118, 36); g.lineTo(34, 36); g.fill(); drawCar(g, 74, 22, 1, '#c8302a', 'car', 0);
    g.fillStyle = '#2f6a34'; for (let x = -108; x < -40; x += 10) { g.beginPath(); g.arc(x, 30, 7, 0, TAU); g.fill(); } g.fillStyle = '#3a8a3a'; for (let x = -104; x < -40; x += 10) { g.beginPath(); g.arc(x, 28, 5, 0, TAU); g.fill(); }
    g.fillStyle = '#3a3a40'; g.fillRect(-12, 20, 3, 18); g.fillStyle = '#2a6ac0'; rr(g, -18, 14, 16, 9, 3); g.fill(); flowers(g, R, -90, 14, 60, 10, 12, ['#ff6a8a', '#fff', '#ffe060']);
  },
  anim(g, t) { smokeAt(g, -34, -128, t, { rise: 40, a: 0.35 }); },
  lights: [[-77, -70, 26, '#ffc870', 0.4, 0.3], [-13, -70, 26, '#ffc870', 0.4, 0.3], [-77, -22, 26, '#ffc870', 0.4, 0.3], [15, -21, 24, '#ffc870', 0.4, 0.3]],
};
BUILD.police = {
  bb: [150, 200, 195, 50], hw: 120, up: 160,
  draw(g, R, o) {
    const n = o.night, c = '#c8d4e4'; hullShadow(g, [[-110, 0], [110, 0], [110 + 0.6 * 70, -34], [-110, -34]], 110, 0.34, 8);
    box3(g, -110, 110, 0, 94, 0, 70, c, { ff: LG(g, 0, -94, 0, 0, [lite(c, 0.1), dark(c, 0.14)]) });
    g.fillStyle = '#1f3f8a'; g.fillRect(-110, -94, 220, 12); g.fillRect(-110, -34, 220, 6); g.fillStyle = '#fff'; g.fillRect(-110, -82, 220, 3);
    for (const x of [-96, -66, 36, 66, 90]) { win(g, x, -76, 16, 26, { lit: n * 0.7 + 0.1, frame: '#e8eef8', shut: undefined }); g.strokeStyle = '#2a2a30'; g.lineWidth = 1.2; for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(x + k * 4, -76); g.lineTo(x + k * 4, -50); g.stroke(); } }
    // ingang met zuilen en blauwe lampen
    g.fillStyle = '#e8eef8'; g.fillRect(-30, -52, 60, 52); g.fillStyle = '#1f3f8a'; g.fillRect(-30, -56, 60, 8); door(g, -12, -42, 24, 40, '#1f3f8a', { glass: 'rgba(170,210,255,.7)', frame: '#fff' });
    g.fillStyle = '#4a5468'; g.fillRect(-40, -112, 4, 20); g.fillRect(36, -112, 4, 20); sign(g, 'POLITIE', -48, -134, 96, 24, '#1f3f8a', '#fff', { fs: 20, border: '#fff' });
    stairs(g, -34, 34, 3, 4, '#a8acb8'); for (const x of [-38, 38]) { g.fillStyle = '#2a58c0'; g.fillRect(x - 3, -46, 6, 14); }
    // dak met zwaailicht
    box3(g, -14, 14, 94, 104, 26, 44, '#6a7488');
    // politieauto
    const pc = carSprite('#f4f6fa'); g.save(); g.translate(150, 30); g.drawImage(pc, -60, -46); g.fillStyle = '#1f3f8a'; g.fillRect(-26, -26, 52, 6); g.restore();
    // vlaggenmast
    lamppost(g, -120, 30, 0.85, 1);
  },
  anim(g, t) {
    const a = Math.sin(t * 9) > 0; g.fillStyle = a ? '#ff2a2a' : '#2a50ff'; g.beginPath(); g.arc(-6, -106, 4, 0, TAU); g.fill(); g.fillStyle = a ? '#2a50ff' : '#ff2a2a'; g.beginPath(); g.arc(6, -106, 4, 0, TAU); g.fill();
    g.save(); g.globalCompositeOperation = 'lighter'; glowBlob(g, a ? -6 : 6, -106, 34, a ? '#ff2a2a' : '#2a50ff', 0.65); g.restore();
    g.save(); g.translate(150, 30); g.globalCompositeOperation = 'lighter'; g.fillStyle = a ? '#ff2a2a' : '#2a50ff'; g.fillRect(-8, -36, 7, 3); g.fillStyle = a ? '#2a50ff' : '#ff2a2a'; g.fillRect(1, -36, 7, 3); glowBlob(g, 0, -36, 26, a ? '#ff2a2a' : '#2a50ff', 0.5); g.restore();
  },
  lights: [[-38, -40, 30, '#4a7aff', 0.4, 0.3], [38, -40, 30, '#4a7aff', 0.4, 0.3]],
};
BUILD.atelier = {
  bb: [140, 190, 210, 50], hw: 98, up: 170,
  draw(g, R, o) {
    const n = o.night, c = '#b4a860'; hullShadow(g, [[-90, 0], [90, 0], [90 + 0.6 * 60, -26], [-90, -26]], 130, 0.3, 7);
    g.save(); g.rotate(-0.012);
    box3(g, -90, 90, 0, 120, 0, 60, c, { ff: LG(g, 0, -120, 0, 0, [lite(c, 0.04), dark(c, 0.22)]) });
    // afbladderende pleister: vlekken en ontbrekende stukken
    g.save(); g.beginPath(); g.rect(-90, -120, 180, 120); g.clip(); for (let i = 0; i < 18; i++) { const x = -90 + R() * 180, y = -118 + R() * 110, r = 6 + R() * 16; g.fillStyle = R() < 0.5 ? 'rgba(120,100,60,.45)' : 'rgba(150,70,50,.45)'; g.beginPath(); g.moveTo(x, y); for (let k = 1; k < 7; k++) g.lineTo(x + Math.cos(k) * r * (0.6 + R() * 0.6), y + Math.sin(k) * r * (0.6 + R() * 0.6)); g.fill(); } g.fillStyle = 'rgba(60,40,20,.3)'; for (let x = -90; x < 90; x += 14) g.fillRect(x + R() * 8, -120, 3, 30 + R() * 60); g.restore();
    // ongelijke ramen
    win(g, -76, -108, 26, 20, { lit: n * 0.3, frame: '#7a6a40' }); win(g, -30, -104, 14, 28, { lit: n * 0.4, frame: '#8a5a40' }); win(g, 20, -110, 30, 18, { lit: n * 0.3, frame: '#7a6a40' }); win(g, 64, -100, 16, 22, { lit: n * 0.3, frame: '#6a4a30' });
    // etalage met paspoppen
    g.fillStyle = '#3a3220'; g.fillRect(-84, -64, 100, 62); g.fillStyle = LG(g, 0, -60, 0, -4, ['#c8c0a0', '#8a8468']); g.fillRect(-80, -60, 92, 56);
    const man = (x, col, hh) => { g.fillStyle = '#d8c8b8'; g.beginPath(); g.arc(x, -48 - hh, 4.4, 0, TAU); g.fill(); g.fillStyle = col; g.beginPath(); g.moveTo(x - 9, -42 - hh); g.lineTo(x + 9, -42 - hh); g.lineTo(x + 12, -8); g.lineTo(x - 12, -8); g.closePath(); g.fill(); g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1; g.stroke(); g.fillStyle = '#6a5a4a'; g.fillRect(x - 1, -10, 2, 8); };
    man(-62, '#8a3a7a', 0); man(-34, '#3a8a6a', 4); man(-6, '#c8702a', -2);
    // scheur in de ruit
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-70, -58); g.lineTo(-52, -36); g.lineTo(-60, -22); g.lineTo(-44, -6); g.stroke();
    door(g, 30, -52, 26, 50, '#5a4430', { frame: '#8a7a50' });
    // gescheurde luifel
    awning(g, -86, -70, 104, 12, '#4a9a5a', '#d86a9a', 8); g.fillStyle = c; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(-70 + k * 26, -58); g.lineTo(-64 + k * 26, -50); g.lineTo(-58 + k * 26, -58); g.fill(); }
    // scheef bord met garenklos
    g.save(); g.translate(40, -138); g.rotate(0.12); sign(g, 'ATELIER', -42, -12, 84, 24, '#6a5a3a', '#e8d8a0', { fs: 16, border: '#3a2a10' }); g.fillStyle = '#c8302a'; g.beginPath(); g.arc(-50, 0, 7, 0, TAU); g.fill(); g.restore();
    g.restore();
    // dak: kromme schoorsteen + platte rand
    box3(g, -90, 90, 120, 128, -2, 62, '#6a6454', { ao: false }); g.save(); g.translate(60, -150); g.rotate(0.15); box3(g, -9, 9, 0, 28, 0, 12, '#8a5a42'); g.restore();
    // vuilnis, kapotte fiets
    g.fillStyle = '#4a4a50'; rr(g, 96, -18, 20, 22, 3); g.fill(); g.fillStyle = '#6a6a70'; g.fillRect(94, -22, 24, 5); crate(g, -100, 8, 0.8, '#8a6a40'); g.strokeStyle = '#7a7a7a'; g.lineWidth = 1.5; g.beginPath(); g.arc(120, 12, 8, 0, TAU); g.stroke();
  },
  anim(g, t) { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.sin(t * 30) > 0.9 ? 0.2 : 0.7; glowBlob(g, -34, -100, 20, '#ffe080', 0.4); g.restore(); },
  lights: [[-34, -42, 34, '#d8c070', 0.2, 0.9]],
};
BUILD.bankchina = {
  bb: [170, 210, 255, 50], hw: 138, up: 215,
  draw(g, R, o) {
    const n = o.night; hullShadow(g, [[-130, 0], [130, 0], [130 + 0.6 * 80, -36], [-130, -36]], 130, 0.34, 9);
    // plint met trappen
    box3(g, -140, 140, 0, 14, -6, 84, '#d8c8a8'); box3(g, -128, 128, 14, 26, 0, 74, '#e0d0b0');
    // hoofdgebouw
    const rd = '#a82424'; box3(g, -118, 118, 26, 112, 8, 74, rd, { ff: LG(g, 0, -112, 0, -26, [lite(rd, 0.1), dark(rd, 0.2)]) });
    g.fillStyle = '#e8c050'; g.fillRect(-118, -113, 236, 5); g.fillRect(-118, -30, 236, 4);
    for (const x of [-100, -80, 62, 82]) win(g, x - 6, -102, 12, 30, { lit: n * 0.6, frame: '#e8c050' });
    // zuilen
    for (const x of [-96, -58, -20, 20, 58, 96]) { g.fillStyle = LG(g, x - 8, 0, x + 8, 0, ['#f06a3a', '#d02a20', '#8a1a14', '#5a0e0a']); g.fillRect(x - 8, -112, 16, 86); g.fillStyle = '#e8c050'; g.fillRect(x - 11, -116, 22, 6); g.fillRect(x - 11, -32, 22, 6); g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(x - 5, -108, 2, 78); }
    // deur
    g.fillStyle = '#e8c050'; g.beginPath(); g.moveTo(-26, -26); g.lineTo(-26, -72); g.arc(0, -72, 26, Math.PI, 0); g.lineTo(26, -26); g.fill(); g.fillStyle = '#3a0a08'; g.beginPath(); g.moveTo(-21, -26); g.lineTo(-21, -72); g.arc(0, -72, 21, Math.PI, 0); g.lineTo(21, -26); g.fill(); g.fillStyle = '#c02a20'; g.fillRect(-19, -72, 18, 46); g.fillRect(1, -72, 18, 46); g.fillStyle = '#e8c050'; g.beginPath(); g.arc(0, -52, 10, 0, TAU); g.fill(); g.fillStyle = '#8a1a14'; g.font = `700 13px ${FONT}`; g.textAlign = 'center'; g.fillText('¥', 0, -47);
    // trappen
    stairs(g, -50, 50, 3, 4, '#d8c8a8');
    // gouden dak
    pagodaRoof(g, 0, -112, 260, 54, '#d8a82a', { trim: '#fff0a0', up: 22 }); box3(g, -50, 50, 112, 134, 18, 60, '#a82424', { ao: false }); pagodaRoof(g, 0, -134, 130, 36, '#d8a82a', { trim: '#fff0a0', up: 16 });
    sign(g, 'BANK VAN CHINA', -64, -116 - 2, 128, 20, '#6a0e0e', '#ffe9a0', { fs: 14, border: '#e8c050' });
    g.fillStyle = '#e8c050'; g.beginPath(); g.arc(0, -178, 6, 0, TAU); g.fill(); g.fillRect(-1.6, -196, 3.2, 14);
    for (const sgn of [-1, 1]) { g.save(); g.translate(sgn * 78, 2); g.fillStyle = LG(g, -10, 0, 10, 0, ['#e8c860', '#8a6a20']); rr(g, -10, -26, 20, 26, 5); g.fill(); g.beginPath(); g.arc(0, -34, 9, 0, TAU); g.fill(); g.restore(); lantern(g, sgn * 108, -92, 1.1, '#e8342a'); }
  },
  anim(g, t) { for (const sgn of [-1, 1]) { g.save(); g.globalCompositeOperation = 'lighter'; glowBlob(g, sgn * 108, -84, 22, '#ff4a2a', 0.5 + Math.sin(t * 3 + sgn) * 0.1); g.restore(); } g.save(); g.globalCompositeOperation = 'lighter'; glowBlob(g, 0, -60, 90, '#ffc040', 0.14 + Math.sin(t * 1.6) * 0.04); g.restore(); },
  lights: [[0, -50, 70, '#ffc050', 0.35, 0.3]],
};

// ---------------------------------------------------------------- Eiland
BUILD.wreck = {
  bb: [190, 200, 160, 46], hw: 150, up: 118,
  draw(g, R, o) {
    const n = o.night;
    softShadow(g, 10, 14, 180, 22, 0.4);
    g.save(); g.rotate(-0.035);
    // staart (losgebroken, schuin omhoog)
    g.save(); g.translate(-122, -20); g.rotate(-0.26); g.fillStyle = LG(g, 0, -34, 0, 20, ['#f4f6f8', '#aab2bc', '#707a88']); g.beginPath(); g.moveTo(40, -26); g.quadraticCurveTo(-30, -26, -76, -10); g.lineTo(-76, 6); g.quadraticCurveTo(-30, 20, 40, 24); g.closePath(); g.fill(); g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1.6; g.stroke();
    g.fillStyle = '#e8702a'; g.beginPath(); g.moveTo(-72, -8); g.lineTo(-84, -64); g.lineTo(-46, -62); g.lineTo(-30, -18); g.closePath(); g.fill(); g.strokeStyle = 'rgba(0,0,0,.45)'; g.stroke(); g.fillStyle = '#f4f4f4'; g.beginPath(); g.moveTo(-70, -26); g.lineTo(-77, -50); g.lineTo(-58, -49); g.lineTo(-52, -26); g.fill();
    g.fillStyle = '#2a1a14'; g.beginPath(); g.moveTo(40, -26); for (let k = 0; k < 6; k++) g.lineTo(40 + (k % 2 ? 6 : -2), -26 + k * 10); g.lineTo(40, 24); g.fill(); g.restore();
    // romp
    g.fillStyle = LG(g, 0, -44, 0, 26, ['#fafcfe', '#c4ccd6', '#7a8494']); g.beginPath(); g.moveTo(-70, -28); g.quadraticCurveTo(-10, -48, 80, -36); g.quadraticCurveTo(128, -22, 134, 2); g.quadraticCurveTo(110, 24, 70, 26); g.lineTo(-70, 20); g.closePath(); g.fill(); g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 1.8; g.stroke();
    g.fillStyle = '#e8702a'; g.beginPath(); g.moveTo(-70, -8); g.lineTo(120, -6); g.lineTo(124, 4); g.lineTo(-70, 4); g.fill();
    g.fillStyle = LG(g, 0, -34, 0, -20, n > 0.2 ? ['#ffe9a0', '#ff9a40'] : ['#bfe0f8', '#4c78a0']); for (let k = 0; k < 9; k++) { rr(g, -54 + k * 17, -30, 9, 10, 3); g.fill(); } g.fillStyle = '#1a1a1e'; rr(g, -34, -30, 9, 10, 3); g.fill();
    g.fillStyle = 'rgba(40,20,10,.5)'; g.beginPath(); g.ellipse(20, -26, 22, 8, 0.2, 0, TAU); g.fill(); g.beginPath(); g.ellipse(86, -16, 14, 6, 0, 0, TAU); g.fill(); // roet
    // cockpit
    g.fillStyle = '#2a3a4a'; g.beginPath(); g.moveTo(94, -30); g.quadraticCurveTo(118, -24, 128, -8); g.lineTo(100, -8); g.closePath(); g.fill(); g.fillStyle = 'rgba(180,220,255,.5)'; g.beginPath(); g.moveTo(98, -28); g.lineTo(112, -24); g.lineTo(100, -12); g.fill();
    // afgebroken vleugel met motor
    g.fillStyle = LG(g, 0, -6, 0, 36, ['#d8dde4', '#7a8494']); g.beginPath(); g.moveTo(20, 4); g.lineTo(70, 4); g.lineTo(100, 36); g.lineTo(40, 40); g.closePath(); g.fill(); g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1.4; g.stroke(); cyl(g, 62, 36, 18, 11, '#9aa2ae', { top: true, topCol: '#2a2a30' });
    g.restore();
    // koffers en zakken
    for (const [x, y, c] of [[-60, 34, '#3a6a9a'], [-40, 38, '#9a3a3a'], [118, 34, '#3a8a5a']]) { g.save(); g.translate(x, y); g.fillStyle = c; rr(g, -9, -12, 18, 12, 2); g.fill(); g.strokeStyle = dark(c, 0.4); g.lineWidth = 1; g.stroke(); g.fillStyle = '#e8c050'; g.fillRect(-2, -8, 4, 2); g.restore(); }
    drawMoneyBagMini(g, 150, 30);
  },
  anim(g, t) { smokeAt(g, 30, -52, t, { rise: 64, a: 0.5, col: '#555', n: 7, grow: 12 }); smokeAt(g, 62, 8, t, { rise: 50, a: 0.4, col: '#666', seed: 0.4 }); g.save(); g.globalCompositeOperation = 'lighter'; glowBlob(g, 62, 14, 24, '#ff7a2a', 0.35 + Math.sin(t * 9) * 0.1); g.restore(); },
};
function drawMoneyBagMini(g, x, y) { g.save(); g.translate(x, y); g.fillStyle = '#b8955a'; g.beginPath(); g.moveTo(-9, 0); g.quadraticCurveTo(-13, -14, -4, -18); g.lineTo(4, -18); g.quadraticCurveTo(13, -14, 9, 0); g.closePath(); g.fill(); g.strokeStyle = '#4a3410'; g.lineWidth = 1.2; g.stroke(); g.fillStyle = '#4a3410'; g.font = `700 11px ${FONT}`; g.textAlign = 'center'; g.fillText('$', 0, -5); g.restore(); }
BUILD.resort = {
  bb: [160, 200, 205, 60], hw: 118, up: 175,
  draw(g, R, o) {
    const n = o.night, wc = '#f8f4ea'; hullShadow(g, [[-100, 0], [100, 0], [100 + 0.6 * 70, -30], [-100, -30]], 130, 0.3, 8);
    box3(g, -100, 100, 0, 128, 0, 70, wc, { ff: LG(g, 0, -128, 0, 0, [lite(wc, 0.1), dark(wc, 0.1)]) });
    for (let r = 0; r < 3; r++) { const y = -30 - r * 34; g.fillStyle = '#2a9ac0'; g.fillRect(-100, y - 2, 200, 4); for (let k = 0; k < 5; k++) { const x = -86 + k * 38; win(g, x, y - 26, 20, 22, { lit: ((r + k * 3) % 4) / 4 < 0.3 + n * 0.5 ? 1 : 0, frame: '#fff', thin: true }); g.fillStyle = 'rgba(40,150,190,.35)'; g.fillRect(x - 6, y - 4, 32, 4); g.strokeStyle = '#2a9ac0'; g.lineWidth = 1.2; g.beginPath(); for (let q = 0; q <= 8; q++) { g.moveTo(x - 6 + q * 4, y - 4); g.lineTo(x - 6 + q * 4, y - 14); } g.stroke(); } }
    // dakterras
    g.fillStyle = '#2a9ac0'; g.fillRect(-100, -130, 200, 4); box3(g, -100, 100, 128, 134, 0, 70, '#e8e2d0', { ao: false }); for (const x of [-60, 20, 70]) { g.fillStyle = '#d8c8a0'; g.fillRect(sx(x, 30) - 12, sy(134, 30) - 2, 24, 3); }
    // ingang + bord
    g.fillStyle = '#2a9ac0'; g.fillRect(-26, -50, 52, 4); g.fillStyle = LG(g, 0, -46, 0, 0, ['#cfeaf8', '#7ab0d0']); g.fillRect(-22, -46, 44, 46); g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -46); g.lineTo(0, 0); g.stroke();
    sign(g, 'RESORT', -44, -166, 88, 28, '#0f6a8a', '#fff6c0', { fs: 22, border: '#fff' }); g.fillStyle = '#f0c030'; g.beginPath(); g.arc(-52, -152, 11, 0, TAU); g.fill();
    // palmbladdak bar + parasols
    g.fillStyle = '#6a4a2a'; g.fillRect(114, -34, 4, 34); g.fillRect(150, -34, 4, 34); g.fillStyle = '#c8a050'; g.beginPath(); g.moveTo(104, -34); g.lineTo(134, -64); g.lineTo(164, -34); g.closePath(); g.fill(); g.strokeStyle = '#7a5a2a'; g.lineWidth = 1; for (let k = 0; k < 9; k++) { g.beginPath(); g.moveTo(134, -64); g.lineTo(104 + k * 7.5, -34); g.stroke(); }
    g.fillStyle = '#e8d8b0'; g.fillRect(112, -16, 44, 5);
    for (const [x, c] of [[-120, '#e84a2a'], [-136, '#3a8ad0']]) { g.fillStyle = '#6a5a4a'; g.fillRect(x - 1, -34, 2, 40); g.fillStyle = c; g.beginPath(); g.moveTo(x - 20, -30); g.quadraticCurveTo(x, -50, x + 20, -30); g.closePath(); g.fill(); g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, -42); g.lineTo(x, -30); g.stroke(); }
    // zwembad
    g.fillStyle = '#d8d0b8'; rr(g, -92, 14, 150, 40, 12); g.fill(); g.fillStyle = LG(g, -88, 18, 52, 50, ['#7ae0f0', '#2a9ac8']); rr(g, -86, 19, 138, 30, 9); g.fill(); g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1.2; for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(-76 + k * 22, 30 + (k % 2) * 6); g.quadraticCurveTo(-68 + k * 22, 26, -60 + k * 22, 30 + (k % 2) * 6); g.stroke(); }
    for (const [x, y] of [[84, 22], [96, 30]]) { g.fillStyle = '#e8c860'; rr(g, x, y, 22, 8, 3); g.fill(); g.fillStyle = '#fff'; g.fillRect(x + 2, y - 2, 10, 3); }
  },
  anim(g, t) { g.save(); for (let k = 0; k < 7; k++) { const x = -70 + ((t * 20 + k * 22) % 120), y = 24 + Math.sin(t * 3 + k) * 6 + (k % 2) * 8; const a = Math.max(0, Math.sin(t * 3 + k * 2)); g.fillStyle = `rgba(255,255,255,${a * 0.8})`; star5(g, -86 + ((x + 86) % 138), y, 2 + a * 2); g.fill(); } g.restore(); },
  lights: [[0, -26, 50, '#ffe0a0', 0.3, 0.2], [-40, -90, 40, '#ffd090', 0.25, 0.4], [40, -90, 40, '#ffd090', 0.25, 0.4]],
};
BUILD.ship = {
  bb: [190, 210, 290, 60], hw: 150, up: 250,
  draw(g, R, o) {
    const n = o.night;
    // steiger
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(-170, 18, 340, 10);
    for (let x = -170; x < 170; x += 14) { g.fillStyle = (x / 14) % 2 ? '#8a6a44' : '#9a7a50'; g.fillRect(x, 8, 12.6, 18); } g.fillStyle = '#4a321a'; g.fillRect(-170, 24, 340, 4); for (let x = -166; x < 170; x += 50) { g.fillRect(x, 24, 5, 30); }
    // romp
    g.save(); g.translate(0, 4);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(10, 14, 140, 10, 0, 0, TAU); g.fill();
    g.fillStyle = LG(g, 0, -60, 0, 14, ['#7a4a26', '#4a2a14', '#2a180c']); g.beginPath(); g.moveTo(-140, -56); g.quadraticCurveTo(-130, -4, -90, 10); g.lineTo(100, 10); g.quadraticCurveTo(146, -10, 156, -62); g.lineTo(120, -50); g.lineTo(-100, -48); g.closePath(); g.fill(); g.strokeStyle = '#1a0e06'; g.lineWidth = 2; g.stroke();
    g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1.2; for (let k = 1; k < 5; k++) { g.beginPath(); g.moveTo(-136 + k * 6, -56 + k * 12); g.quadraticCurveTo(0, -48 + k * 11, 150 - k * 6, -60 + k * 12); g.stroke(); }
    g.fillStyle = '#e8c050'; g.fillRect(-120, -52, 252, 4); g.fillStyle = '#c89a30'; g.fillRect(-120, -26, 240, 3);
    for (let k = 0; k < 6; k++) { const x = -90 + k * 36; g.fillStyle = '#1a0e06'; rr(g, x - 7, -42, 14, 12, 2); g.fill(); g.fillStyle = '#2a2a30'; g.fillRect(x - 10, -38, 12, 5); g.fillStyle = '#d02a20'; g.fillRect(x - 7, -40, 14, 2); }
    // achterkasteel + vensters
    g.fillStyle = LG(g, 0, -110, 0, -52, ['#8a5a32', '#5a3418']); g.beginPath(); g.moveTo(80, -52); g.lineTo(80, -92); g.lineTo(150, -98); g.lineTo(156, -62); g.lineTo(120, -52); g.closePath(); g.fill(); g.strokeStyle = '#1a0e06'; g.stroke();
    for (let k = 0; k < 3; k++) { g.fillStyle = n > 0.2 ? '#ffe9a0' : '#bfe0f8'; rr(g, 92 + k * 18, -86, 12, 14, 6); g.fill(); g.strokeStyle = '#e8c050'; g.lineWidth = 1.4; g.stroke(); }
    g.fillStyle = '#e8c050'; g.fillRect(78, -98, 80, 5);
    // masten, zeilen
    const mast = (x, hh, w, sh) => { g.fillStyle = LG(g, x - 4, 0, x + 4, 0, ['#8a6a44', '#4a3018']); g.fillRect(x - 3.5, -50 - hh, 7, hh + 50); for (let k = 0; k < sh; k++) { const yy = -52 - hh * (0.2 + k * 0.5 / sh) - (k ? 4 : 0), ww = w * (1 - k * 0.22); g.fillStyle = '#6a4a28'; g.fillRect(x - ww / 2 - 4, yy - 3, ww + 8, 5); const sh2 = hh * 0.38; g.fillStyle = LG(g, x - ww / 2, 0, x + ww / 2, 0, ['#efe4c8', '#fff8e4', '#d8caa0']); g.beginPath(); g.moveTo(x - ww / 2, yy + 2); g.quadraticCurveTo(x, yy + 12, x + ww / 2, yy + 2); g.lineTo(x + ww / 2 - 5, yy + sh2); g.quadraticCurveTo(x, yy + sh2 + 14, x - ww / 2 + 5, yy + sh2); g.closePath(); g.fill(); g.strokeStyle = 'rgba(60,40,20,.5)'; g.lineWidth = 1.2; g.stroke(); g.fillStyle = 'rgba(80,60,30,.3)'; g.beginPath(); g.ellipse(x + 10, yy + sh2 * 0.5, 6, 4, 0.5, 0, TAU); g.fill(); g.strokeStyle = 'rgba(60,40,20,.3)'; for (let q = 1; q < 4; q++) { g.beginPath(); g.moveTo(x - ww / 2 + 4, yy + 2 + q * sh2 / 4); g.lineTo(x + ww / 2 - 4, yy + 2 + q * sh2 / 4); g.stroke(); } } };
    mast(-60, 150, 90, 2); mast(30, 170, 100, 2);
    g.strokeStyle = 'rgba(40,24,10,.7)'; g.lineWidth = 1; for (const [x, y] of [[-100, -48], [-20, -48], [70, -48], [130, -60]]) { g.beginPath(); g.moveTo(x, y); g.lineTo(-60, -190); g.moveTo(x, y); g.lineTo(30, -208); g.stroke(); }
    g.fillStyle = '#4a3018'; rr(g, 22, -222, 16, 12, 3); g.fill(); g.restore();
  },
  anim(g, t) { // piratenvlag
    const x = 30, y = -208 + 4 - 20; g.strokeStyle = '#2a1a0a'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y + 4); g.lineTo(x, y - 30); g.stroke(); g.fillStyle = '#16161a'; g.beginPath(); g.moveTo(x, y - 30); for (let i = 1; i <= 8; i++) g.lineTo(x + i * 4.5, y - 30 + Math.sin(t * 5 + i) * 2 * i / 8); for (let i = 8; i >= 0; i--) g.lineTo(x + i * 4.5, y - 12 + Math.sin(t * 5 + i) * 2 * i / 8); g.closePath(); g.fill();
    g.fillStyle = '#f0f0f0'; g.beginPath(); g.arc(x + 15, y - 22 + Math.sin(t * 5 + 3) * 0.8, 3.2, 0, TAU); g.fill(); g.fillRect(x + 12, y - 19, 6, 2.5);
    g.save(); g.translate(0, Math.sin(t * 1.6) * 1.2); g.restore();
  },
  lights: [[110, -78, 46, '#ffd080', 0.45, 0.4]],
};
BUILD.tower = {
  bb: [140, 190, 250, 50], hw: 110, up: 225,
  draw(g, R, o) {
    const n = o.night; hullShadow(g, [[-100, 0], [100, 0], [100 + 0.6 * 60, -26], [-100, -26]], 110, 0.3, 7);
    // terminal
    const c = '#e8ecf2'; box3(g, -110, 80, 0, 46, 0, 64, c, { ff: LG(g, 0, -46, 0, 0, [lite(c, 0.1), dark(c, 0.14)]) });
    g.fillStyle = LG(g, 0, -40, 0, -4, n > 0.2 ? ['#ffe9a0', '#ffc060'] : ['#bfe0f8', '#5a88a8']); g.fillRect(-100, -38, 150, 28); g.strokeStyle = '#8a95a8'; g.lineWidth = 2; for (let x = -100; x <= 50; x += 25) { g.beginPath(); g.moveTo(x, -38); g.lineTo(x, -10); g.stroke(); } g.fillStyle = '#c03a2a'; g.fillRect(-110, -48, 190, 4);
    sign(g, 'VLIEGVELD', -88, -66, 100, 16, '#1f5a9a', '#fff', { fs: 12 });
    // toren
    cyl(g, 100, -2, -150, 17, '#f2f2f2', { top: false });
    for (let k = 0; k < 4; k++) { g.fillStyle = '#d83a2a'; g.beginPath(); g.moveTo(83, -20 - k * 36); g.lineTo(117, -20 - k * 36); g.lineTo(117, -34 - k * 36); g.lineTo(83, -34 - k * 36); g.fill(); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(100, -34 - k * 36, 17, 14); } 
    g.fillStyle = LG(g, 0, -150, 0, -2, ['rgba(255,255,255,0)', 'rgba(0,0,0,.12)']); g.fillRect(83, -150, 34, 150);
    // cabine
    g.fillStyle = '#4a5468'; g.beginPath(); g.moveTo(82, -150); g.lineTo(118, -150); g.lineTo(132, -176); g.lineTo(68, -176); g.closePath(); g.fill();
    g.fillStyle = LG(g, 0, -204, 0, -176, n > 0.2 ? ['#ffe9a0', '#ffc060'] : ['#bfe8ff', '#5a98c0']); g.beginPath(); g.moveTo(68, -176); g.lineTo(132, -176); g.lineTo(128, -204); g.lineTo(72, -204); g.closePath(); g.fill(); g.strokeStyle = '#2a3446'; g.lineWidth = 2; for (let k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(68 + k * 16 - (k * 1), -176); g.lineTo(72 + k * 14, -204); g.stroke(); } g.beginPath(); g.moveTo(68, -176); g.lineTo(132, -176); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.moveTo(74, -200); g.lineTo(96, -204); g.lineTo(80, -178); g.fill();
    g.fillStyle = '#4a5468'; g.beginPath(); g.moveTo(66, -204); g.lineTo(134, -204); g.lineTo(122, -214); g.lineTo(78, -214); g.closePath(); g.fill();
    g.strokeStyle = '#2a3446'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(100, -214); g.lineTo(100, -226); g.stroke();
    // windzak
    g.strokeStyle = '#8a95a8'; g.lineWidth = 2; g.beginPath(); g.moveTo(-96, -48); g.lineTo(-96, -90); g.stroke();
    // bagagekarretjes
    for (let k = 0; k < 3; k++) { g.fillStyle = '#e8c030'; g.fillRect(-90 + k * 22, 8, 18, 9); g.fillStyle = '#222'; g.beginPath(); g.arc(-86 + k * 22, 19, 2.4, 0, TAU); g.arc(-76 + k * 22, 19, 2.4, 0, TAU); g.fill(); g.fillStyle = '#3a6a9a'; g.fillRect(-88 + k * 22, 2, 8, 7); }
  },
  anim(g, t) {
    const a = t * 2.5; g.save(); g.translate(100, -232); g.strokeStyle = '#2a3446'; g.lineWidth = 3; g.beginPath(); g.ellipse(0, 0, 18 * Math.abs(Math.cos(a)) + 2, 4, 0, 0, TAU); g.stroke(); g.fillStyle = '#c8ccd4'; g.beginPath(); g.ellipse(0, 0, 18 * Math.abs(Math.cos(a)) + 2, 4, 0, 0, TAU); g.globalAlpha = 0.3; g.fill(); g.restore();
    const sw = Math.sin(t * 3) * 6; g.fillStyle = '#e8702a'; g.beginPath(); g.moveTo(-96, -90); g.lineTo(-96 + 20 + sw, -86 + 2); g.lineTo(-96 + 20 + sw, -82); g.lineTo(-96, -80); g.fill(); g.fillStyle = '#fff'; g.fillRect(-96 + 8, -88 + 1, 4, 7);
    const on = Math.sin(t * 4) > 0.2; g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = on ? '#ff3030' : '#601818'; g.beginPath(); g.arc(100, -232 - 0, 2.5, 0, TAU); g.fill(); if (on) glowBlob(g, 100, -232, 22, '#ff3030', 0.6); g.restore();
  },
  lights: [[100, -190, 50, '#ffe0a0', 0.4, 0.3], [-30, -24, 60, '#ffe0a0', 0.25, 0.3]],
};
BUILD.castle = {
  bb: [180, 230, 290, 50], hw: 146, up: 250,
  draw(g, R, o) {
    const n = o.night, st = '#7a7488'; hullShadow(g, [[-140, 0], [140, 0], [140 + 0.6 * 70, -30], [-140, -30]], 150, 0.36, 9);
    // achtermuur + donjon
    box3(g, -140, 140, 0, 80, 0, 50, st, { ff: LG(g, 0, -80, 0, 0, [lite(st, 0.08), dark(st, 0.22)]) }); brick(g, -140, 140, 0, 80, st, R, 22, 12);
    crenel(g, -140, 140, -80, 14, st, 13);
    box3(g, -54, 54, 80, 170, 6, 56, '#6a6478', { ff: LG(g, 0, -170, 0, -80, [lite('#6a6478', 0.08), dark('#6a6478', 0.22)]) }); brick(g, -54, 54, 80, 170, '#6a6478', R, 20, 11);
    crenel(g, -54, 54, -170, 14, '#6a6478', 7);
    // rode gloeiende ramen en schedel-embleem
    for (const [x, y] of [[-30, -130], [10, -130], [-10, -102]]) { g.fillStyle = '#16101e'; g.beginPath(); g.moveTo(x - 1, y + 24); g.lineTo(x - 1, y + 8); g.arc(x + 7, y + 8, 8, Math.PI, 0); g.lineTo(x + 15, y + 24); g.fill(); g.fillStyle = LG(g, 0, y, 0, y + 24, ['#ff8a3a', '#d82a1a']); g.beginPath(); g.moveTo(x + 1, y + 22); g.lineTo(x + 1, y + 8); g.arc(x + 7, y + 8, 6, Math.PI, 0); g.lineTo(x + 13, y + 22); g.fill(); }
    // torens links en rechts met punthoeden
    for (const sgn of [-1, 1]) { const tx = sgn * 118; cyl(g, tx, -2, -150, 28, '#8a8498', { topCol: '#6a6478' }); g.save(); g.beginPath(); g.rect(tx - 28, -150, 56, 150); g.clip(); brick(g, tx - 28, tx + 28, 0, 150, '#8a8498', R, 18, 10); g.fillStyle = LG(g, tx - 28, 0, tx + 28, 0, ['rgba(255,255,255,.12)', 'rgba(0,0,0,0)', 'rgba(0,0,0,.4)']); g.fillRect(tx - 28, -150, 56, 150); g.restore();
      cone(g, tx, -150, 36, 66, '#4a2a6a'); g.fillStyle = '#2a1a3a'; g.fillRect(tx - 1.2, -226, 2.4, 14); g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.moveTo(tx - 4, -214); g.lineTo(tx - 32, -150); g.lineTo(tx - 20, -150); g.closePath(); g.fill();
      for (const y of [-120, -70]) { g.fillStyle = '#16101e'; rr(g, tx - 5, y - 8, 10, 18, 5); g.fill(); g.fillStyle = '#ff6a2a'; rr(g, tx - 3, y - 6, 6, 14, 3); g.fill(); } }
    cone(g, 0, -170, 50, 62, '#4a2a6a'); g.fillStyle = 'rgba(255,255,255,.1)'; g.beginPath(); g.moveTo(-3, -230); g.lineTo(-48, -170); g.lineTo(-30, -170); g.closePath(); g.fill();
    // poort met valhek
    g.fillStyle = '#3a3448'; g.fillRect(-32, -66, 64, 66); g.fillStyle = '#16101e'; g.beginPath(); g.moveTo(-26, -2); g.lineTo(-26, -42); g.arc(0, -42, 26, Math.PI, 0); g.lineTo(26, -2); g.fill(); g.fillStyle = '#ff6a2a'; g.globalAlpha = 0.35; g.beginPath(); g.moveTo(-22, -2); g.lineTo(-22, -42); g.arc(0, -42, 22, Math.PI, 0); g.lineTo(22, -2); g.fill(); g.globalAlpha = 1;
    g.strokeStyle = '#3a3a42'; g.lineWidth = 2.4; for (let x = -20; x <= 20; x += 8) { g.beginPath(); g.moveTo(x, -2); g.lineTo(x, -52 + Math.abs(x) * 0.4); g.stroke(); } for (let y = -10; y > -52; y -= 12) { g.beginPath(); g.moveTo(-22, y); g.lineTo(22, y); g.stroke(); }
    stairs(g, -34, 34, 3, 4, '#6a6478');
    // bannieren
    for (const x of [-80, 80]) { g.fillStyle = '#6a1a8a'; g.beginPath(); g.moveTo(x - 9, -76); g.lineTo(x + 9, -76); g.lineTo(x + 9, -40); g.lineTo(x, -48); g.lineTo(x - 9, -40); g.closePath(); g.fill(); g.fillStyle = '#e8c050'; g.beginPath(); g.arc(x, -62, 4, 0, TAU); g.fill(); }
    // schedel boven poort
    g.fillStyle = '#e8e4d8'; g.beginPath(); g.arc(0, -76, 8, 0, TAU); g.fill(); g.fillRect(-4, -72, 8, 6); g.fillStyle = '#16101e'; g.beginPath(); g.arc(-3, -77, 2, 0, TAU); g.arc(3, -77, 2, 0, TAU); g.fill();
    // fakkels
    for (const x of [-44, 44]) { g.fillStyle = '#4a3220'; g.fillRect(x - 1.5, -34, 3, 28); }
    // dode boompjes
    for (const x of [-168, 170]) { g.strokeStyle = '#2a2230'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, 14); g.lineTo(x, -34); g.moveTo(x, -16); g.lineTo(x - 14, -36); g.moveTo(x, -26); g.lineTo(x + 12, -44); g.stroke(); }
  },
  anim(g, t) {
    for (const [x, y, ph] of [[-44, -34, 0], [44, -34, 1.3]]) { const f = 1 + Math.sin(t * 11 + ph) * 0.18; g.save(); g.translate(x, y); g.scale(f, f); g.fillStyle = '#ff7a1a'; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-6, -8, 0, -18); g.quadraticCurveTo(6, -8, 0, 0); g.fill(); g.fillStyle = '#ffe070'; g.beginPath(); g.moveTo(0, -1); g.quadraticCurveTo(-2.5, -6, 0, -11); g.quadraticCurveTo(2.5, -6, 0, -1); g.fill(); g.restore(); }
    g.strokeStyle = '#2a1a3a'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -232); g.lineTo(0, -262); g.stroke(); g.fillStyle = '#c01a4a'; g.beginPath(); g.moveTo(0, -262); for (let i = 1; i <= 8; i++) g.lineTo(i * 3.4, -262 + Math.sin(t * 5 + i) * 2 * i / 8); for (let i = 8; i >= 0; i--) g.lineTo(i * 3.4, -250 + Math.sin(t * 5 + i) * 2 * i / 8); g.closePath(); g.fill();
    g.save(); g.globalCompositeOperation = 'lighter'; glowBlob(g, -10, -118, 80, '#ff4a2a', 0.1 + Math.sin(t * 2) * 0.03); glowBlob(g, -118, -90, 60, '#ff6a2a', 0.14); glowBlob(g, 118, -90, 60, '#ff6a2a', 0.14); g.restore();
  },
  lights: [[-44, -50, 40, '#ff8a3a', 0.5, 0.8], [44, -50, 40, '#ff8a3a', 0.5, 0.8], [0, -24, 50, '#ff6a2a', 0.3, 0.5]],
};

// ================================================================ hoofdstukken (terrein + bewegende dingen)
const CITY = {};
const keepOut = (cfg) => (x, y, pad = 0) => cfg.slots.some((sd) => { const sp = BUILD[sd.kind]; return x > sd.x - sp.hw * sd.s - pad && x < sd.x + sp.hw * sd.s + pad + 24 && y > sd.y - sp.up * sd.s - pad && y < sd.y + 84 + pad; });
const nearPoly = (poly, x, y, d) => { for (let i = 0; i < poly.length; i += 2) if (Math.abs(poly[i][0] - x) < d && Math.abs(poly[i][1] - y) < d && Math.hypot(poly[i][0] - x, poly[i][1] - y) < d) return true; return false; };
function cloudShadows(world, n, a = 0.13) {
  const c = mk(300, 160), g = c.getContext('2d'); for (let i = 0; i < 7; i++) { g.save(); g.translate(60 + i * 30, 80 + Math.sin(i * 2.3) * 24); g.scale(1.6, 1); glowBlob(g, 0, 0, 46 + (i % 3) * 10, '#000', 0.5); g.restore(); }
  const R = world.R, cl = []; for (let i = 0; i < n; i++) cl.push({ x: R() * (W + 300), y: 120 + R() * 540, s: 0.8 + R() * 1.2, v: 7 + R() * 7 });
  world.front.push((g2, t) => { g2.save(); g2.globalAlpha = a; for (const q of cl) { const x = ((q.x + t * q.v) % (W + 600)) - 300; g2.drawImage(c, x, q.y, 300 * q.s, 160 * q.s); } g2.restore(); });
}
function birdsFlock(world, n, y0, y1, sp = 40) {
  const R = world.R, b = []; for (let i = 0; i < n; i++) b.push({ x: R() * W, y: y0 + R() * (y1 - y0), v: sp * (0.7 + R() * 0.6), ph: R() * 9, s: 0.8 + R() * 0.5 });
  world.front.push((g, t) => { for (const q of b) { const x = ((q.x + t * q.v) % (W + 120)) - 60, y = q.y + Math.sin(t * 0.7 + q.ph) * 10; g.save(); g.globalAlpha = 0.9; g.fillStyle = 'rgba(0,0,0,.12)'; g.beginPath(); g.ellipse(x + 20, y + 70, 7 * q.s, 2.5 * q.s, 0, 0, TAU); g.fill(); g.restore(); drawBird(g, x, y, t + q.ph, q.s); } });
}
function glintsDraw(world, list, col = '#fff') { world.back.push((g, t) => { g.lineWidth = 1.5; g.lineCap = 'round'; for (const q of list) { const a = Math.max(0, Math.sin(t * q.sp + q.ph)); if (a < 0.05) continue; g.strokeStyle = rgba(col, a * 0.7); g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(q.x + q.w, q.y); g.stroke(); } }); }
function tinyGnome(g, x, y, dir, t, hat, body) {
  g.save(); g.translate(x, y); softShadow(g, 2, 1, 9, 3, 0.3); const sw = Math.sin(t * 8) * 2.5;
  g.strokeStyle = '#3a2a1a'; g.lineWidth = 2.6; g.lineCap = 'round'; g.beginPath(); g.moveTo(-2, -8); g.lineTo(-2 + sw, 0); g.moveTo(2, -8); g.lineTo(2 - sw, 0); g.stroke();
  g.fillStyle = body; rr(g, -5, -20, 10, 14, 4); g.fill(); g.fillStyle = '#f0c8a0'; g.beginPath(); g.arc(0, -24, 4.6, 0, TAU); g.fill();
  g.fillStyle = '#f4f4f4'; g.beginPath(); g.moveTo(-4.4, -23); g.quadraticCurveTo(0, -12, 4.4, -23); g.closePath(); g.fill();
  g.fillStyle = hat; g.beginPath(); g.moveTo(-6.5, -26); g.quadraticCurveTo(0, -30, dir * 4 + 1, -42); g.quadraticCurveTo(5, -30, 6.5, -26); g.closePath(); g.fill(); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 0.8; g.stroke(); g.restore();
}
function walkerPath(world, poly, n, col, draw, speed = 26) {
  const R = world.R; for (let i = 0; i < n; i++) {
    const o = { u: R(), v: speed * (0.7 + R() * 0.6) * (R() < 0.5 ? 1 : -1), c: col[(R() * col.length) | 0], c2: col[(R() * col.length) | 0] }; let len = 0; const cum = [0]; for (let k = 1; k < poly.length; k++) { len += Math.hypot(poly[k][0] - poly[k - 1][0], poly[k][1] - poly[k - 1][1]); cum.push(len); }
    const at = (t) => { let d = ((o.u * len + o.v * t) % (2 * len) + 2 * len) % (2 * len), dir = o.v > 0 ? 1 : -1; if (d > len) { d = 2 * len - d; dir = -dir; } let k = 1; while (k < cum.length - 1 && cum[k] < d) k++; const u = (d - cum[k - 1]) / Math.max(1, cum[k] - cum[k - 1]); return { x: lerp(poly[k - 1][0], poly[k][0], u), y: lerp(poly[k - 1][1], poly[k][1], u), dir }; };
    world.actors.push({ y: (t) => at(t).y, draw: (g, t) => { const p = at(t); draw(g, p.x, p.y, p.dir, t + i, o.c, o.c2); } });
  }
}

CITY.village = {
  night: 0.55, vig: 0.42, wash: ['rgba(72,48,132,.20)', 'rgba(255,150,70,.06)'], spriteTint: 'rgba(110,70,150,.09)',
  slots: [
    { x: 205, y: 346, s: 0.92, kind: 'm1', color: '#d8362a' },
    { x: 440, y: 598, s: 1.0, kind: 'm2', color: '#3a6ad0' },
    { x: 668, y: 346, s: 0.9, kind: 'm3', color: '#b8802a' },
    { x: 905, y: 598, s: 0.95, kind: 'townhall' },
    { x: 1085, y: 346, s: 0.9, kind: 'mushbank' },
  ],
  paint(g, R, world) {
    const cfg = CITY.village, out = keepOut(cfg);
    paintGrass(g, R, 0, 0, W, H, '#52a040', ['#5aa845', '#3a8030', '#74bd52', '#2f7a30', '#86c85e', '#4f9a3c']);
    // lichtvlekken (bosbodem) en schaduw van het bladerdak langs de randen
    for (let i = 0; i < 26; i++) glowBlob(g, R() * W, 120 + R() * 560, 60 + R() * 90, R() < 0.5 ? '#c8e86a' : '#e8d870', 0.07);
    for (let i = 0; i < 18; i++) glowBlob(g, R() * W, R() * 140, 90 + R() * 100, '#0a2a14', 0.16);
    for (let i = 0; i < 14; i++) { glowBlob(g, R() * 90, R() * H, 90, '#0a2a14', 0.15); glowBlob(g, W - R() * 90, R() * H, 90, '#0a2a14', 0.15); }
    // rivier
    const riv = curveSample([[-60, 470], [200, 492], [430, 466], [660, 494], [880, 468], [1100, 490], [1340, 468]], 5);
    strokePoly(g, riv, 78, 'rgba(40,28,10,.35)'); strokePoly(g, riv, 70, '#6a5434'); strokePoly(g, riv, 64, '#4f7a3a');
    strokePoly(g, riv, 58, LG(g, 0, 440, 0, 520, ['#6cc0e0', '#2f7fae'])); strokePoly(g, riv, 40, 'rgba(255,255,255,.07)'); strokePoly(g, riv.map((p) => [p[0], p[1] + 16]), 12, 'rgba(0,0,40,.12)');
    const glints = []; for (let i = 0; i < riv.length; i += 3) if (R() < 0.7) glints.push({ x: riv[i][0] + (R() - 0.5) * 8, y: riv[i][1] + (R() - 0.5) * 36, w: 6 + R() * 12, ph: R() * 9, sp: 1 + R() * 1.5 });
    glintsDraw(world, glints);
    for (let i = 0; i < riv.length; i += 9) { rock(g, riv[i][0] + (R() - 0.5) * 20, riv[i][1] - 36 - R() * 4, 0.5 + R() * 0.4, '#8a8a80'); }
    // pad
    const path = curveSample([[-30, 400], [205, 364], [330, 450], [446, 630], [560, 520], [668, 366], [790, 460], [905, 630], [1000, 505], [1085, 366], [1310, 420]], 5);
    world.path = path;
    strokePoly(g, path, 48, 'rgba(0,0,0,.18)'); strokePoly(g, path, 44, '#7a5a34'); strokePoly(g, path, 38, '#b8935c'); strokePoly(g, path, 22, 'rgba(255,240,200,.18)');
    g.fillStyle = 'rgba(70,45,20,.35)'; for (let i = 0; i < path.length; i++) { const p = path[i]; for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(p[0] + (R() - 0.5) * 36, p[1] + (R() - 0.5) * 30, 1 + R() * 2.4, 1 + R() * 1.4, 0, 0, TAU); g.fill(); } }
    g.fillStyle = 'rgba(255,255,255,.2)'; for (let i = 0; i < path.length; i += 2) { const p = path[i]; g.beginPath(); g.ellipse(p[0] + (R() - 0.5) * 30, p[1] + (R() - 0.5) * 24, 1.3, 0.9, 0, 0, TAU); g.fill(); }
    // bruggetjes waar het pad de rivier kruist
    const rivY = (x) => { let b = riv[0]; for (const p of riv) if (Math.abs(p[0] - x) < Math.abs(b[0] - x)) b = p; return b[1]; };
    let lastB = -999; for (let i = 2; i < path.length - 2; i++) { const p = path[i]; if (Math.abs(p[1] - rivY(p[0])) < 3 && p[0] - lastB > 120) { lastB = p[0]; const q = path[i - 2], r = path[i + 2], ang = Math.atan2(r[1] - q[1], r[0] - q[0]); bridgeWood(g, p[0], p[1], 38, 100, ang); } }
    // struiken en bloemen bij het pad
    for (let i = 0; i < 90; i++) { const p = path[(R() * path.length) | 0], x = p[0] + (R() < 0.5 ? -1 : 1) * (30 + R() * 22), y = p[1] + (R() - 0.5) * 20; if (out(x, y, 6) || Math.abs(y - rivY(x)) < 50) continue; flowers(g, R, x, y, 22, 10, 3, ['#ff6a8a', '#ffe060', '#fff', '#b080ff', '#80c8ff']); }
    for (let i = 0; i < 30; i++) { const x = R() * W, y = 130 + R() * 560; if (out(x, y, 14) || Math.abs(y - rivY(x)) < 56 || nearPoly(path, x, y, 40)) continue; rock(g, x, y, 0.5 + R() * 0.6); }
    // paddenstoeltjes
    const mush = (x, y, s, c) => { g.save(); g.translate(x, y); g.scale(s, s); softShadow(g, 5, 1, 12, 3, 0.3); g.fillStyle = '#efe2c4'; g.fillRect(-3, -9, 6, 9); g.fillStyle = RG(g, 0, -12, 1, 11, [lite(c, 0.3), c, dark(c, 0.3)], -3, -15); g.beginPath(); g.ellipse(0, -10, 10, 7, 0, Math.PI, 0); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(-3, -14, 1.7, 0, TAU); g.arc(3, -12, 1.4, 0, TAU); g.fill(); g.restore(); };
    for (let i = 0; i < 40; i++) { const x = R() * W, y = 120 + R() * 580; if (out(x, y, 10) || Math.abs(y - rivY(x)) < 52 || nearPoly(path, x, y, 30)) continue; for (let k = 0; k < 2 + ((R() * 2) | 0); k++) mush(x + k * 11, y + (R() - 0.5) * 8, 0.6 + R() * 0.6, R() < 0.6 ? '#d8362a' : '#d8a02a'); }
    // lantaarnpalen langs het pad
    const lp = [[300, 428], [575, 560], [772, 450], [1002, 535], [120, 372], [1190, 386]]; for (const [x, y] of lp) { lamppost(g, x, y, 0.8, 1, 'wood'); world.lights.push({ x, y: y - 56, r: 64, c: '#ffc860', a: 0.6, fl: 0.5, ph: R() * 9 }); }
    // bomen: bosrand boven, tussendoor een paar
    const trees = []; const tryTree = (x, y, k, s) => { if (out(x, y, -16) && k !== 'pine') { /* mag achter gebouw staan */ } trees.push([x, y, k, s]); };
    for (let i = 0; i < 26; i++) { const x = R() * W, y = 92 + R() * 150; tryTree(x, y, R() < 0.55 ? 'pine' : 'oak', 0.75 + R() * 0.55); }
    for (let i = 0; i < 60; i++) { const x = R() * W, y = 250 + R() * 400; if (out(x, y, 20) || Math.abs(y - rivY(x)) < 60 || nearPoly(path, x, y, 46) || y > 590 && (x > 300 && x < 1020)) continue; if (x > 120 && x < 1160 && R() < 0.45) continue; tryTree(x, y, R() < 0.5 ? 'pine' : 'oak', 0.6 + R() * 0.45); }
    trees.sort((a, b) => a[1] - b[1]); const TR = RNG(77); for (const [x, y, k, s] of trees) tree(g, x, y, s, k, TR, k === 'oak' && TR() < 0.3 ? '#4a9a3a' : undefined);
    // vuurvliegjes en schaduw-wolken
    const ff = []; for (let i = 0; i < 46; i++) ff.push({ x: R() * W, y: 120 + R() * 560, r: 20 + R() * 40, sp: 0.3 + R() * 0.5, ph: R() * 9, bl: 0.6 + R() * 1.2 });
    world.front.push((g2, t) => { g2.save(); g2.globalCompositeOperation = 'lighter'; for (const f of ff) { const x = f.x + Math.sin(t * f.sp + f.ph) * f.r, y = f.y + Math.cos(t * f.sp * 1.3 + f.ph) * f.r * 0.6, a = Math.max(0, Math.sin(t * f.bl + f.ph)); if (a < 0.05) continue; g2.globalAlpha = a; g2.drawImage(glowSprite('#d8ff70'), x - 9, y - 9, 18, 18); g2.fillStyle = '#fff8c0'; g2.beginPath(); g2.arc(x, y, 1.4, 0, TAU); g2.fill(); } g2.restore(); });
    walkerPath(world, path.slice(0, 120), 4, ['#d8362a', '#3a6ad0', '#2a8a4a', '#b8802a'], (g2, x, y, dir, t, c, c2) => tinyGnome(g2, x, y, dir, t * 1.2, c, c2), 20);
    birdsFlock(world, 4, 100, 240, 30); cloudShadows(world, 4, 0.12);
  },
  paintFront(g, R, world) {
    const trees = [[40, 712, 'pine', 1.2], [1245, 708, 'pine', 1.25], [110, 725, 'oak', 1.0], [1170, 722, 'oak', 1.05], [20, 520, 'pine', 1.1], [1262, 530, 'pine', 1.1], [18, 300, 'oak', 1.0], [1264, 290, 'oak', 1.05]];
    for (const [x, y, k, s] of trees) tree(g, x, y, s, k, R);
    for (let i = 0; i < 40; i++) { const x = R() * W, y = 690 + R() * 30; if (x > 330 && x < 1000) continue; bush(g, x, y, 0.7 + R() * 0.6, ['#2f7a3a', '#3a8a3a', '#2a6a34'][(R() * 3) | 0], R); }
    flowers(g, R, 60, 690, 200, 30, 40, ['#ff6a8a', '#ffe060', '#fff', '#b080ff']); flowers(g, R, 1020, 690, 200, 30, 40, ['#ff6a8a', '#ffe060', '#fff', '#80c8ff']);
  },
};

const lanternCache = new Map();
function lanternSprite(col) { if (lanternCache.has(col)) return lanternCache.get(col); const c = mk(40, 56), g = c.getContext('2d'); g.translate(20, 8); g.scale(1.6, 1.6); lantern(g, 0, 0, 1, col); lanternCache.set(col, c); return c; }
function lanternString(world, x0, y0, x1, y1, sag, n, cols, ph = 0, litCol = '#ff6a3a') {
  const pts = []; for (let i = 0; i <= n; i++) { const u = i / n; pts.push([lerp(x0, x1, u), lerp(y0, y1, u) + Math.sin(u * Math.PI) * sag, u]); }
  for (const p of pts) world.lights.push({ x: p[0], y: p[1] + 16, r: 38, c: litCol, a: 0.5, fl: 0.5, ph: ph + p[2] * 7 });
  world.front.push((g, t) => {
    g.strokeStyle = 'rgba(30,16,10,.85)'; g.lineWidth = 1.4; g.beginPath(); pts.forEach((p, i) => { const sw = Math.sin(t * 1.3 + ph + i) * 0.8; if (i) g.lineTo(p[0], p[1] + sw); else g.moveTo(p[0], p[1]); }); g.stroke();
    pts.forEach((p, i) => { if (i === 0 || i === n) return; const sw = Math.sin(t * 1.3 + ph + i); g.drawImage(lanternSprite(cols[i % cols.length]), p[0] - 12 + sw * 1.2, p[1] - 2 + sw * 0.6, 24, 33); });
  });
}
function pole(g, x, y, h, col = '#3a2a20') { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x + 2, y - 2, h * 0.5, 4); g.fillStyle = LG(g, x - 3, 0, x + 3, 0, [lite(col, 0.2), dark(col, 0.2)]); g.fillRect(x - 3, y - h, 6, h); }
function parkingLot(g, R, x, y, w, h, rows, cars) {
  paintAsphalt(g, R, x, y, w, h, '#50535a'); g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 2; g.strokeRect(x + 3, y + 3, w - 6, h - 6);
  const rh = h / rows; for (let r = 0; r <= rows; r++) { g.beginPath(); g.moveTo(x + 3, y + r * rh); g.lineTo(x + w - 3, y + r * rh); g.stroke(); }
  const cols = Math.floor(w / 76); for (let r = 0; r < rows; r++) for (let c = 0; c <= cols; c++) { g.beginPath(); g.moveTo(x + c * (w / cols), y + r * rh + 2); g.lineTo(x + c * (w / cols), y + (r + 1) * rh - 2); g.stroke(); }
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { if (R() < 0.35) continue; const cx = x + (c + 0.5) * (w / cols), cy = y + (r + 1) * rh - 4; drawCar(g, cx, cy, R() < 0.5 ? 1 : -1, cars[(R() * cars.length) | 0], R() < 0.2 ? 'van' : 'car', 0); }
  g.fillStyle = 'rgba(255,255,255,.35)'; g.font = `700 22px ${FONT}`; g.textAlign = 'center'; g.fillText('P', x + w / 2, y + h - 8);
}
function brickPave(g, R, x, y, w, h, base = '#b89a84') { g.fillStyle = base; g.fillRect(x, y, w, h); for (let r = 0, yy = y; yy < y + h; yy += 5, r++) for (let xx = x - (r % 2) * 5; xx < x + w; xx += 10) { const v = R() * 0.2 - 0.08; g.fillStyle = v > 0 ? lite(base, v) : dark(base, -v); g.fillRect(Math.max(x, xx + 0.5), yy + 0.5, 9, 4); } }

CITY.nl = {
  night: 0.25, vig: 0.38, wash: ['rgba(255,196,120,.12)', 'rgba(255,170,90,.06)'], spriteTint: 'rgba(255,200,130,.05)',
  slots: [
    { x: 440, y: 598, s: 0.92, kind: 'rowhouse' }, { x: 205, y: 346, s: 0.9, kind: 'canalhouse' }, { x: 890, y: 598, s: 0.9, kind: 'supermarket' },
    { x: 1095, y: 346, s: 0.9, kind: 'casino' }, { x: 668, y: 346, s: 0.92, kind: 'chinese' },
  ],
  paint(g, R, world) {
    const cfg = CITY.nl, out = keepOut(cfg);
    paintGrass(g, R, 0, 0, W, H, '#6ab048', ['#7cc258', '#5aa03e', '#8ad064', '#4f9638', '#96d870']);
    // verre polder en tulpenvelden
    g.fillStyle = LG(g, 0, 0, 0, 250, ['#9ad07a', '#7cc258']); g.fillRect(0, 0, W, 250);
    tulips(g, R, 24, 108, 250, 70, ['#e8342a', '#ffd23a', '#ff8ac0', '#ffffff', '#b050d0'], 7); tulips(g, R, 560, 98, 290, 66, ['#ffd23a', '#e8342a', '#fff', '#ff8ac0'], 7); tulips(g, R, 900, 120, 210, 74, ['#c070ff', '#ff8ac0', '#ffd23a', '#e8342a'], 7);
    g.fillStyle = 'rgba(40,90,40,.3)'; g.fillRect(0, 190, W, 3); g.fillStyle = '#5a9ad0'; g.fillRect(0, 196, W, 8); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(0, 197, W, 2);
    // molen
    const mx = 470, my = 262; softShadow(g, mx + 40, my + 2, 70, 12, 0.3);
    g.fillStyle = LG(g, mx - 30, 0, mx + 30, 0, ['#e8dccc', '#c8b89c', '#8a7a64']); g.beginPath(); g.moveTo(mx - 30, my); g.lineTo(mx - 18, my - 100); g.lineTo(mx + 18, my - 100); g.lineTo(mx + 30, my); g.closePath(); g.fill(); g.strokeStyle = 'rgba(0,0,0,.3)'; g.stroke();
    g.fillStyle = '#6a4a2c'; g.fillRect(mx - 7, my - 28, 14, 28); g.fillStyle = '#3a2a1a'; g.fillRect(mx - 6, my - 60, 12, 14); g.fillStyle = LG(g, 0, my - 112, 0, my - 100, ['#3a4a5a', '#2a3a4a']); g.beginPath(); g.moveTo(mx - 24, my - 100); g.quadraticCurveTo(mx, my - 150, mx + 24, my - 100); g.closePath(); g.fill();
    g.fillStyle = '#c8b89c'; g.fillRect(mx - 42, my - 12, 12, 12); g.fillRect(mx + 30, my - 12, 12, 12);
    world.back.push((g2, t) => { const hx = mx, hy = my - 108; g2.save(); g2.translate(hx, hy + 10); g2.rotate(t * 0.35); for (let k = 0; k < 4; k++) { g2.save(); g2.rotate(k * Math.PI / 2); g2.fillStyle = '#6a4a2c'; g2.fillRect(-2, -2, 4, 70); g2.fillStyle = 'rgba(245,238,220,.95)'; g2.fillRect(2, 14, 20, 52); g2.strokeStyle = 'rgba(90,70,40,.7)'; g2.lineWidth = 1; for (let q = 0; q < 6; q++) { g2.beginPath(); g2.moveTo(2, 14 + q * 9); g2.lineTo(22, 14 + q * 9); g2.stroke(); } g2.strokeRect(2, 14, 20, 52); g2.restore(); } g2.fillStyle = '#3a2a1a'; g2.beginPath(); g2.arc(0, 0, 6, 0, TAU); g2.fill(); g2.restore(); });
    // gazon + heggen tussen de gebouwen (noordkant)
    for (let i = 0; i < 40; i++) glowBlob(g, R() * W, 260 + R() * 150, 50 + R() * 60, R() < 0.5 ? '#b8e88a' : '#4a9a3a', 0.14);
    // noord-kade: klinkerstraatje, dan gracht
    brickPave(g, R, 0, 404, W, 40, '#b8957c'); g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(0, 404, W, 3); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, 442, W, 2);
    const canal = new Path2D(); canal.rect(-10, 446, W + 20, 46);
    g.fillStyle = '#5a4630'; g.fillRect(0, 443, W, 6); g.fillRect(0, 490, W, 6); g.fillStyle = '#8a3a2a'; g.fillRect(0, 446, W, 4); g.fillRect(0, 490, W, 4);
    paintWater(g, R, canal, '#7ab8d8', '#3a7ea8', { y0: 446, y1: 492, n: 60 });
    g.save(); g.clip(canal); for (let i = 0; i < 40; i++) { const x = R() * W; g.fillStyle = `rgba(${R() < 0.5 ? '230,230,240' : '30,60,40'},.14)`; g.fillRect(x, 448 + R() * 40, 20 + R() * 40, 2); } g.fillStyle = LG(g, 0, 446, 0, 460, ['rgba(0,0,0,.3)', 'rgba(0,0,0,0)']); g.fillRect(0, 446, W, 14); g.restore();
    const glints = collectGlints(g, R, canal, [0, 448, W, 490], 70); glintsDraw(world, glints);
    // zuidkade en straat
    brickPave(g, R, 0, 494, W, 14, '#a8896f'); paintAsphalt(g, R, 0, 508, W, 58, '#4a4d54'); g.fillStyle = '#9a9a96'; g.fillRect(0, 506, W, 3); g.fillRect(0, 566, W, 4); dashLine(g, 0, 537, W, 537, '#e8e0b0', 3, [26, 20]);
    zebra(g, 585, 508, 46, 58, false); zebra(g, 1145, 508, 46, 58, false);
    // stoep en plein voor
    brickPave(g, R, 0, 570, W, 150, '#b89a84'); for (let i = 0; i < 20; i++) glowBlob(g, R() * W, 580 + R() * 140, 60, '#000', 0.05);
    // stenen bruggen over de gracht
    for (const bx of [608, 1168]) { g.save(); g.translate(bx, 468); g.rotate(Math.PI / 2); bridgeStone(g, 0, 0, 56, 74, '#c8bca8'); g.restore(); }
    // parkeerterrein supermarkt
    parkingLot(g, R, 1048, 580, 222, 128, 4, ['#c8302a', '#2a6ac0', '#e8e8e0', '#2a2a30', '#f0c030', '#3a8a5a', '#8a8a92']);
    lamppost(g, 1056, 585, 0.8, 1); lamppost(g, 1262, 585, 0.8, 1); world.lights.push({ x: 1056, y: 530, r: 50, c: '#ffe0a0', a: 0.28 }, { x: 1262, y: 530, r: 50, c: '#ffe0a0', a: 0.28 });
    // bomen langs de kade en in het groen
    const trees = []; for (const x of [372, 470, 815, 905, 560, 760]) trees.push([x, 436, 'oak', 0.62]); for (const x of [30, 150, 300, 560, 790, 990, 1190, 1250]) trees.push([x, 252 + R() * 30, R() < 0.5 ? 'poplar' : 'oak', 0.9]);
    for (const x of [80, 360, 600, 780, 980]) trees.push([x, 580 + R() * 6, 'oak', 0.7]);
    for (let i = 0; i < 16; i++) { const x = R() * W, y = 232 + R() * 160; if (out(x, y, 16)) continue; trees.push([x, y, 'oak', 0.6 + R() * 0.3]); }
    trees.sort((a, b) => a[1] - b[1]); const TR = RNG(9); for (const [x, y, k, s] of trees) { if (out(x, y, -10) && y < 400) { /* achter gebouw */ } tree(g, x, y, s, k, TR, k === 'oak' ? ['#4a9a3a', '#5aa83c', '#3f8f3a'][(TR() * 3) | 0] : '#3f8a3a'); }
    flowers(g, R, 10, 300, 90, 90, 40, ['#ff6a8a', '#ffe060', '#fff']); for (let i = 0; i < 7; i++) bush(g, 30 + i * 180 + R() * 40, 400, 0.7, '#3a8a3a', R);
    // fietsenrekken
    for (const bx of [760, 350, 1000]) for (let k = 0; k < 4; k++) drawBike(g, bx + k * 18, 428 + (k % 2) * 4, k % 2 ? -1 : 1, 0, ['#2a6ac0', '#c02828', '#2a2a30', '#e0a020'][k]);
    // verkeer
    const carCols = ['#c8302a', '#2a6ac0', '#e8e8e0', '#2a2a30', '#f0c030', '#3a8a5a', '#e07a2a'];
    for (let i = 0; i < 6; i++) { const lane = i % 2, v = (60 + R() * 40) * (lane ? -1 : 1), o = R() * (W + 200), cc = carCols[i % carCols.length], y = lane ? 551 : 523, kind = R() < 0.2 ? 'van' : 'car'; world.actors.push({ y: () => y, draw: (g2, t) => { const x = (((o + v * t) % (W + 240)) + W + 240) % (W + 240) - 120; drawCar(g2, x, y, v > 0 ? 1 : -1, cc, kind, 0); } }); }
    // fietsers op de noordkade
    for (let i = 0; i < 4; i++) { const v = (34 + R() * 20) * (i % 2 ? -1 : 1), o = R() * W * 1.2, y = 426 + (i % 2) * 8; world.actors.push({ y: () => y + 4, draw: (g2, t) => { const x = (((o + v * t) % (W + 100)) + W + 100) % (W + 100) - 50; drawBike(g2, x, y + 4, v > 0 ? 1 : -1, t, ['#e07a2a', '#8a3ac0', '#2a8a5a', '#c02828'][i]); } }); }
    // wandelaars
    walkerPath(world, [[40, 600], [600, 598], [1000, 600], [1270, 596]], 4, ['#c83a3a', '#3a6ac0', '#e0a020', '#3a9a5a', '#8a3ac0'], (g2, x, y, dir, t, c) => drawWalker(g2, x, y, dir, t, c, null), 22);
    // grachtenboot
    const bv = 16; world.actors.push({ y: () => 478, draw: (g2, t) => { const x = ((t * bv + 200) % (W + 300)) - 150; g2.save(); g2.translate(x, 472); g2.fillStyle = 'rgba(0,0,0,.25)'; g2.beginPath(); g2.ellipse(4, 12, 60, 6, 0, 0, TAU); g2.fill(); g2.fillStyle = LG(g2, 0, -8, 0, 12, ['#f4f4ee', '#a8aab0']); g2.beginPath(); g2.moveTo(-58, 0); g2.lineTo(58, 0); g2.lineTo(46, 12); g2.lineTo(-48, 12); g2.closePath(); g2.fill(); g2.fillStyle = '#2a6a9a'; g2.fillRect(-58, 0, 116, 3); g2.fillStyle = 'rgba(190,225,255,.9)'; rr(g2, -34, -14, 62, 14, 4); g2.fill(); g2.strokeStyle = '#d8dce0'; g2.lineWidth = 2; for (let k = 0; k < 6; k++) { g2.beginPath(); g2.moveTo(-28 + k * 11, -14); g2.lineTo(-28 + k * 11, 0); g2.stroke(); } g2.fillStyle = '#e8e8e0'; g2.fillRect(-36, -17, 66, 4); g2.fillStyle = 'rgba(255,255,255,.5)'; g2.beginPath(); g2.ellipse(-60, 11, 8, 2, 0, 0, TAU); g2.fill(); g2.restore(); } });
    // eendjes
    for (let i = 0; i < 4; i++) { const o = R() * 700, y = 470 + R() * 12; world.actors.push({ y: () => y, draw: (g2, t) => { const x = ((t * (6 + i * 2) + o) % (W + 80)) - 40; g2.fillStyle = '#f4f0e0'; g2.beginPath(); g2.ellipse(x, y, 5, 3, 0, 0, TAU); g2.fill(); g2.fillStyle = '#4a7a3a'; g2.beginPath(); g2.arc(x + 4, y - 3, 2.4, 0, TAU); g2.fill(); g2.fillStyle = '#e8a020'; g2.fillRect(x + 6, y - 3, 3, 1.4); } }); }
    birdsFlock(world, 5, 90, 300, 30); cloudShadows(world, 5, 0.1);
  },
  paintFront(g, R, world) {
    for (const [x, y, k, s] of [[24, 712, 'oak', 1.15], [1250, 716, 'oak', 1.1], [90, 690, 'poplar', 1.0], [640, 712, 'oak', 0.8], [1200, 480, 'poplar', 0.9]]) tree(g, x, y, s, k, R, '#4a9a3a');
    for (let i = 0; i < 10; i++) { const x = 20 + R() * 1240, y = 692 + R() * 26; if (x > 380 && x < 1000) continue; flowers(g, R, x, y, 40, 14, 6, ['#ffd23a', '#e8342a', '#ff8ac0']); }
  },
};

CITY.china = {
  night: 0.6, vig: 0.5, wash: ['rgba(130,30,50,.26)', 'rgba(255,120,60,.08)'], spriteTint: 'rgba(150,50,60,.09)',
  slots: [
    { x: 205, y: 346, s: 0.92, kind: 'hutong' }, { x: 440, y: 598, s: 0.95, kind: 'apartment' }, { x: 668, y: 346, s: 0.92, kind: 'teashop' },
    { x: 900, y: 598, s: 0.95, kind: 'electronics' }, { x: 1085, y: 346, s: 0.82, kind: 'warehouse' },
  ],
  paint(g, R, world) {
    const cfg = CITY.china, out = keepOut(cfg);
    // lucht-achtige achtergrond: bergen in lagen met nevel
    g.fillStyle = LG(g, 0, 0, 0, 230, ['#6a4a78', '#c87a7a', '#f0a878']); g.fillRect(0, 0, W, 240);
    const ridge = (y0, amp, col, seed, a) => { const r = RNG(seed); g.fillStyle = col; g.beginPath(); g.moveTo(0, 260); let y = y0; for (let x = 0; x <= W; x += 20) { y = y0 + Math.sin(x * 0.006 + seed) * amp + Math.sin(x * 0.017 + seed * 2) * amp * 0.45 + (r() - 0.5) * 6; g.lineTo(x, y); } g.lineTo(W, 260); g.closePath(); g.globalAlpha = a; g.fill(); g.globalAlpha = 1; };
    ridge(120, 36, '#7a6a8a', 3, 0.9); ridge(150, 30, '#5f5a78', 5, 0.95); ridge(178, 22, '#4a4a66', 8, 1);
    for (const [x, y, hh] of [[300, 128, 40], [980, 138, 34], [640, 150, 28]]) { g.fillStyle = 'rgba(40,30,50,.8)'; for (let k = 0; k < 4; k++) { const w = 26 - k * 5; pagodaMini(g, x, y - k * hh / 4, w); } }
    g.fillStyle = LG(g, 0, 150, 0, 240, ['rgba(255,200,170,0)', 'rgba(255,190,160,.55)']); g.fillRect(0, 150, W, 90);
    // stad: stenen vloer
    g.fillStyle = '#8a8084'; g.fillRect(0, 232, W, H - 232); cobble(g, R, 0, 232, W, H - 232, '#8e8488', 11);
    for (let i = 0; i < 60; i++) glowBlob(g, R() * W, 240 + R() * 480, 40 + R() * 80, R() < 0.5 ? '#000' : '#ffd8b0', 0.07);
    // verre daken (rij huisjes)
    for (let x = -10; x < W; x += 34) { const hh = 14 + R() * 12; g.fillStyle = '#3a3640'; g.fillRect(x, 236 - hh, 28, hh + 4); g.fillStyle = '#5a5a66'; g.beginPath(); g.moveTo(x - 4, 236 - hh); g.lineTo(x + 14, 226 - hh); g.lineTo(x + 32, 236 - hh); g.fill(); if (R() < 0.5) { g.fillStyle = 'rgba(255,200,100,.7)'; g.fillRect(x + 8 + R() * 8, 240 - hh * 0.6, 4, 5); } }
    // hoofdstraat (tussen beide rijen)
    paintAsphalt(g, R, 0, 438, W, 90, '#55555c'); g.fillStyle = '#b8a890'; g.fillRect(0, 430, W, 8); g.fillRect(0, 528, W, 8); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(0, 436, W, 3); dashLine(g, 0, 483, W, 483, '#f0d878', 3, [30, 22]);
    zebra(g, 300, 438, 50, 90, false); zebra(g, 800, 438, 50, 90, false);
    // markt-pleintjes met rode tegels
    for (const [x, y, w, h] of [[20, 560, 220, 130], [560, 560, 140, 130]]) { g.fillStyle = '#9a4a3a'; g.fillRect(x, y, w, h); for (let yy = y; yy < y + h; yy += 12) for (let xx = x; xx < x + w; xx += 12) { g.fillStyle = (((xx - x) / 12 + (yy - y) / 12) % 2) ? 'rgba(0,0,0,.1)' : 'rgba(255,255,255,.07)'; g.fillRect(xx, yy, 12, 12); } g.strokeStyle = '#5a2a20'; g.lineWidth = 3; g.strokeRect(x, y, w, h); }
    // marktkraampjes met parasol
    for (const [x, y, c] of [[60, 600, '#e8342a'], [130, 640, '#f0c030'], [190, 598, '#2a9a6a'], [600, 610, '#e8342a'], [660, 650, '#f0c030']]) { g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x + 8, y + 8, 22, 6, 0, 0, TAU); g.fill(); g.fillStyle = '#6a4a2a'; g.fillRect(x - 14, y - 6, 28, 10); for (let k = 0; k < 5; k++) { g.fillStyle = ['#e8342a', '#ffd23a', '#7ac040', '#ff8a2a', '#c070ff'][(k + x) % 5]; g.beginPath(); g.arc(x - 10 + k * 5, y - 8, 3, 0, TAU); g.fill(); } g.fillStyle = c; g.beginPath(); g.moveTo(x - 20, y - 10); g.quadraticCurveTo(x, y - 40, x + 20, y - 10); g.closePath(); g.fill(); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1; g.stroke(); g.fillStyle = 'rgba(255,255,255,.2)'; g.beginPath(); g.moveTo(x - 20, y - 10); g.quadraticCurveTo(x - 8, y - 30, x, y - 10); g.fill(); }
    // magazijnterrein (asfalt) rechts
    paintAsphalt(g, R, 936, 360, 344, 190, '#4a4d54'); for (let k = 0; k < 6; k++) { g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(950 + k * 54, 480, 3, 54); } dashLine(g, 936, 470, 1280, 470, '#f0d878', 3, [24, 16]);
    for (let i = 0; i < 5; i++) { const x = 960 + i * 62; g.fillStyle = '#e8702a'; g.beginPath(); g.moveTo(x, 548); g.lineTo(x + 7, 548); g.lineTo(x + 3.5, 534); g.fill(); }
    g.fillStyle = '#c8a040'; g.fillRect(936, 548, 344, 6); g.fillStyle = '#2a2a30'; for (let x = 936; x < 1280; x += 16) g.fillRect(x, 548, 8, 6);
    // pagodes en grote bomen
    pagodaMini(g, 90, 330, 56, true); pagodaMini(g, 90, 300, 44, true); pagodaMini(g, 90, 272, 32, true);
    const trees = []; for (const [x, y, k, s] of [[30, 420, 'blossom', 1.0], [560, 428, 'blossom', 0.8], [350, 252, 'blossom', 0.8], [880, 266, 'oak', 0.8], [880, 430, 'blossom', 0.7], [20, 690, 'blossom', 1.0], [1252, 690, 'oak', 1.0], [1260, 580, 'blossom', 0.9], [440, 276, 'oak', 0.75]]) trees.push([x, y, k, s]);
    const TR = RNG(55); for (const [x, y, k, s] of trees) tree(g, x, y, s, k === 'blossom' ? 'oak' : 'oak', TR, k === 'blossom' ? 'pink' : '#6a9a3a');
    // bamboe
    for (const bx of [40, 1250, 590]) for (let k = 0; k < 9; k++) { g.strokeStyle = k % 2 ? '#6aa040' : '#8ab850'; g.lineWidth = 3; const x = bx + k * 5, y = (bx > 500 && bx < 700 ? 540 : 700) - (k % 3) * 4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (k - 4) * 1.5, y - 50 - (k % 4) * 12); g.stroke(); }
    // lantaarnpalen + touwen met lantaarns
    for (const x of [20, 330, 560, 790, 1000, 1260]) { pole(g, x, 436, 60, '#3a1a14'); g.fillStyle = '#7a1a14'; g.fillRect(x - 5, 378, 10, 4); }
    lanternString(world, 20, 380, 330, 384, 14, 8, ['#e8342a', '#f0a020'], 0); lanternString(world, 330, 384, 560, 380, 12, 6, ['#e8342a', '#f0a020', '#e8342a'], 1); lanternString(world, 560, 380, 790, 384, 14, 6, ['#f0a020', '#e8342a'], 2); lanternString(world, 790, 384, 1000, 380, 12, 5, ['#e8342a', '#f0a020'], 3); lanternString(world, 20, 536, 330, 540, 14, 8, ['#e8342a', '#f0a020'], 4);
    // verkeer en mensen
    const carCols = ['#c8302a', '#2a6ac0', '#e8e8e0', '#2a2a30', '#f0c030', '#3a8a5a', '#e07a2a'];
    for (let i = 0; i < 5; i++) { const lane = i % 2, v = (46 + R() * 34) * (lane ? -1 : 1), o = R() * (W + 200), cc = carCols[(i * 2) % carCols.length], y = lane ? 508 : 462; world.actors.push({ y: () => y, draw: (g2, t) => { const x = (((o + v * t) % (W + 240)) + W + 240) % (W + 240) - 120; drawCar(g2, x, y, v > 0 ? 1 : -1, cc, i === 2 ? 'van' : 'car', 1); } }); }
    for (let i = 0; i < 4; i++) { const v = (40 + R() * 30) * (i % 2 ? -1 : 1), o = R() * W * 1.2, y = 495 + (i % 2) * 14; world.actors.push({ y: () => y + 4, draw: (g2, t) => { const x = (((o + v * t) % (W + 100)) + W + 100) % (W + 100) - 50; drawBike(g2, x, y + 4, v > 0 ? 1 : -1, t, ['#e07a2a', '#8a3ac0', '#2a8a5a', '#c02828'][i]); } }); }
    walkerPath(world, [[0, 440], [330, 442], [800, 441], [1280, 440]], 6, ['#c83a3a', '#e0a020', '#3a6ac0', '#2a2a30', '#e8e0d0', '#3a9a5a'], (g2, x, y, dir, t, c, c2) => drawWalker(g2, x, y, dir, t, c, R() < 0 ? null : c2 === '#c83a3a' ? '#e8342a' : null), 26);
    walkerPath(world, [[20, 650], [220, 652], [700, 648]], 4, ['#c83a3a', '#e0a020', '#3a6ac0', '#8a3ac0'], (g2, x, y, dir, t, c, c2) => drawWalker(g2, x, y, dir, t, c, null), 18);
    // vrachtwagen op het terrein
    const tv = 24; world.actors.push({ y: () => 500, draw: (g2, t) => { const u = (t * tv) % 640; const x = 1270 - (u < 320 ? u : 640 - u), dir = u < 320 ? -1 : 1; g2.save(); g2.translate(x, 500); g2.scale(1.35, 1.35); g2.translate(-x, -500); drawCar(g2, x, 500, dir, '#e8e8e0', 'bus', 1); g2.restore(); } });
    birdsFlock(world, 4, 100, 250, 26); cloudShadows(world, 3, 0.1);
  },
  paintFront(g, R, world) { for (const [x, y, k, s] of [[22, 716, 'oak', 1.1], [1256, 716, 'oak', 1.1]]) tree(g, x, y, s, k, R, k === 'oak' && x < 100 ? 'pink' : '#5a8a3a'); },
};
function pagodaMini(g, x, y, w, solid) { g.save(); g.translate(x, y); g.fillStyle = solid ? '#7a1a14' : 'rgba(40,30,50,.8)'; g.fillRect(-w * 0.3, -w * 0.3, w * 0.6, w * 0.3); g.fillStyle = solid ? '#3a3a44' : 'rgba(40,30,50,.8)'; g.beginPath(); g.moveTo(-w * 0.55, -w * 0.3); g.quadraticCurveTo(-w * 0.2, -w * 0.26, 0, -w * 0.4); g.quadraticCurveTo(w * 0.2, -w * 0.26, w * 0.55, -w * 0.3); g.lineTo(w * 0.3, -w * 0.36); g.lineTo(-w * 0.3, -w * 0.36); g.fill(); g.restore(); }

CITY.hq = {
  night: 1, vig: 0.62, wash: ['rgba(8,16,60,.42)', 'rgba(20,30,80,.22)'], spriteTint: 'rgba(30,50,120,.18)',
  slots: [
    { x: 205, y: 346, s: 0.78, kind: 'hq' }, { x: 440, y: 598, s: 0.95, kind: 'house' }, { x: 668, y: 346, s: 0.92, kind: 'police' },
    { x: 905, y: 598, s: 0.95, kind: 'atelier' }, { x: 1090, y: 346, s: 0.88, kind: 'bankchina' },
  ],
  paint(g, R, world) {
    const cfg = CITY.hq, out = keepOut(cfg);
    // nachthemel met skyline
    g.fillStyle = LG(g, 0, 0, 0, 260, ['#0a1030', '#1a2860', '#3a4a88']); g.fillRect(0, 0, W, 270);
    for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(255,255,255,${0.2 + R() * 0.5})`; g.fillRect(R() * W, R() * 120, 1.4, 1.4); }
    const towers = []; for (let x = -20; x < W; x += 30 + R() * 36) { const w = 34 + R() * 40, hh = 70 + R() * 130; towers.push([x, w, hh]); }
    for (const [x, w, hh] of towers) { const col = ['#141c3c', '#1a2448', '#101834'][Math.abs(x | 0) % 3]; g.fillStyle = LG(g, x, 250 - hh, x + w, 250, [lite(col, 0.1), col]); g.fillRect(x, 250 - hh, w, hh + 24); g.fillStyle = 'rgba(120,160,255,.08)'; g.fillRect(x + w - 5, 250 - hh, 5, hh); for (let yy = 250 - hh + 6; yy < 262; yy += 8) for (let xx = x + 4; xx < x + w - 4; xx += 7) if (R() < 0.42) { g.fillStyle = R() < 0.8 ? 'rgba(255,224,140,.85)' : 'rgba(150,220,255,.8)'; g.fillRect(xx, yy, 3.5, 4.5); } if (R() < 0.3) { g.fillStyle = '#2a3458'; g.fillRect(x + w / 2 - 1, 250 - hh - 16, 2, 16); } }
    g.fillStyle = LG(g, 0, 190, 0, 270, ['rgba(120,100,200,0)', 'rgba(200,130,160,.28)']); g.fillRect(0, 190, W, 80);
    // grond: beton en asfalt
    g.fillStyle = '#2a2e3c'; g.fillRect(0, 250, W, H - 250); cobble(g, R, 0, 262, W, H - 262, '#343848', 14);
    for (let i = 0; i < 40; i++) glowBlob(g, R() * W, 270 + R() * 450, 50 + R() * 80, '#000', 0.12);
    // dwarsstraten (verticaal) boven de rij
    for (const x of [430, 925]) { paintAsphalt(g, R, x - 36, 262, 72, 190, '#2e3138'); g.fillStyle = '#5a5e70'; g.fillRect(x - 40, 262, 5, 190); g.fillRect(x + 35, 262, 5, 190); dashLine(g, x, 262, x, 450, '#e8e0b0', 2.5, [18, 14]); }
    // hoofdlaan
    paintAsphalt(g, R, 0, 450, W, 96, '#2e3138'); g.fillStyle = '#6a6e80'; g.fillRect(0, 442, W, 8); g.fillRect(0, 546, W, 8); g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(0, 450, W, 3);
    g.save(); g.strokeStyle = '#e8c850'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(0, 496); g.lineTo(W, 496); g.moveTo(0, 501); g.lineTo(W, 501); g.stroke(); g.restore(); dashLine(g, 0, 473, W, 473, '#d8d8e0', 2.5, [24, 20]); dashLine(g, 0, 526, W, 526, '#d8d8e0', 2.5, [24, 20]);
    zebra(g, 330, 450, 46, 96, false); zebra(g, 840, 450, 46, 96, false);
    // plassen met weerspiegeling van neon
    for (let i = 0; i < 10; i++) { const x = R() * W, y = 456 + R() * 84; g.fillStyle = `rgba(${R() < 0.5 ? '255,120,160' : '120,200,255'},.1)`; g.beginPath(); g.ellipse(x, y, 20 + R() * 40, 3 + R() * 4, 0, 0, TAU); g.fill(); }
    // zuidelijk plein / voetpad
    g.fillStyle = '#3a3e50'; g.fillRect(0, 554, W, 166); cobble(g, R, 0, 554, W, 166, '#3a3e50', 16); for (let i = 0; i < 20; i++) glowBlob(g, R() * W, 560 + R() * 150, 60, '#000', 0.12);
    // gras / hagen
    for (const [x, y, w, h] of [[10, 570, 200, 60], [1070, 574, 200, 60], [640, 640, 150, 50]]) { paintGrass(g, R, x, y, x + w, y + h, '#25503a', ['#2f6a45', '#1f4a32', '#38784c']); g.strokeStyle = '#6a6e80'; g.lineWidth = 3; g.strokeRect(x, y, w, h); }
    // lichtmasten
    const lp = [[120, 560], [330, 556], [560, 560], [790, 556], [1010, 560], [1200, 556], [90, 448], [560, 448], [1010, 448], [330, 258], [790, 258]];
    for (const [x, y] of lp) { lamppost(g, x, y, 1.0, 1); world.lights.push({ x, y: y - 72, r: 90, c: '#ffd890', a: 0.42, fl: 0.12, ph: R() * 9 }); }
    // verkeerslichten
    for (const [x, y] of [[326, 452], [880, 548]]) { g.fillStyle = '#16181e'; g.fillRect(x - 2, y - 44, 4, 44); g.fillRect(x - 6, y - 64, 12, 22); } 
    world.front.push((g2, t) => { for (const [x, y] of [[326, 452], [880, 548]]) { const ph = Math.floor(t / 2.5 + x) % 3; for (let k = 0; k < 3; k++) { g2.fillStyle = k === ph ? ['#ff3030', '#ffb030', '#30ff60'][k] : '#2a2a30'; g2.beginPath(); g2.arc(x, y - 60 + k * 7, 2.6, 0, TAU); g2.fill(); } g2.save(); g2.globalCompositeOperation = 'lighter'; glowBlob(g2, x, y - 60 + ph * 7, 16, ['#ff3030', '#ffb030', '#30ff60'][ph], 0.7); g2.restore(); } });
    // bomen langs de laan
    const TR = RNG(31); for (const [x, y] of [[250, 556], [700, 560], [1160, 556], [60, 440], [480, 262], [880, 440]]) tree(g, x, y, 0.8, 'oak', TR, '#2a6a44');
    // verkeer met koplampen
    const carCols = ['#c8302a', '#2a6ac0', '#e8e8e0', '#2a2a30', '#f0c030', '#3a8a5a', '#e07a2a', '#8a3ac0'];
    for (let i = 0; i < 8; i++) { const lane = i % 2, v = (70 + R() * 50) * (lane ? -1 : 1), o = R() * (W + 200), cc = carCols[i % carCols.length], y = lane ? 520 : 468, kind = i === 3 ? 'bus' : i === 5 ? 'van' : 'car'; world.actors.push({ y: () => y, draw: (g2, t) => { const x = (((o + v * t) % (W + 240)) + W + 240) % (W + 240) - 120; drawCar(g2, x, y, v > 0 ? 1 : -1, cc, kind, 1); } }); }
    // voetgangers
    walkerPath(world, [[0, 570], [500, 572], [1000, 570], [1280, 574]], 5, ['#4a4a60', '#3a3a50', '#6a3a4a', '#2a4a5a', '#6a6a7a'], (g2, x, y, dir, t, c) => drawWalker(g2, x, y, dir, t, c, null), 22);
    walkerPath(world, [[0, 444], [600, 446], [1280, 444]], 3, ['#4a4a60', '#6a3a4a', '#2a4a5a'], (g2, x, y, dir, t, c) => drawWalker(g2, x, y, dir, t, c, null), 20);
    // zoeklicht-bundel (politie) en vliegende drone-lampjes
    world.front.push((g2, t) => { g2.save(); g2.globalCompositeOperation = 'lighter'; const a = Math.sin(t * 0.5) * 0.7; g2.fillStyle = LG(g2, 640, 110, 640 + Math.sin(a) * 400, 400, ['rgba(180,210,255,.0)', 'rgba(180,210,255,.07)']); g2.beginPath(); g2.moveTo(630, 100); g2.lineTo(650, 100); g2.lineTo(640 + Math.sin(a) * 400 + 60, 420); g2.lineTo(640 + Math.sin(a) * 400 - 60, 420); g2.fill(); g2.restore(); });
    world.front.push((g2, t) => { for (let i = 0; i < 30; i++) { const x = (i * 197 + 40) % W, y = 40 + (i * 53) % 200, a = 0.5 + Math.sin(t * 2 + i) * 0.5; if (a < 0.6) continue; } });
    cloudShadows(world, 2, 0.12);
  },
  paintFront(g, R, world) { const TR = R; for (const [x, y] of [[26, 716], [1254, 716]]) tree(g, x, y, 1.05, 'oak', TR, '#2a6a44'); },
};

CITY.island = {
  night: 0.35, vig: 0.45, wash: ['rgba(255,110,60,.18)', 'rgba(120,60,140,.12)'], spriteTint: 'rgba(255,140,80,.07)',
  slots: [
    { x: 250, y: 346, s: 0.95, kind: 'wreck' }, { x: 440, y: 598, s: 0.95, kind: 'resort' }, { x: 905, y: 598, s: 0.86, kind: 'ship' },
    { x: 668, y: 346, s: 0.9, kind: 'tower' }, { x: 1085, y: 346, s: 0.88, kind: 'castle' },
  ],
  paint(g, R, world) {
    const cfg = CITY.island, out = keepOut(cfg);
    // zee
    g.fillStyle = LG(g, 0, 0, 0, H, ['#1f5a98', '#2a8ac0', '#38b0d0']); g.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) { glowBlob(g, R() * W, R() * H, 40 + R() * 90, R() < 0.5 ? '#68e0e8' : '#1a4a88', 0.1); }
    // eiland-vorm
    const pts = [[78, 138], [260, 108], [520, 102], [800, 100], [1060, 106], [1215, 140], [1230, 330], [1208, 560], [1120, 640], [1088, 598], [1052, 560], [990, 540], [900, 534], [800, 548], [756, 600], [742, 660], [620, 690], [420, 696], [220, 680], [104, 630], [58, 500], [50, 300]];
    const coast = curveSample(pts.concat([pts[0], pts[1]]), 6).slice(0); coast.pop();
    const land = polyPath(coast), landStroke = coast;
    // ondiep water langs de kust
    g.save(); g.lineJoin = 'round'; strokeClosed(g, coast, 90, 'rgba(110,230,230,.25)'); strokeClosed(g, coast, 62, 'rgba(140,240,235,.3)'); strokeClosed(g, coast, 36, 'rgba(180,250,240,.35)'); g.restore();
    // land: zand rand, dan gras/jungle
    g.save(); g.fillStyle = '#e6cf94'; g.fill(land); strokeClosed(g, coast, 8, '#cdb374'); g.clip(land);
    g.fillStyle = '#e8d49c'; g.fillRect(0, 0, W, H);
    // beschaduwde binnenkant: jungle- en grasgrond
    const inner = polyPath(offsetPoly(coast, 28, 640, 400)); g.fillStyle = '#d8c488'; g.fill(inner); g.restore();
    g.save(); g.clip(polyPath(offsetPoly(coast, 34, 640, 400))); paintGrass(g, R, 0, 0, W, H, '#4a9a3a', ['#5aaa44', '#3a8a30', '#6ac050', '#2f7a2c', '#78c85a']);
    // jungle-donker links, heuvel rechts
    for (let i = 0; i < 26; i++) glowBlob(g, 40 + R() * 420, 100 + R() * 420, 70 + R() * 90, '#0a3a1a', 0.3);
    for (let i = 0; i < 18; i++) glowBlob(g, 900 + R() * 300, 100 + R() * 240, 60 + R() * 80, '#9ac860', 0.18);
    // heuvel van het kasteel
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(1110, 396, 210, 56, 0, 0, TAU); g.fill();
    g.fillStyle = LG(g, 0, 290, 0, 400, ['#7a9a50', '#5a7a3a', '#4a6030']); g.beginPath(); g.ellipse(1085, 378, 200, 58, 0, 0, TAU); g.fill(); g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 2; g.stroke();
    g.fillStyle = 'rgba(255,255,255,.1)'; g.beginPath(); g.ellipse(1050, 360, 120, 28, 0, 0, TAU); g.fill();
    // startbaan van het vliegveld
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(498, 474, 330, 50); g.fillStyle = '#44464e'; g.fillRect(494, 468, 330, 50); paintAsphalt(g, R, 494, 468, 330, 50, '#4a4c54'); dashLine(g, 508, 493, 812, 493, '#f0f0e8', 3, [28, 20]); g.fillStyle = '#f0f0e8'; for (let k = 0; k < 5; k++) { g.fillRect(500, 472 + k * 9, 20, 4); g.fillRect(798, 472 + k * 9, 20, 4); }
    g.fillStyle = '#d8d8d0'; g.fillRect(494, 466, 330, 3); g.fillRect(494, 518, 330, 3);
    for (let x = 520; x < 800; x += 56) { g.fillStyle = '#ffd860'; g.beginPath(); g.arc(x, 523, 2.2, 0, TAU); g.fill(); }
    paintAsphalt(g, R, 590, 430, 160, 38, '#50525a'); // opstelplaats
    // pad van de jungle naar de kade en strand
    const trail = curveSample([[205, 400], [320, 470], [440, 560], [520, 640], [610, 600], [760, 540]], 6); strokePoly(g, trail, 24, 'rgba(120,90,50,.5)'); strokePoly(g, trail, 18, '#c8a468'); strokePoly(g, trail, 8, 'rgba(255,240,200,.25)');
    g.restore();
    // strand rond het hotel: palmen, parasols zit in de sprite
    g.fillStyle = 'rgba(255,255,255,.12)'; for (let i = 0; i < 12; i++) { g.beginPath(); g.ellipse(180 + R() * 500, 640 + R() * 30, 30 + R() * 40, 4, 0, 0, TAU); g.fill(); }
    // kade/haven: houten pier en water-rimpels in de baai
    g.fillStyle = 'rgba(0,30,60,.25)'; g.beginPath(); g.ellipse(905, 640, 170, 70, 0, 0, TAU); g.fill();
    // bomen: jungle links, palmen overal, kasteelomgeving kaal
    const TR = RNG(404); const trees = [];
    for (let i = 0; i < 46; i++) { const x = 60 + TR() * 460, y = 120 + TR() * 400; if (out(x, y, 12)) continue; trees.push([x, y, TR() < 0.5 ? 'palm' : 'oak', 0.6 + TR() * 0.6, TR() < 0.5 ? '#1f6a34' : '#2f8a3a']); }
    for (let i = 0; i < 22; i++) { const x = 560 + TR() * 520, y = 120 + TR() * 240; if (out(x, y, 12) || (x > 880 && y > 250)) continue; trees.push([x, y, 'palm', 0.6 + TR() * 0.4]); }
    for (const [x, y] of [[140, 664], [300, 676], [560, 678], [700, 660], [90, 600], [1160, 620], [1190, 500], [1180, 250], [840, 520], [1010, 520]]) trees.push([x, y, 'palm', 0.9 + TR() * 0.3]);
    trees.sort((a, b) => a[1] - b[1]); for (const [x, y, k, s, c] of trees) tree(g, x, y, s, k, TR, c);
    // varens en bloemen in de jungle
    for (let i = 0; i < 60; i++) { const x = 70 + R() * 440, y = 140 + R() * 380; if (out(x, y, 6)) continue; g.strokeStyle = '#2a7a3a'; g.lineWidth = 2; for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (k - 2) * 8, y - 10, x + (k - 2) * 12, y + 2); g.stroke(); } }
    flowers(g, R, 100, 150, 400, 340, 40, ['#ff5a8a', '#ffd23a', '#ff8a3a']);
    // golven en schuim (dynamisch), glinsteringen
    const seaPath = new Path2D(); seaPath.rect(0, 0, W, H); const gl = []; for (let i = 0; i < 200; i++) { const x = R() * W, y = 90 + R() * 640; if (!g.isPointInPath(land, x, y)) gl.push({ x, y, w: 8 + R() * 18, ph: R() * 9, sp: 1 + R() * 1.6 }); } glintsDraw(world, gl, '#fff');
    const cp = new Path2D(); coast.forEach((p, i) => (i ? cp.lineTo(p[0], p[1]) : cp.moveTo(p[0], p[1]))); cp.closePath();
    world.back.push((g2, t) => { g2.save(); g2.lineJoin = 'round'; for (let k = 0; k < 3; k++) { const ph = (t * 0.35 + k / 3) % 1; g2.strokeStyle = `rgba(255,255,255,${0.5 * (1 - ph)})`; g2.lineWidth = 2 + (1 - ph) * 3; g2.setLineDash([26, 14]); g2.lineDashOffset = -t * 12 - k * 9; g2.save(); g2.translate(640, 400); const sc = 1 + ph * 0.045 + 0.003; g2.scale(sc, sc); g2.translate(-640, -400); g2.stroke(cp); g2.restore(); } g2.setLineDash([]); g2.restore(); });
    // zeilbootje en meeuwen
    world.actors.push({ y: () => 560, draw: (g2, t) => { const x = 18 + Math.sin(t * 0.2) * 8, y = 580 + Math.sin(t * 0.8) * 2; g2.save(); g2.translate(x, y); g2.fillStyle = '#f4f4ee'; g2.beginPath(); g2.moveTo(0, -42); g2.lineTo(18, -6); g2.lineTo(0, -6); g2.fill(); g2.fillStyle = '#e8c860'; g2.beginPath(); g2.moveTo(-3, -34); g2.lineTo(-14, -6); g2.lineTo(-3, -6); g2.fill(); g2.fillStyle = '#8a3a2a'; g2.beginPath(); g2.moveTo(-18, -4); g2.lineTo(22, -4); g2.lineTo(14, 4); g2.lineTo(-12, 4); g2.fill(); g2.restore(); } });
    birdsFlock(world, 7, 100, 560, 34); cloudShadows(world, 4, 0.12);
    // vliegtuig dat over de startbaan taxiet
    world.actors.push({ y: () => 506, draw: (g2, t) => { const u = (t * 0.045) % 1, x = 520 + u * 250; g2.save(); g2.translate(x, 500); softShadow(g2, 4, 8, 42, 5, 0.3); g2.fillStyle = LG(g2, 0, -14, 0, 8, ['#fff', '#c8ced8']); g2.beginPath(); g2.moveTo(-34, -4); g2.quadraticCurveTo(-34, -12, -20, -12); g2.lineTo(26, -12); g2.quadraticCurveTo(42, -10, 44, -2); g2.quadraticCurveTo(40, 6, 20, 6); g2.lineTo(-24, 6); g2.closePath(); g2.fill(); g2.strokeStyle = 'rgba(0,0,0,.4)'; g2.lineWidth = 1; g2.stroke(); g2.fillStyle = '#d83a2a'; g2.fillRect(-30, -4, 70, 2.4); g2.fillStyle = '#8ac8e8'; g2.fillRect(30, -9, 8, 4); g2.fillStyle = '#c8ced8'; g2.beginPath(); g2.moveTo(-4, -10); g2.lineTo(8, -10); g2.lineTo(2, -30); g2.lineTo(-10, -30); g2.fill(); g2.beginPath(); g2.moveTo(-34, -10); g2.lineTo(-26, -10); g2.lineTo(-34, -26); g2.fill(); g2.fillStyle = '#15171b'; g2.beginPath(); g2.arc(-8, 8, 3, 0, TAU); g2.arc(24, 8, 3, 0, TAU); g2.fill(); g2.restore(); } });
  },
  paintFront(g, R, world) { const TR = R; for (const [x, y, s] of [[34, 700, 1.3], [1250, 690, 1.25], [640, 716, 1.0], [210, 716, 1.0]]) tree(g, x, y, s, 'palm', TR); },
};
function strokeClosed(g, poly, w, style) { g.beginPath(); poly.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.lineWidth = w; g.strokeStyle = style; g.stroke(); }
function offsetPoly(poly, d, cx, cy) { return poly.map((p) => { const dx = p[0] - cx, dy = p[1] - cy, l = Math.hypot(dx, dy) || 1; return [p[0] - dx / l * d, p[1] - dy / l * d]; }); }

for (const k in CITY) for (const sd of CITY[k].slots) sd.s *= (sd.kind === 'hq' ? 1.06 : 1.1);

// ================================================================ de kaart zelf
const glowCache = new Map();
function glowSprite(col) { if (glowCache.has(col)) return glowCache.get(col); const c = mk(96, 96), g = c.getContext('2d'); g.fillStyle = RG(g, 48, 48, 0, 48, [rgba(col, 1), rgba(col, 0.35), rgba(col, 0)]); g.fillRect(0, 0, 96, 96); glowCache.set(col, c); return c; }
function smokeAt(g, x, y, t, o = {}) {
  const n = o.n || 6, rise = o.rise || 46, col = o.col || '#e8e8ee';
  for (let i = 0; i < n; i++) { const ph = (t * (o.sp || 0.32) + i / n + (o.seed || 0)) % 1; const px = x + Math.sin(ph * 6 + i) * 4 + ph * (o.drift ?? 12), py = y - ph * rise; g.fillStyle = rgba(col, (1 - ph) * (o.a ?? 0.5) * Math.min(1, ph * 6)); g.beginPath(); g.arc(px, py, 2.5 + ph * (o.grow ?? 9), 0, TAU); g.fill(); }
}
const wrapText = (g, text, maxW) => { const words = text.split(' '), lines = []; let cur = ''; for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; } if (cur) lines.push(cur); return lines; };
const ease = (t) => t * t * (3 - 2 * t);

export function createCityMap(canvas, opts = {}) {
  const ctx = canvas.getContext('2d');
  const sfx = (n) => { try { opts.sfx && opts.sfx(n); } catch (e) { /* geen geluid */ } };
  const getSt = (n) => { try { return (opts.getState && opts.getState(n)) || {}; } catch (e) { return {}; } };
  let ch = clamp(opts.chapter | 0, 0, CHAPTERS.length - 1), alive = true, raf = 0, last = performance.now() / 1000, T = 0;
  let kx = 1, ky = 1; const caches = new Map();
  let st = [], stT = -9; // levelstanden van dit hoofdstuk
  let hover = null, sel = 0, kbd = false, press = null, tip = null, tipT = -9, shake = { k: '', t: -9 }, mouse = { x: 640, y: 360 };
  let walk = null, snap = null, snapT = -9;
  const teun = { x: 0, y: 0, face: 1, idx: -1, alpha: 1, mv: null, ch: -1 };
  const chapterOpen = (i) => i <= 0 || !!getSt(CHAPTERS[i - 1].levels[CHAPTERS[i - 1].levels.length - 1]).done;
  const lvl = (i) => CHAPTERS[ch].levels[i];

  function layers(c) {
    const city = CHAPTERS[c].city; let L = caches.get(c);
    if (L && L.w === canvas.width && L.h === canvas.height) return L;
    L = buildCity(city, canvas.width, canvas.height, c); L.w = canvas.width; L.h = canvas.height; caches.set(c, L); return L;
  }
  function readState() {
    const open = chapterOpen(ch);
    st = CHAPTERS[ch].levels.map((n) => { const s = getSt(n); return { unlocked: open && !!s.unlocked, done: !!s.done, stars: clamp(s.stars | 0, 0, 3) }; });
    stT = T;
  }
  const spot = (L, i) => { const sl = L.slots[i]; return { x: sl.x + sl.hw * sl.s * 0.72 + 14, y: sl.y + 14 }; };
  function targetIdx() { if (!chapterOpen(ch)) return 0; for (let i = 0; i < 5; i++) if (st[i].unlocked && !st[i].done) return i; return st.some((s) => s.done) ? 4 : 0; }
  function placeTeun(instant) {
    const L = layers(ch), idx = targetIdx(), p = spot(L, idx);
    if (instant || teun.ch !== ch || teun.idx < 0) { teun.x = p.x; teun.y = p.y; teun.mv = null; teun.alpha = 1; teun.face = -1; }
    else if (teun.idx !== idx) teun.mv = { x: p.x, y: p.y };
    teun.idx = idx; teun.ch = ch; sel = idx;
  }
  function resizeCanvasSizes() { kx = canvas.width / W; ky = canvas.height / H; }
  resizeCanvasSizes(); readState(); placeTeun(true);

  // ------------------------------------------------ invoer
  function toLogical(e) { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / (r.width || 1) * W, y: (e.clientY - r.top) / (r.height || 1) * H }; }
  function arrowPos(dir) { return { x: dir < 0 ? 46 : W - 46, y: 372 }; }
  function dotPos(i) { return { x: W / 2 + (i - 2) * 38, y: 708 }; }
  function hitTest(p) {
    const L = layers(ch);
    for (const d of [-1, 1]) { const ci = ch + d; if (ci < 0 || ci >= CHAPTERS.length) continue; const a = arrowPos(d); if (Math.hypot(p.x - a.x, p.y - a.y) < 42) return { k: 'arrow', d, i: ci }; }
    for (let i = 0; i < 5; i++) { const q = dotPos(i); if (Math.hypot(p.x - q.x, p.y - q.y) < 17) return { k: 'dot', i }; }
    const order = [0, 1, 2, 3, 4].sort((a, b) => L.slots[b].y - L.slots[a].y);
    for (const i of order) {
      const sl = L.slots[i], pl = L.plates[i];
      if (p.x > sl.x - sl.hw * sl.s && p.x < sl.x + sl.hw * sl.s && p.y > sl.y - sl.up * sl.s && p.y < sl.y + 12) return { k: 'b', i };
      if (p.x > sl.x - pl.w / 2 && p.x < sl.x + pl.w / 2 && p.y >= sl.y + 8 && p.y < sl.y + 24 + pl.h) return { k: 'b', i };
    }
    return null;
  }
  const same = (a, b) => (!a && !b) || (a && b && a.k === b.k && a.i === b.i);
  function setHover(h) { if (same(h, hover)) return; hover = h; if (h) { tipT = T; sfx('hover'); } canvas.style.cursor = h ? 'pointer' : ''; }
  function onMove(e) { if (walk) return; const p = toLogical(e); mouse = p; kbd = false; setHover(hitTest(p)); }
  function onDown(e) { if (walk) return; const p = toLogical(e); mouse = p; kbd = false; const h = hitTest(p); press = h; setHover(h); if (h && e.pointerType === 'touch') tipT = T; }
  function onUp(e) { if (walk) { press = null; return; } const p = toLogical(e); const h = hitTest(p); const pr = press; press = null; if (e.pointerType === 'touch' || e.pointerType === 'pen') { if (!h) setHover(null); } if (h && pr && same(h, pr)) activate(h); }
  function onLeave() { if (!walk) setHover(null); }
  function activate(h) {
    if (h.k === 'b') pickBuilding(h.i);
    else if (h.k === 'arrow' || h.k === 'dot') { if (h.i === ch) return; if (!chapterOpen(h.i)) { shake = { k: h.k + h.i, t: T }; tip = { text: 'Haal eerst het vorige hoofdstuk', until: T + 2 }; tipT = T; return; } sfx('click'); try { opts.onChapter && opts.onChapter(h.i); } catch (e) { console.error(e); } }
  }
  function pickBuilding(i) {
    if (walk) return; readState();
    if (!st[i].unlocked) { shake = { k: 'b' + i, t: T }; tip = { text: chapterOpen(ch) ? 'Haal eerst het vorige level' : 'Haal eerst het vorige hoofdstuk', until: T + 2, i }; tipT = T; return; }
    sfx('click'); const L = layers(ch), sl = L.slots[i];
    walk = { i, t0: T, dur: 0.7, fx: teun.x, fy: teun.y, tx: sl.x + 6, ty: sl.y - 2, done: false };
    teun.mv = null; teun.face = walk.tx >= walk.fx ? 1 : -1; hover = { k: 'b', i }; canvas.style.cursor = '';
  }
  function onKey(e) {
    if (!alive || walk || e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'ArrowRight') { kbd = true; sel = clamp(sel + (k === 'ArrowLeft' ? -1 : 1), 0, 4); hover = null; tipT = T; sfx('hover'); e.preventDefault(); }
    else if (k === 'Enter' || k === ' ') { kbd = true; pickBuilding(sel); e.preventDefault(); }
    else if (k === 'PageUp' || k === 'PageDown') { const i = ch + (k === 'PageUp' ? -1 : 1); if (i >= 0 && i < CHAPTERS.length) activate({ k: 'arrow', i }); e.preventDefault(); }
  }
  canvas.addEventListener('pointermove', onMove); canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointerup', onUp); canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('pointercancel', onLeave);
  window.addEventListener('keydown', onKey);
  canvas.style.touchAction = 'none';

  // ------------------------------------------------ tekenen
  function drawPlate(g, L, i, a) {
    const sl = L.slots[i], pl = L.plates[i], s = st[i], lk = !s.unlocked;
    const x = sl.x - pl.w / 2, y = sl.y + 24 + (a.lift || 0);
    g.save(); g.globalAlpha = lk ? 0.9 : 1;
    g.fillStyle = 'rgba(0,0,0,.35)'; rr(g, x + 2, y + 5, pl.w, pl.h, 12); g.fill();
    g.fillStyle = LG(g, 0, y, 0, y + pl.h, lk ? ['#3a4050', '#242836'] : s.done ? ['#2f5a3a', '#1b3a24'] : ['#4a3322', '#2a1a10']); rr(g, x, y, pl.w, pl.h, 12); g.fill();
    g.strokeStyle = lk ? '#6a7084' : s.done ? '#f0d060' : a.hot ? '#ffe9a0' : '#c49a56'; g.lineWidth = a.hot ? 3 : 2.2; g.stroke();
    g.fillStyle = 'rgba(255,255,255,.08)'; rr(g, x + 3, y + 3, pl.w - 6, pl.h / 2 - 3, 9); g.fill();
    // nummerbordje
    const bx = x + 8, by = y + 6; g.fillStyle = LG(g, 0, by - 16, 0, by + 16, lk ? ['#9aa0b0', '#5a6070'] : s.done ? ['#7ae08a', '#2f9a48'] : ['#ffe27a', '#e0a020']); g.beginPath(); g.arc(bx, by, 19, 0, TAU); g.fill(); g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 2; g.stroke();
    g.font = `700 21px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = lk ? '#2a2e3a' : '#3a2208'; g.fillText(String(lvl(i)), bx, by + 1);
    g.font = `600 19px ${FONT}`; g.fillStyle = lk ? '#b8bfd0' : '#fff4dc'; g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 3;
    pl.lines.forEach((t, k) => g.fillText(t, sl.x + 8, y + 19 + k * 21)); g.shadowBlur = 0;
    // sterren
    const sy0 = y + pl.h - 15;
    for (let k = 0; k < 3; k++) { const px = sl.x + 8 + (k - 1) * 26; star5(g, px, sy0, 10); if (k < s.stars) { g.fillStyle = LG(g, 0, sy0 - 10, 0, sy0 + 10, ['#fff2a0', '#f0b020']); g.fill(); g.strokeStyle = '#8a5a08'; } else { g.fillStyle = 'rgba(0,0,0,.4)'; g.fill(); g.strokeStyle = 'rgba(255,255,255,.25)'; } g.lineWidth = 1.4; g.stroke(); }
    if (s.done) { const cx = x + pl.w - 5, cy = y + 4; g.fillStyle = '#35b050'; g.beginPath(); g.arc(cx, cy, 14, 0, TAU); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.stroke(); g.strokeStyle = '#fff'; g.lineWidth = 3.6; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(cx - 6, cy + 0.5); g.lineTo(cx - 1.5, cy + 5); g.lineTo(cx + 6.5, cy - 5); g.stroke(); }
    g.restore();
  }
  function wrapBox(g, text, maxW, fs) { g.font = `500 ${fs}px ${FONT}`; return wrapText(g, text, maxW); }
  function drawTip(g, x, y, title, sub, extra) {
    g.save(); g.font = `700 22px ${FONT}`; const subL = sub ? wrapBox(g, sub, 300, 17) : []; g.font = `700 22px ${FONT}`; const exL = extra ? wrapBox(g, extra, 300, 16) : [];
    const tw0 = g.measureText(title).width; g.font = `500 17px ${FONT}`; const tw1 = Math.max(0, ...subL.map((l) => g.measureText(l).width)); g.font = `600 16px ${FONT}`; const tw2 = Math.max(0, ...exL.map((l) => g.measureText(l).width)); const tw = Math.max(tw0, tw1, tw2, 220); const w = Math.min(340, tw + 32), h = 18 + 28 + subL.length * 22 + exL.length * 20 + (exL.length ? 8 : 0);
    let tx = clamp(x - w / 2, 12, W - w - 12), ty = y - h - 10; if (ty < 90) ty = clamp(y + 20, 90, H - h - 10);
    g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 14; g.fillStyle = 'rgba(20,16,30,.94)'; rr(g, tx, ty, w, h, 14); g.fill(); g.shadowBlur = 0; g.strokeStyle = '#e8c060'; g.lineWidth = 2; g.stroke();
    g.textAlign = 'left'; g.textBaseline = 'top'; g.font = `700 21px ${FONT}`; g.fillStyle = '#ffe9a0'; g.fillText(title, tx + 16, ty + 12);
    g.font = `500 17px ${FONT}`; g.fillStyle = '#f0ece0'; subL.forEach((l, k) => g.fillText(l, tx + 16, ty + 42 + k * 22));
    g.font = `600 16px ${FONT}`; g.fillStyle = '#ff9a8a'; exL.forEach((l, k) => g.fillText(l, tx + 16, ty + 46 + subL.length * 22 + k * 20));
    g.restore();
  }
  function drawUI(g, L) {
    const C = CHAPTERS[ch], open = chapterOpen(ch);
    // titelbalk
    g.fillStyle = LG(g, 0, 0, 0, 84, ['rgba(12,10,24,.88)', 'rgba(12,10,24,.55)', 'rgba(12,10,24,0)']); g.fillRect(0, 0, W, 90);
    g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.shadowColor = 'rgba(0,0,0,.7)'; g.shadowBlur = 6;
    g.font = `600 15px ${FONT}`; g.fillStyle = '#e8c060'; g.fillText(`HOOFDSTUK ${C.id}`, W / 2, 22);
    g.font = `700 36px ${FONT}`; g.fillStyle = '#fff'; g.fillText(C.name, W / 2, 56);
    g.font = `500 17px ${FONT}`; g.fillStyle = '#e8e0f0'; g.fillText(C.sub, W / 2, 78); g.shadowBlur = 0;
    // pijlen
    for (const d of [-1, 1]) {
      const ci = ch + d; if (ci < 0 || ci >= CHAPTERS.length) continue; const a = arrowPos(d), lk = !chapterOpen(ci), hv = hover && hover.k === 'arrow' && hover.d === d;
      const sh = shake.k === 'arrow' + ci && T - shake.t < 0.4 ? Math.sin((T - shake.t) * 50) * 5 : 0;
      g.save(); g.translate(a.x + sh, a.y + (hv ? -2 : 0)); g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(2, 4, 31, 0, TAU); g.fill();
      g.fillStyle = LG(g, 0, -30, 0, 30, lk ? ['#7a8094', '#4a4f60'] : hv ? ['#fff0a0', '#f0b030'] : ['#ffe27a', '#d8962a']); g.beginPath(); g.arc(0, 0, 30, 0, TAU); g.fill(); g.strokeStyle = 'rgba(40,24,6,.8)'; g.lineWidth = 3; g.stroke();
      g.fillStyle = lk ? '#2a2e3a' : '#3a2208'; g.beginPath(); g.moveTo(d * 10, 0); g.lineTo(-d * 7, -14); g.lineTo(-d * 7, -5); g.lineTo(-d * 14, -5); g.lineTo(-d * 14, 5); g.lineTo(-d * 7, 5); g.lineTo(-d * 7, 14); g.closePath(); g.fill();
      if (lk) padlock(g, 18, 20, 0.6);
      g.restore();
    }
    // tabbolletjes
    for (let i = 0; i < CHAPTERS.length; i++) {
      const q = dotPos(i), lk = !chapterOpen(i), cur = i === ch, hv = hover && hover.k === 'dot' && hover.i === i;
      g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.arc(q.x + 1, q.y + 2, 10, 0, TAU); g.fill();
      g.fillStyle = cur ? '#ffe27a' : lk ? '#4a4f60' : hv ? '#fff' : '#c8c0d8'; g.beginPath(); g.arc(q.x, q.y, cur ? 10 : 8, 0, TAU); g.fill(); g.strokeStyle = 'rgba(20,12,30,.85)'; g.lineWidth = 2; g.stroke();
      if (lk) { g.fillStyle = '#9aa0b4'; g.fillRect(q.x - 3.5, q.y - 1, 7, 5); g.strokeStyle = '#9aa0b4'; g.lineWidth = 1.6; g.beginPath(); g.arc(q.x, q.y - 1, 2.6, Math.PI, 0); g.stroke(); }
      else if (!cur) { g.fillStyle = 'rgba(20,12,30,.7)'; g.font = `700 11px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(i + 1), q.x, q.y + 1); }
    }
    if (!open) {
      g.fillStyle = 'rgba(8,8,20,.5)'; g.fillRect(0, 90, W, H - 90); padlock(g, W / 2, H / 2 - 40, 3.2);
      g.font = `700 32px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.shadowColor = '#000'; g.shadowBlur = 8; g.fillText('Haal eerst het vorige hoofdstuk', W / 2, H / 2 + 60); g.shadowBlur = 0;
    }
  }

  function render(now) {
    const t = now / 1000; const dt = Math.min(0.05, Math.max(0, t - last)); last = t; T = t;
    if (!alive) return;
    if (T - stT > 0.3) { readState(); if (!walk) placeTeun(false); }
    const L = layers(ch), g = ctx;
    // Te-Un loopt naar een nieuw doel of naar een gekozen gebouw
    if (walk) {
      const u = clamp((T - walk.t0) / walk.dur, 0, 1), e = ease(u); teun.x = lerp(walk.fx, walk.tx, e); teun.y = lerp(walk.fy, walk.ty, e); teun.alpha = u > 0.8 ? 1 - (u - 0.8) / 0.2 : 1;
      if (u >= 1 && !walk.done) { walk.done = true; const n = lvl(walk.i); walk = null; teun.alpha = 0; teun.x = L.slots[sel].x; sfx('click'); try { opts.onPick && opts.onPick(n); } catch (e2) { console.error(e2); } teun.mv = null; teun.idx = -1; placeTeun(true); teun.alpha = 0; }
    } else if (teun.mv) {
      const dx = teun.mv.x - teun.x, dy = teun.mv.y - teun.y, d = Math.hypot(dx, dy), sp = 300 * dt; if (d <= sp) { teun.x = teun.mv.x; teun.y = teun.mv.y; teun.mv = null; teun.face = -1; } else { teun.x += dx / d * sp; teun.y += dy / d * sp; teun.face = dx >= 0 ? 1 : -1; }
    }
    if (!walk && teun.alpha < 1) teun.alpha = Math.min(1, teun.alpha + dt * 2.5);

    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.drawImage(L.bg, 0, 0);
    g.setTransform(kx, 0, 0, ky, 0, 0);
    L.paintDynBack(g, T);
    // gebouwen + bewegende dingen op volgorde van diepte
    const items = [];
    for (let i = 0; i < 5; i++) items.push({ y: L.slots[i].y, i });
    for (const a of L.actors) items.push({ y: a.y(T), a });
    items.push({ y: teun.y + 0.5, teun: true });
    items.sort((a, b) => a.y - b.y);
    const target = targetIdx(), selIdx = kbd ? sel : -1;
    for (const it of items) {
      if (it.a) { it.a.draw(g, T); continue; }
      if (it.teun) {
        if (teun.alpha > 0.01) { softShadow(g, teun.x + 5, teun.y, 19, 6, 0.35 * teun.alpha); const moving = walk || teun.mv; drawTeUn(g, { x: teun.x, y: teun.y, s: 1.2, face: teun.face, walk: T * 14, t: T, outfit: 'classic', pose: moving ? 'walk' : 'stand', alpha: teun.alpha }); }
        continue;
      }
      const i = it.i, sl = L.slots[i], s = st[i], lk = !s.unlocked, hv = (hover && hover.k === 'b' && hover.i === i) || selIdx === i || (walk && walk.i === i);
      let sh = 0; if (shake.k === 'b' + i && T - shake.t < 0.45) sh = Math.sin((T - shake.t) * 46) * 6 * (1 - (T - shake.t) / 0.45);
      sl.hv = lerp(sl.hv || 0, hv && !lk ? 1 : 0, Math.min(1, dt * 14));
      const lift = -sl.hv * 7 - (hv ? Math.abs(Math.sin(T * 6)) * 2.5 : 0);
      // gloed onder het gebouw
      if (s.done && !lk) { const p = 0.75 + Math.sin(T * 2 + i) * 0.25; g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.55 * p; g.drawImage(glowSprite('#ffd860'), sl.x - sl.hw * sl.s * 1.3, sl.y - sl.up * sl.s * 0.85, sl.hw * sl.s * 2.6, sl.up * sl.s * 1.25); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
      if (sl.hv > 0.02 && !lk) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.5 * sl.hv; g.drawImage(glowSprite('#fff2b0'), sl.x - sl.hw * sl.s * 1.45, sl.y - sl.up * sl.s * 0.95, sl.hw * sl.s * 2.9, sl.up * sl.s * 1.4); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
      const sp = lk ? L.locked[i] : L.sprites[i], bb = sl.bb, S = sl.s * (1 + sl.hv * 0.03);
      g.drawImage(sp, sl.x + sh - bb[0] * S, sl.y + lift - bb[2] * S, (bb[0] + bb[1]) * S, (bb[2] + bb[3]) * S);
      if (sl.hv > 0.02 && !lk) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.16 * sl.hv; g.drawImage(sp, sl.x + sh - bb[0] * S, sl.y + lift - bb[2] * S, (bb[0] + bb[1]) * S, (bb[2] + bb[3]) * S); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
      if (sl.spec.anim) { g.save(); g.translate(sl.x + sh, sl.y + lift); g.scale(S, S); sl.spec.anim(g, T, L.night, lk); g.restore(); }
      if (lk) padlock(g, sl.x + sh, sl.y - sl.up * sl.s * 0.45, 1.5 * sl.s + 0.4);
      if (s.done && !lk) { for (let k = 0; k < 3; k++) { const ph = (T * 0.8 + k / 3 + i * 0.2) % 1, px = sl.x + Math.sin(k * 2.4 + i) * sl.hw * sl.s * 0.8, py = sl.y - sl.up * sl.s * (0.3 + 0.6 * ((k * 0.37 + i * 0.13) % 1)) - ph * 12; g.fillStyle = `rgba(255,236,140,${Math.sin(ph * Math.PI)})`; star5(g, px, py, 2 + Math.sin(ph * Math.PI) * 4); g.fill(); } }
    }
    // wijzer boven het volgende level
    if (!walk && st[target] && st[target].unlocked && !st[target].done) { const sl = L.slots[target], by = sl.y - sl.up * sl.s - 22 + Math.sin(T * 4) * 6; g.fillStyle = '#ffe27a'; g.strokeStyle = 'rgba(60,30,0,.9)'; g.lineWidth = 3; g.beginPath(); g.moveTo(sl.x, by + 18); g.lineTo(sl.x - 15, by); g.lineTo(sl.x - 6, by); g.lineTo(sl.x - 6, by - 14); g.lineTo(sl.x + 6, by - 14); g.lineTo(sl.x + 6, by); g.lineTo(sl.x + 15, by); g.closePath(); g.stroke(); g.fill(); }
    L.paintDynFront(g, T);
    g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(L.fg, 0, 0); g.drawImage(L.over, 0, 0);
    g.setTransform(kx, 0, 0, ky, 0, 0);
    L.paintLights(g, T);
    // naamplaatjes en interface
    for (let i = 0; i < 5; i++) { const hv = (hover && hover.k === 'b' && hover.i === i) || (kbd && sel === i); drawPlate(g, L, i, { hot: hv, lift: -L.slots[i].hv * 3 }); }
    drawUI(g, L);
    // tooltip
    let tp = null;
    if (!walk) {
      if (hover && hover.k === 'b') { const i = hover.i, sl = L.slots[i], m = LEVELS[lvl(i) - 1]; tp = { x: sl.x, y: sl.y - sl.up * sl.s, title: m.name, sub: m.sub, extra: st[i].unlocked ? '' : (chapterOpen(ch) ? 'Haal eerst het vorige level' : 'Haal eerst het vorige hoofdstuk') }; }
      else if (kbd) { const sl = L.slots[sel], m = LEVELS[lvl(sel) - 1]; tp = { x: sl.x, y: sl.y - sl.up * sl.s, title: m.name, sub: m.sub, extra: st[sel].unlocked ? '' : 'Haal eerst het vorige level' }; }
      else if (hover && (hover.k === 'arrow' || hover.k === 'dot')) { const c2 = CHAPTERS[hover.i]; const a = hover.k === 'arrow' ? arrowPos(hover.d) : dotPos(hover.i); tp = { x: a.x, y: hover.k === 'arrow' ? a.y - 30 : a.y - 14, title: c2.name, sub: c2.sub, extra: chapterOpen(hover.i) ? '' : 'Haal eerst het vorige hoofdstuk' }; if (hover.k === 'arrow' && hover.d < 0) tp.x += 120; if (hover.k === 'arrow' && hover.d > 0) tp.x -= 120; }
      else if (tip && tip.until > T) { const sl = tip.i != null ? L.slots[tip.i] : null; tp = { x: sl ? sl.x : W / 2, y: sl ? sl.y - sl.up * sl.s : H / 2 - 100, title: tip.text, sub: '', extra: '' }; }
    }
    if (tp) { const a = clamp((T - tipT) * 8, 0, 1); g.globalAlpha = a; drawTip(g, tp.x, tp.y + (1 - a) * 6, tp.title, tp.sub, tp.extra); g.globalAlpha = 1; }
    // overgang tussen hoofdstukken
    if (snap && T - snapT < 0.4) { g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1 - (T - snapT) / 0.4; g.drawImage(snap, 0, 0); g.globalAlpha = 1; } else if (snap) snap = null;
  }
  function loop(now) { if (!alive) return; raf = requestAnimationFrame(loop); const t0 = performance.now(); try { render(now); } catch (e) { console.error('citymap', e); } canvas.__frameMs = (canvas.__frameMs || 0) * 0.9 + (performance.now() - t0) * 0.1; }
  raf = requestAnimationFrame(loop);

  return {
    setChapter(i) {
      i = clamp(i | 0, 0, CHAPTERS.length - 1); if (i === ch) { readState(); return; }
      try { snap = mk(canvas.width, canvas.height); snap.getContext('2d').drawImage(canvas, 0, 0); snapT = performance.now() / 1000; } catch (e) { snap = null; }
      ch = i; hover = null; walk = null; tip = null; readState(); placeTeun(true); canvas.style.cursor = '';
    },
    refresh() { readState(); placeTeun(false); },
    resize() { resizeCanvasSizes(); caches.clear(); snap = null; },
    destroy() { alive = false; cancelAnimationFrame(raf); canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointerleave', onLeave); canvas.removeEventListener('pointercancel', onLeave); window.removeEventListener('keydown', onKey); canvas.style.cursor = ''; },
  };
}

// ---------------------------------------------------------------- stad bouwen: statische lagen, sprites, bewegende dingen
function buildCity(city, cw, chh, chIdx) {
  const cfg = CITY[city], kx = cw / W, ky = chh / H;
  const R = RNG(1000 + chIdx * 77);
  const mkLayer = () => { const c = mk(cw, chh); const g = c.getContext('2d'); g.setTransform(kx, 0, 0, ky, 0, 0); return [c, g]; };
  const [bg, gb] = mkLayer(), [fg, gf] = mkLayer(), [over, go] = mkLayer();
  const world = { R, glints: [], lights: [], actors: [], back: [], front: [], night: cfg.night, slots: [], flags: [] };
  cfg.paint(gb, R, world);
  cfg.paintFront(gf, RNG(2000 + chIdx), world);
  // sfeerlaag: kleurwas + vignet
  go.fillStyle = LG(go, 0, 0, 0, H, cfg.wash); go.fillRect(0, 0, W, H);
  go.fillStyle = RG(go, W / 2, H / 2, H * 0.42, W * 0.72, ['rgba(0,0,0,0)', `rgba(0,0,0,${cfg.vig})`], W / 2, H / 2); go.fillRect(0, 0, W, H);
  // gebouwen: sprites
  const slots = [], sprites = [], locked = [], plates = [];
  const tg = mk(10, 10).getContext('2d');
  CHAPTERS[chIdx].levels.forEach((n, i) => {
    const sd = cfg.slots[i], spec = BUILD[sd.kind], bb = spec.bb, hw = spec.hw;
    const k = Math.max(kx, ky) * sd.s * 1.0, sw = (bb[0] + bb[1]) * k, sh = (bb[2] + bb[3]) * k;
    const c = mk(sw, sh), g = c.getContext('2d'); g.translate(bb[0] * k, bb[2] * k); g.scale(k, k);
    spec.draw(g, RNG(500 + n * 31), { night: cfg.night, color: sd.color, v: sd.v });
    // tint
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = cfg.spriteTint; g.fillRect(0, 0, c.width, c.height);
    sprites.push(c);
    const l = mk(c.width, c.height), lg2 = l.getContext('2d'); lg2.drawImage(c, 0, 0); lg2.globalCompositeOperation = 'saturation'; lg2.fillStyle = '#707070'; lg2.fillRect(0, 0, l.width, l.height); lg2.globalCompositeOperation = 'destination-in'; lg2.drawImage(c, 0, 0); lg2.globalCompositeOperation = 'source-atop'; lg2.fillStyle = 'rgba(14,18,40,.5)'; lg2.fillRect(0, 0, l.width, l.height); locked.push(l);
    slots.push({ x: sd.x, y: sd.y, s: sd.s, bb, hw, up: spec.up, spec, hv: 0 });
    // naamplaatje: 1 of 2 regels
    tg.font = `600 19px ${FONT}`; const nm = LEVELS[n - 1].name; let lines = [nm]; if (tg.measureText(nm).width > 215) lines = wrapText(tg, nm, 215).slice(0, 2);
    const tw = Math.max(...lines.map((s2) => tg.measureText(s2).width)); const pw = Math.max(176, Math.min(290, tw + 74));
    plates.push({ lines, w: pw, h: 8 + lines.length * 21 + 26 });
    if (spec.lights) for (const L2 of spec.lights) world.lights.push({ x: sd.x + L2[0] * sd.s, y: sd.y + L2[1] * sd.s, r: L2[2] * sd.s, c: L2[3], a: L2[4], fl: L2[5] || 0, ph: R() * 9, night: true });
  });
  world.slots = slots;
  const lights = world.lights;
  return {
    bg, fg, over, slots, sprites, locked, plates, night: cfg.night, actors: world.actors,
    paintDynBack(g, t) { for (const f of world.back) f(g, t); },
    paintDynFront(g, t) { for (const f of world.front) f(g, t); },
    paintLights(g, t) {
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const l of lights) { const fl = l.fl ? 0.8 + Math.sin(t * (7 + l.ph) + l.ph) * 0.12 * l.fl + Math.sin(t * 23 + l.ph * 3) * 0.08 * l.fl : 1; g.globalAlpha = clamp(l.a * fl, 0, 1); g.drawImage(glowSprite(l.c), l.x - l.r, l.y - l.r, l.r * 2, l.r * 2); }
      g.restore();
    },
  };
}
